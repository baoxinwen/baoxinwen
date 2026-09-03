// check.mjs 行为测试：自绘设计系统版 README 与 workflow 校验
// 五类边界：空输入 / 极值 / 非法输入 / 并发重复 / 依赖失败。全程子进程跑真实脚本与 fixture，无 mock。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, readdirSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CHECK = join(REPO, 'scripts', 'check.mjs');

const pic = (name, attrs = '') => `<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/generated/${name}.dark.svg" />
  <img src="assets/generated/${name}.light.svg" alt="${name} 资产" ${attrs} />
</picture>`;

const GOOD_README = `<p align="center">
  <a href="https://baoxw.com">
    ${pic('hero', 'width="100%"')}
  </a>
</p>

${pic('hd-about', 'width="100%"')}

- 🔭 正在折腾：给自己用的自托管小工具
- 🌱 在学：Rust
- 📫 找到我：GitHub Issue / Discussion · 博客 浮生闲记

${pic('hd-stack', 'width="100%"')}

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://skillicons.dev/icons?i=typescript,python&theme=dark" />
    <img src="https://skillicons.dev/icons?i=typescript,python&theme=light" alt="技术栈图标" />
  </picture>
</p>

${pic('hd-data', 'width="100%"')}
${pic('stats', 'width="100%"')}
${pic('langs', 'width="100%"')}
${pic('streak', 'width="100%"')}

${pic('hd-projects', 'width="100%"')}

<p>
  <a href="https://github.com/baoxinwen/footprint">${pic('project-1', 'width="405"')}</a>
  <a href="https://github.com/baoxinwen/CopyTree">${pic('project-2', 'width="405"')}</a>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/baoxinwen/baoxinwen/output/snake-dark.svg" />
    <img src="https://raw.githubusercontent.com/baoxinwen/baoxinwen/output/snake-light.svg" alt="贪吃蛇动画" />
  </picture>
</p>

${pic('hd-blog', 'width="100%"')}

<p>
  <a href="https://xsfly.com">${pic('blog', 'width="100%"')}</a>
</p>

${pic('footer', 'width="100%"')}

<p align="center">
  <img src="https://komarev.com/ghpvc/?username=baoxinwen&style=flat&label=VIEWS&color=0E7490&labelColor=0E1524" alt="访客计数" />
</p>
`;

const GOOD_SNAKE_YML = `name: generate-snake

on:
  schedule:
    - cron: "12 0 * * 0"
  workflow_dispatch:

permissions:
  contents: write

jobs:
  generate:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: 生成贪吃蛇
        uses: Platane/snk/svg-only@v3
        with:
          github_user_name: \${{ github.repository_owner }}
          outputs: |
            dist/snake-light.svg
            dist/snake-dark.svg?palette=github-dark

      - name: 推送到 output 分支
        uses: crazy-max/ghaction-github-pages@v4
        with:
          target_branch: output
          build_dir: dist
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
`;

function makeRoot(t) {
  const root = mkdtempSync(join(tmpdir(), 'check-test-'));
  t.after(() => {
    try {
      rmSync(root, { recursive: true, force: true });
    } catch {
      /* Windows 句柄延迟，尽力清理 */
    }
  });
  return {
    root,
    writeReadme(content) {
      writeFileSync(join(root, 'README.md'), content);
    },
    writeWorkflow(name, content) {
      mkdirSync(join(root, '.github', 'workflows'), { recursive: true });
      writeFileSync(join(root, '.github', 'workflows', name), content);
    },
    writeAsset(name, body = '<svg xmlns="http://www.w3.org/2000/svg"></svg>') {
      mkdirSync(join(root, 'assets', 'generated'), { recursive: true });
      writeFileSync(join(root, 'assets', 'generated', name), body);
    },
    snapshot() {
      const out = [];
      (function walk(dir, rel) {
        for (const name of readdirSync(dir)) {
          const abs = join(dir, name);
          const r = rel ? `${rel}/${name}` : name;
          const st = statSync(abs);
          if (st.isDirectory()) walk(abs, r);
          else out.push(`${r}:${st.size}`);
        }
      })(root, '');
      return out;
    },
  };
}

