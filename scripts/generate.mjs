#!/usr/bin/env node
/**
 * 主页资产生成器入口：拉取真实 GitHub 数据 → 渲染双主题 SVG → 写入 assets/generated/。
 *
 * 用法：
 *   GITHUB_TOKEN=xxx GITHUB_USER=baoxinwen node scripts/generate.mjs
 *   TZ_OFFSET=8（可选，时区偏移小时数，默认 8 = UTC+8，用于时段分布与卡片标注）
 *   （Actions 中由 .github/workflows/assets.yml 注入 secrets.GITHUB_TOKEN 与 repository_owner）
 *
 * 失败策略：任一必需请求失败 → 非零退出，workflow 不提交，线上保留上次成功产物。
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOKENS } from './lib/tokens.mjs';
import { fetchProfileData } from './lib/github.mjs';
import { fetchBlogPosts } from './lib/rss.mjs';
import { renderAll } from './lib/render.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'assets', 'generated');

/** 静态文案与手工维护内容（改这里即可，无需动渲染器） */
const CONTENT = {
  hero: {
    taglines: [
      '测试工程师 · 独立开发者',
      '把复杂系统测得更可靠，也把真实问题做成好用的工具',
      '正在学 Rust',
      '给自己造用得上的工具',
    ],
    meta: ['blog    浮生闲记', 'focus   quality & tooling', 'lang    zh-CN / code', 'rust    learning…'],
  },
  // 描述按卡片两行版面裁剪（≤44 个全角单位），完整长描述以仓库 About 为准
  projects: [
    { name: 'meme-maker', desc: '纯浏览器端表情包生成器：选模板、上传头像、加文字，一键生成 PNG / GIF，不上传服务器', stack: 'TypeScript · React · Vite', repo: 'baoxinwen/meme-maker' },
    { name: 'prompt-tool', desc: '本地优先的 Windows 提示词管理工具：全局热键呼出、剪贴板历史、变量占位符', stack: 'Rust · Tauri 2 · Vue 3', repo: 'baoxinwen/prompt-tool' },
    { name: 'home-stock', desc: '家庭自托管库存助手：物品开封管理、购物清单转库存、临期过期提醒与浪费统计', stack: 'TypeScript · NestJS · SQLite', repo: 'baoxinwen/home-stock' },
    { name: 'renovation-expenses', desc: '装修账本：清单式预算管理 + 定金尾款跟踪 + 票据留存，数据 100% 本地自托管', stack: 'JavaScript · Fastify', repo: 'baoxinwen/renovation-expenses' },
    { name: 'copy-tree', desc: 'Windows 右键一键复制目录树到剪贴板，支持 7 种输出格式与 .gitignore / glob 过滤', stack: 'Python · tkinter', repo: 'baoxinwen/copy-tree' },
    { name: 'idle-fish', desc: '铝型材机柜报价工具：报价 / 订单 / 3D 预览 / 经营统计，PWA 单用户自部署', stack: 'TypeScript · React · Three.js', repo: 'baoxinwen/idle-fish' },
  ],
  // 站点同源博客卡（视觉参考浮生闲记主题：冰青点缀 + 文章行排版）
  blog: {
    site: '浮生闲记',
    slogan: '以文字为舟，溯流时光之河',
    url: 'xsfly.com',
    rss: 'https://xsfly.com/rss.xml',
  },
};

async function main() {
  const user = process.env.GITHUB_USER || 'baoxinwen';
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('[error] 未设置 GITHUB_TOKEN（本地开发可用：GITHUB_TOKEN=$(gh auth token)）');
    process.exit(1);
  }
  const tzOffset = Number.parseInt(process.env.TZ_OFFSET || '8', 10);
  if (!Number.isInteger(tzOffset) || tzOffset < -12 || tzOffset > 14) {
    console.error(`[error] TZ_OFFSET 非法: ${process.env.TZ_OFFSET}（应为 -12 ~ 14 的整数）`);
    process.exit(1);
  }

  console.log(`[info] 拉取 ${user} 的 GitHub 数据…`);
  const data = await fetchProfileData({ user, token, tzOffset });
  console.log(`[info] stars=${data.stars} repos=${data.repos} contribs=${data.contribs} streak=${data.current}/${data.longest} activeDays=${data.activeDays} langs=${data.langs.length}`);

  // 项目卡附上仓库主语言（渲染为官方语言色点）
  const projects = CONTENT.projects.map((p) => ({
    ...p,
    lang: data.primaryLangByRepo?.[p.repo.split('/')[1].toLowerCase()],
  }));

  // 博客卡为次要数据：RSS 失败只告警并跳过该卡（保留上次产物），不阻塞其它卡片更新；
  // CONTENT.blog 被整块删除（TEMPLATE.md 替换点 8 的无博客配置）时同样显式跳过
  let blog = null;
  if (CONTENT.blog) {
    try {
      blog = {
        site: CONTENT.blog.site,
        slogan: CONTENT.blog.slogan,
        url: CONTENT.blog.url,
        posts: await fetchBlogPosts({ rssUrl: CONTENT.blog.rss, tzOffset }),
      };
      console.log(`[info] 博客卡：已取到 ${blog.posts.length} 篇文章`);
    } catch (e) {
      console.warn(`[warn] 博客 RSS 获取失败，跳过博客卡（线上保留上次产物）: ${e.message}`);
    }
  }

  const bundle = renderAll({ tokens: TOKENS, hero: { user, ...CONTENT.hero }, projects, blog, ...data });
  await mkdir(OUT_DIR, { recursive: true });
  await Promise.all(bundle.map(({ name, mode, svg }) =>
    writeFile(join(OUT_DIR, `${name}.${mode}.svg`), svg, 'utf8')));
  console.log(`[info] 已写入 ${bundle.length} 个 SVG → ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(`[error] ${err.message}`);
  process.exit(1);
});
