#!/usr/bin/env node
// 一键质量门禁：离线校验 README 不变量与 workflow 结构约束（主题对照表、Action 白名单、最低权限）。
// --remote 时联网核验 README 中的图片 URL，失败降级为 WARN 不阻断（离线结论才是权威）。
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import yaml from 'js-yaml';

const USAGE = `用法: node scripts/check.mjs [--root <目录>] [--remote]
  --root    指定被检仓库根目录（默认本仓库）
  --remote  联网核验 README 中的图片 URL（失败降级为 WARN）`;

const ALLOWED_ACTIONS = [
  'actions/checkout@v4',
  'actions/setup-node@v4',
  'Platane/snk/svg-only@v3',
  'crazy-max/ghaction-github-pages@v4',
];

// NFR4：Actions workflow 数量上限
const MAX_WORKFLOWS = 3;

// 已退役的外部组件（2026-09 设计系统重构）。回潮即判红：它们是"风格杂凑"问题的根源
const RETIRED_SOURCES = [
  'github-readme-stats.vercel.app',
  'github-profile-trophy.vercel.app',
  'readme-typing-svg.demolab.com',
  'streak-stats.demolab.com',
  'profile-summary-card-output',
];

// README 里的相对路径图片解析为 raw URL（在线探针用）
// owner/repo 由 detectOwnerRepo 推导（GITHUB_REPOSITORY → git origin → 本仓库默认值），模板采用者无需改这里
export function resolveReadmeUrl(u, owner = 'baoxinwen', repo = 'baoxinwen', branch = 'main') {
  if (/^https?:\/\//.test(u)) return u;
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${u.replace(/^\.\//, '')}`;
}

/** owner/repo 自动推导：GITHUB_REPOSITORY（Actions）→ git origin remote → 兜底默认值 */
export function detectOwnerRepo(root) {
  const env = process.env.GITHUB_REPOSITORY;
  if (env && /^[\w.-]+\/[\w.-]+$/.test(env)) return env.split('/');
  try {
    const r = spawnSync('git', ['-C', root, 'remote', 'get-url', 'origin'], { encoding: 'utf8' });
    const m = (r.stdout || '').trim().match(/[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
    if (r.status === 0 && m) return [m[1], m[2]];
  } catch {
    /* 无 git 环境时走兜底 */
  }
  return ['baoxinwen', 'baoxinwen'];
}

export function nullDeviceFor(platform = process.platform) {
  // 原生 curl.exe 不识别 /dev/null（写失败 status 23），Windows 下用 NUL
  return platform === 'win32' ? 'NUL' : '/dev/null';
}

// 在线核验的三态判定（本 bug 修复引入）：
// ok   —— 2xx 且内容是真实图片（SVG 或 image/*）
// fail —— 上游客死：HTTP 4xx/5xx，或 2xx 但内容不是 SVG / 含错误标记（如 DEPLOYMENT_PAUSED、限流错误 SVG）→ 计入失败
// warn —— curl 网络层失败（本机超时/DNS 被墙等环境问题）→ 降级不阻断（离线结论仍是权威）
export function classifyRemoteResponse(status, contentType, body) {
  if (status === null || status === undefined) return 'warn';
  if (status < 200 || status >= 300) return 'fail';
  const ct = (contentType || '').toLowerCase();
  const text = (body || '').toLowerCase();
  // 200 错误 SVG（如 github-readme-stats 限流图）/ 错误页：状态正常但内容是错误
  const errMarkers = ['deployment_paused', 'deployment_disabled', 'payment required', 'something went wrong', 'maximum retries', 'error fetching resource', 'rate limit'];
  if (errMarkers.some((k) => text.includes(k))) return 'fail';
  if (ct.includes('image/')) {
    // 声称是 SVG 却没有 SVG 内容（错误页伪装）→ 裂图
    if (ct.includes('svg') && !text.includes('<svg')) return 'fail';
    return 'ok';
  }
  // 2xx 但非图片内容（HTML/纯文本错误页）→ 裂图
  return 'fail';
}

const thisFile = fileURLToPath(import.meta.url);
const invoked = process.argv[1] ? resolve(process.argv[1]) : '';
if (invoked && pathToFileURL(invoked).href === pathToFileURL(thisFile).href) {
  main();
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--bogus') || args.some((a, i) => a === '--root' && !args[i + 1])) {
    console.error(USAGE);
    process.exit(2);
  }
  if (args.filter((a) => !a.startsWith('--')).length > 1) {
    console.error(USAGE);
    process.exit(2);
  }
  const root = resolve(args.includes('--root') ? args[args.indexOf('--root') + 1] : join(dirname(thisFile), '..'));
  const remote = args.includes('--remote');

  const failures = [];
  const fail = (msg) => {
    failures.push(msg);
    console.log(`✘ ${msg}`);
  };
  const ok = (msg) => console.log(`✔ ${msg}`);
  const warn = (msg) => console.log(`WARN ${msg}`);
  const lineOf = (content, idx) => content.slice(0, idx).split('\n').length;

  const [owner, repo] = detectOwnerRepo(root);
  checkReadme(owner);
  checkWorkflows();
  if (remote) checkRemote(owner, repo);

  console.log(`\n检查完成：${failures.length} 失败`);
  process.exit(failures.length ? 1 : 0);

  function checkReadme(owner) {
    const p = join(root, 'README.md');
    if (!existsSync(p) || statSync(p).size === 0) {
      fail('README.md 缺失或为空');
      return null;
    }
    const content = readFileSync(p, 'utf8');

    const markerIdx = content.indexOf('【替换点');
    if (markerIdx >= 0) {
      fail(`第 ${lineOf(content, markerIdx)} 行残留【替换点】占位标记，应替换为真实内容`);
    } else {
      ok('无残留替换点标记');
    }

    let badAlt = 0;
    for (const m of content.matchAll(/<img\b[^>]*>/g)) {
      const tag = m[0];
      if (!/\balt=/.test(tag)) {
        badAlt += 1;
        const src = tag.match(/\bsrc="([^"]+)"/)?.[1] ?? '(无 src)';
        fail(`第 ${lineOf(content, m.index)} 行 <img> 缺 alt 属性: ${src}`);
      }
    }
    if (!badAlt) ok('全部 <img> 均有 alt');

    // 自绘资产不变量（docs/design-system.md §5）
    const checkComponent = (hostPattern, label, requiredParams) => {
      const m = content.match(hostPattern);
      if (!m) {
        fail(`缺${label}（${requiredParams[0].split('=')[0]} 等参数约定见 docs/design-system.md）`);
        return;
      }
      const missing = requiredParams.filter((p) => !content.includes(p));
      if (missing.length) fail(`${label} 参数不符设计系统（缺 ${missing.join('、')}）`);
    };
    checkComponent(/skillicons\.dev\/icons\?[^"\s>]+/, '技术栈图标墙（skillicons）', ['theme=light', 'theme=dark']);
    checkComponent(/komarev\.com\/ghpvc\/\?[^"\s>]+/, '访客计数徽章（komarev）', [
      `username=${owner}`,
      'style=flat',
      'color=0E7490',
    ]);

    // 退役组件一旦回潮立即判红（风格杂凑问题的根源，2026-09 设计系统重构固化）
    for (const dead of RETIRED_SOURCES) {
      if (content.includes(dead)) {
        fail(`引用已退役组件 ${dead}——渲染层应使用自绘设计系统（docs/design-system.md）`);
      }
    }

    // 自绘资产 <picture> 成对校验：每个 light 引用必须有同名的 dark 引用，且块内含深色媒体查询
    const refs = [...content.matchAll(/(?:src|srcset)="(assets\/generated\/[^"]+)"/g)].map((m) => m[1]);
    if (!refs.length) {
      fail('README 未引用任何 assets/generated/ 自绘资产（渲染层应全部来自设计系统，docs/design-system.md）');
    } else {
      const light = new Set(refs.filter((u) => u.endsWith('.light.svg')).map((u) => u.replace(/\.light\.svg$/, '')));
      const dark = new Set(refs.filter((u) => u.endsWith('.dark.svg')).map((u) => u.replace(/\.dark\.svg$/, '')));
      const onlyLight = [...light].filter((n) => !dark.has(n));
      const onlyDark = [...dark].filter((n) => !light.has(n));
      for (const n of onlyLight) fail(`自绘资产 ${n} 只有 light 引用，缺 dark 配对（<picture> 双主题）`);
      for (const n of onlyDark) fail(`自绘资产 ${n} 只有 dark 引用，缺 light 配对`);
      if (!onlyLight.length && !onlyDark.length) ok(`自绘资产 ${light.size} 组深浅成对`);

      // 博客卡：blog-sync 已退役（2026-09），文章列表由生成器拉 RSS 渲染为自绘博客卡。
      // 以 hd-blog 区块头为前提做条件校验：头在卡必须在（半删状态判红）；
      // 整块删除 = 无博客采用者的合法配置（TEMPLATE.md 替换点 8），不判死
      if (refs.some((u) => /^assets\/generated\/hd-blog\.(light|dark)\.svg$/.test(u))) {
        if (!refs.some((u) => /^assets\/generated\/blog\.(light|dark)\.svg$/.test(u))) {
          fail('README 有博客区块头（hd-blog）但未引用博客卡 assets/generated/blog.{light,dark}.svg（博客手记区应由生成器产出的自绘博客卡组成；无博客则整块删除）');
        } else {
          ok('博客卡引用就绪');
        }
      }
    }

    const pics = [...content.matchAll(/<picture>[\s\S]*?<\/picture>/g)].map((m) => m[0]);
    let badPic = 0;
    for (const p of pics) {
      if (p.includes('assets/generated/') && !p.includes('prefers-color-scheme: dark')) {
        badPic += 1;
        fail(`自绘资产 <picture> 缺 prefers-color-scheme: dark 媒体查询: ${p.slice(0, 80)}…`);
      }
    }
    if (!badPic && pics.length) ok('全部 <picture> 均为深浅双主题');

    // 磁盘上的资产必须真实存在，且无占位符坏值
    for (const ref of new Set(refs)) {
      if (!existsSync(join(root, ...ref.split('/')))) {
        fail(`引用的资产不存在: ${ref}（先运行 node scripts/generate.mjs）`);
      }
    }
    const genDir = join(root, 'assets', 'generated');
    if (existsSync(genDir)) {
      let badGen = 0;
      for (const f of readdirSync(genDir).filter((x) => x.endsWith('.svg'))) {
        const body = readFileSync(join(genDir, f), 'utf8');
        if (/NaN|undefined/.test(body) || />—</.test(body)) {
          badGen += 1;
          fail(`生成的资产含占位符坏值: ${f}（数据管线可能失败后被误提交）`);
        }
        // git 冲突标记（变基/合并解决不彻底会把标记原样提交，SVG 直接裂开）
        if (/^<{7} |^>{7} |^={7}$/m.test(body)) {
          badGen += 1;
          fail(`生成的资产含未解决的 git 冲突标记: ${f}（重新运行 node scripts/generate.mjs 覆盖）`);
        }
      }
      if (!badGen) ok(`assets/generated/ 共 ${readdirSync(genDir).length} 个 SVG 无占位符`);
    }

    // 贪吃蛇：保留组件，<picture> 深浅双版本不变
    const snakePic = pics.find((p) => p.includes('/output/snake-light.svg'));
    if (!snakePic) {
      fail('贪吃蛇需 <picture> 深浅色双版本（prefers-color-scheme: dark + output 分支 snake-light/snake-dark）');
    } else if (!snakePic.includes('prefers-color-scheme: dark') || !snakePic.includes('/output/snake-dark.svg')) {
      fail('贪吃蛇 <picture> 不完整（需 prefers-color-scheme: dark 与 /output/snake-light.svg、/output/snake-dark.svg）');
    } else {
      ok('贪吃蛇深浅色双版本就绪');
    }

    return content;
  }


  function checkWorkflows() {
    const dir = join(root, '.github', 'workflows');
    if (!existsSync(dir)) {
      warn('未找到 .github/workflows，跳过 workflow 校验');
      return;
    }
    const files = readdirSync(dir).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));
    if (!files.length) {
      warn('.github/workflows 为空，跳过 workflow 校验');
      return;
    }
    if (files.length > MAX_WORKFLOWS) {
      fail(`workflow 数量 ${files.length} 超过 NFR4 上限 ${MAX_WORKFLOWS}: ${files.join(', ')}`);
    }
    for (const f of files) {
      checkWorkflow(dir, f);
    }
  }

  function checkWorkflow(dir, name) {
    const text = readFileSync(join(dir, name), 'utf8');
    let doc;
    try {
      doc = yaml.load(text);
    } catch (e) {
      fail(`${name}: YAML 解析失败: ${String(e.message).split('\n')[0]}`);
      return;
    }
    if (!doc || typeof doc !== 'object') {
      fail(`${name}: YAML 解析失败: 文档为空`);
      return;
    }

    for (const key of ['name', 'on', 'jobs']) {
      if (!(key in doc)) fail(`${name}: 缺必需键 ${key}:`);
    }
    if (doc.permissions?.contents !== 'write') {
      fail(`${name}: 缺 permissions: contents: write（推送 output 分支 / 回写 README 需要，架构文档 §7）`);
    }

    for (const m of text.matchAll(/secrets\.[A-Z_][A-Z0-9_]*/g)) {
      if (m[0] !== 'secrets.GITHUB_TOKEN') {
        fail(`${name}: 出现非 GITHUB_TOKEN 的 secret 引用: ${m[0]}（最低权限约定，架构文档 §7）`);
      }
    }

  const on = JSON.stringify(doc.on ?? {});
  // 五段式：分(0-59) 时(0-23) 日/月/周（* 或数字或区间）；NFR4 允许周调度与博客同步的每日调度
  const FIELD = { min: '(?:[0-5]?\\d)', hour: '(?:[01]?\\d|2[0-3])', dom: '(?:\\*|[1-9]\\d?(?:-[1-9]\\d+)?)', mon: '(?:\\*|[1-9]\\d?(?:-[1-9]\\d+)?)', dow: '(?:\\*|[0-6](?:-[0-6])?)' };
  const cronRe = new RegExp(`^${FIELD.min} ${FIELD.hour} ${FIELD.dom} ${FIELD.mon} ${FIELD.dow}$`);
  for (const m of on.matchAll(/"cron":"([^"]+)"/g)) {
    if (!cronRe.test(m[1])) {
      fail(`${name}: cron 格式非法: "${m[1]}"（应为 "分 时 日 月 周" 五段式，NFR4）`);
    }
  }

    const uses = [];
    const walk = (node) => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (!node || typeof node !== 'object') return;
      for (const [k, v] of Object.entries(node)) {
        if (k === 'uses' && typeof v === 'string') uses.push(v);
        else walk(v);
      }
    };
    walk(doc.jobs);
    for (const u of uses) {
      if (!ALLOWED_ACTIONS.includes(u)) {
        fail(`${name}: Action 不在白名单: ${u}（允许: ${ALLOWED_ACTIONS.join(', ')}）`);
      }
    }
    if (uses.length && !failures.some((x) => x.startsWith(`${name}:`))) ok(`${name}: ${uses.length} 个 Action 均在白名单`);
  }

  function checkRemote(owner, repo) {
    const p = join(root, 'README.md');
    if (!existsSync(p)) return;
    const content = readFileSync(p, 'utf8');
    const urls = [...new Set([...content.matchAll(/(?:src|srcset)="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&')).map((u) => resolveReadmeUrl(u, owner, repo)).filter((u) => /^https?:\/\//.test(u)))];
    for (const u of urls) {
      // 拉取响应体做内容判定（裂图 = HTTP 状态正常但内容是错误页/错误 SVG，仅看状态码会漏判）
      const r = spawnSync('curl', ['-sL', '--max-time', '25', '-o', '-', '-w', '\n__META__%{http_code}|%{content_type}', u], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
      const out = r.stdout ?? '';
      const metaIdx = out.lastIndexOf('__META__');
      const meta = metaIdx >= 0 ? out.slice(metaIdx + 8).split('|') : [];
      const status = parseInt(meta[0], 10);
      const contentType = (meta[1] || '').trim();
      const body = metaIdx >= 0 ? out.slice(0, metaIdx) : '';
      if (r.status !== 0 || !Number.isFinite(status)) {
        // curl 进程失败（超时/DNS/连接拒绝）：环境问题，降级不判红（离线结论仍是权威）
        warn(`无法访问（跳过，不阻断离线结论）: ${u}`);
        continue;
      }
      const verdict = classifyRemoteResponse(status, contentType, body);
      if (verdict === 'fail') {
        fail(`在线核验：${u} 返回异常内容（HTTP ${status} ${contentType}，片段：${JSON.stringify(body.slice(0, 80))}）——该卡在访客端已裂图`);
      } else if (verdict === 'warn') {
        warn(`无法访问（跳过，不阻断离线结论）: ${u}`);
      }
    }
    if (urls.length) console.log(`远程核验完成：${urls.length} 个 URL`);
  }
}