function runCheck(root, args = []) {
  return spawnSync(process.execPath, [CHECK, '--root', root, ...args], { encoding: 'utf8' });
}

async function runCheckParallel(root, n = 2) {
  const procs = Array.from({ length: n }, () =>
    new Promise((resolve) => {
      const p = spawn(process.execPath, [CHECK, '--root', root], { stdio: 'ignore' });
      p.on('close', (code) => resolve(code));
    })
  );
  return Promise.all(procs);
}

/** 干净 fixture：README + 全部被引用的资产文件 + 1 个合法 workflow */
function goodRoot(t) {
  const f = makeRoot(t);
  f.writeReadme(GOOD_README);
  for (const n of ['hero', 'hd-about', 'hd-stack', 'hd-data', 'stats', 'langs', 'streak', 'hd-projects', 'project-1', 'project-2', 'hd-blog', 'blog', 'footer']) {
    f.writeAsset(`${n}.light.svg`);
    f.writeAsset(`${n}.dark.svg`);
  }
  f.writeWorkflow('snake.yml', GOOD_SNAKE_YML);
  return f;
}

test('干净的主页 fixture 全部通过（exit 0，无 ✘）', () => {
  const f = goodRoot({ after() {} });
  const r = runCheck(f.root);
  assert.equal(r.status, 0, `期望通过，实际输出:\n${r.stdout}${r.stderr}`);
  assert.ok(!r.stdout.includes('✘'), `不应有失败项:\n${r.stdout}`);
});

test('缺失 README.md 时以 1 退出并明确指出（空输入类）', () => {
  const f = makeRoot({ after() {} });
  const r = runCheck(f.root);
  assert.equal(r.status, 1);
  assert.ok(r.stdout.includes('README'), r.stdout);
});

test('空 README.md 按缺失处理（空输入类）', () => {
  const f = makeRoot({ after() {} });
  f.writeReadme('');
  const r = runCheck(f.root);
  assert.equal(r.status, 1);
  assert.ok(r.stdout.includes('README'), r.stdout);
});

test('img 缺 alt 时失败并指出具体位置（非法输入类）', () => {
  const f = makeRoot({ after() {} });
  f.writeReadme('<p>\n  <img src="https://example.com/a.png" />\n</p>\n');
  const r = runCheck(f.root);
  assert.equal(r.status, 1);
  assert.ok(/alt/.test(r.stdout), r.stdout);
  assert.ok(r.stdout.includes('2'), `应指出行号 2:\n${r.stdout}`);
});

test('残留【替换点标记时失败', () => {
  const f = goodRoot({ after() {} });
  f.writeReadme(GOOD_README.replace('给自己用的自托管小工具', '【替换点 1：定位】'));
  const r = runCheck(f.root);
  assert.equal(r.status, 1);
  assert.ok(r.stdout.includes('替换点'), r.stdout);
});

test('YAML 语法错误时干净报错、不吐堆栈（非法输入类）', () => {
  const f = goodRoot({ after() {} });
  f.writeWorkflow('bad.yml', 'foo: : :\n  - [unclosed');
  const r = runCheck(f.root);
  assert.equal(r.status, 1);
  const all = r.stdout + r.stderr;
  assert.ok(all.includes('YAML 解析失败'), all);
  assert.ok(!all.includes('node:internal'), `不应暴露堆栈:\n${all}`);
});

test('使用白名单之外的 Action 时失败', () => {
  const f = goodRoot({ after() {} });
  f.writeWorkflow('evil.yml', GOOD_SNAKE_YML.replace('Platane/snk/svg-only@v3', 'evil/action@v1'));
  const r = runCheck(f.root);
  assert.equal(r.status, 1);
  assert.ok(r.stdout.includes('evil/action@v1'), r.stdout);
});

test('workflow 缺 permissions: contents: write 时失败', () => {
  const f = goodRoot({ after() {} });
  f.writeWorkflow('noperm.yml', GOOD_SNAKE_YML.replace('permissions:\n  contents: write\n\n', ''));
  const r = runCheck(f.root);
  assert.equal(r.status, 1);
  assert.ok(r.stdout.includes('permissions'), r.stdout);
});

test('出现 GITHUB_TOKEN 之外的 secret 引用时失败', () => {
  const f = goodRoot({ after() {} });
  f.writeWorkflow('leak.yml', GOOD_SNAKE_YML.replace('secrets.GITHUB_TOKEN', 'secrets.MY_PAT'));
  const r = runCheck(f.root);
  assert.equal(r.status, 1);
  assert.ok(r.stdout.includes('MY_PAT'), r.stdout);
});

test('cron 格式非法时失败', () => {
  const f = goodRoot({ after() {} });
  f.writeWorkflow('badcron.yml', GOOD_SNAKE_YML.replace('cron: "12 0 * * 0"', 'cron: "每周日"'));
  const r = runCheck(f.root);
  assert.equal(r.status, 1);
  assert.ok(r.stdout.includes('cron'), r.stdout);
});

test('每日 cron（资产/博客同步 NFR4）合法通过', () => {
  const f = goodRoot({ after() {} });
  f.writeWorkflow('daily.yml', GOOD_SNAKE_YML.replace('cron: "12 0 * * 0"', 'cron: "23 21 * * *"'));
  const r = runCheck(f.root);
  assert.equal(r.status, 0, `每日 cron 应合法:\n${r.stdout}`);
});

test('cron 字段越界（分钟 75）时失败', () => {
  const f = goodRoot({ after() {} });
  f.writeWorkflow('oob.yml', GOOD_SNAKE_YML.replace('cron: "12 0 * * 0"', 'cron: "75 1 * * *"'));
  const r = runCheck(f.root);
  assert.equal(r.status, 1);
  assert.ok(r.stdout.includes('cron'), r.stdout);
});

test('workflow 超过 NFR4 上限 3 个时失败', () => {
  const f = goodRoot({ after() {} });
  f.writeWorkflow('b.yml', GOOD_SNAKE_YML);
  f.writeWorkflow('c.yml', GOOD_SNAKE_YML);
  f.writeWorkflow('d.yml', GOOD_SNAKE_YML);
  const r = runCheck(f.root);
  assert.equal(r.status, 1);
  assert.ok(r.stdout.includes('NFR4'), r.stdout);
});

test('README 引用已停用/已退役组件时判红（回归固化）', () => {
  const f = goodRoot({ after() {} });
  f.writeReadme(
    `${GOOD_README}\n<img src="https://github-readme-stats.vercel.app/api?username=baoxinwen" alt="坏卡" />\n<img src="https://streak-stats.demolab.com?user=baoxinwen" alt="坏连击" />\n<img src="https://readme-typing-svg.demolab.com?font=x" alt="坏打字机" />\n<img src="profile-summary-card-output/radical/3-stats.svg" alt="坏统计" />\n`
  );
  const r = runCheck(f.root);
  assert.equal(r.status, 1);
  for (const dead of ['github-readme-stats.vercel.app', 'streak-stats.demolab.com', 'readme-typing-svg.demolab.com', 'profile-summary-card-output']) {
    assert.ok(r.stdout.includes(dead), `应指出 ${dead}:\n${r.stdout}`);
  }
});

test('自绘资产缺 dark 配对时失败（picture 双主题不变量）', () => {
  const f = goodRoot({ after() {} });
  f.writeReadme(GOOD_README.replace(/\.dark\.svg/g, '.light.svg'));
  const r = runCheck(f.root);
  assert.equal(r.status, 1);
  assert.ok(r.stdout.includes('缺 dark 配对'), r.stdout);
});

test('引用不存在的资产文件时失败（先跑生成器）', () => {
  const f = goodRoot({ after() {} });
  f.writeReadme(GOOD_README.replace('assets/generated/stats.light.svg', 'assets/generated/stats.light.svg').concat(
    '\n<picture><source media="(prefers-color-scheme: dark)" srcset="assets/generated/ghost.dark.svg" /><img src="assets/generated/ghost.light.svg" alt="幽灵资产" /></picture>\n'
  ));
  const r = runCheck(f.root);
  assert.equal(r.status, 1);
  assert.ok(r.stdout.includes('ghost'), r.stdout);
});

test('生成的资产含占位符坏值（NaN/占位破折号）时失败', () => {
  const f = goodRoot({ after() {} });
  f.writeAsset('stats.light.svg', '<svg>NaN</svg>');
  const r = runCheck(f.root);
  assert.equal(r.status, 1);
  assert.ok(r.stdout.includes('stats.light.svg'), r.stdout);
});

test('生成的资产含未解决 git 冲突标记时失败（变基误提交回归）', () => {
  const f = goodRoot({ after() {} });
  f.writeAsset('streak.light.svg', '<svg><defs><<<<<<< HEAD\nx\n=======\ny\n>>>>>>> main</defs></svg>');
  const r = runCheck(f.root);
  assert.equal(r.status, 1);
  assert.ok(r.stdout.includes('冲突标记'), r.stdout);
});

test('komarev 参数不符设计系统（social 旧样式）时失败', () => {
  const f = goodRoot({ after() {} });
  f.writeReadme(GOOD_README.replace('style=flat', 'style=social'));
  const r = runCheck(f.root);
  assert.equal(r.status, 1);
  assert.ok(r.stdout.includes('komarev'), r.stdout);
});

test('缺博客卡引用时失败（blog-sync 已退役，博客区由自绘博客卡组成）', () => {
  const f = goodRoot({ after() {} });
  f.writeReadme(GOOD_README.replace(/<p>\n  <a href="https:\/\/xsfly\.com">[\s\S]*?<\/a>\n<\/p>\n\n/, ''));
  const r = runCheck(f.root);
  assert.equal(r.status, 1);
  assert.ok(r.stdout.includes('博客卡'), r.stdout);
});

test('1000 个合规 img 的极值输入正常完成（极值类）', () => {
  const f = goodRoot({ after() {} });
  const imgs = Array.from(
    { length: 1000 },
    (_, i) => `<img src="https://example.com/${i}.png" alt="图 ${i}" />`
  ).join('\n');
  f.writeReadme(`${GOOD_README}\n${imgs}\n`);
  const t0 = Date.now();
  const r = runCheck(f.root);
  assert.ok(Date.now() - t0 < 30000, '应在 30s 内完成');
  assert.equal(r.status, 0, r.stdout);
});

test('并发两次调用结果一致且不改动文件（并发重复类）', async () => {
  const f = goodRoot({ after() {} });
  const before = f.snapshot();
  const codes = await runCheckParallel(f.root, 2);
  assert.deepEqual(codes, [0, 0]);
  assert.deepEqual(f.snapshot(), before, '只读检查不应改动 fixture');
});

test('--remote 下依赖不可达时降级为 WARN 而非判红（依赖失败类）', () => {
  const f = goodRoot({ after() {} });
  f.writeReadme(`${GOOD_README}\n<img src="http://127.0.0.1:9/dead.png" alt="不可达图" />\n`);
  const r = runCheck(f.root, ['--remote']);
  const all = r.stdout + r.stderr;
  const warnLine = all.split('\n').find((l) => l.startsWith('WARN') && l.includes('127.0.0.1:9/dead.png'));
  assert.ok(warnLine, `dead URL 应产生 WARN:\n${all}`);
  const failLines = all.split('\n').filter((l) => l.startsWith('✘'));
  assert.ok(failLines.every((l) => !l.includes('127.0.0.1:9')), `dead URL 不应判红:\n${failLines.join('\n')}`);
});

test('未知参数提示用法并以 2 退出', () => {
  const r = spawnSync(process.execPath, [CHECK, '--bogus'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.ok((r.stdout + r.stderr).includes('用法'), r.stdout + r.stderr);
});
