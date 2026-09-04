/**
 * SVG 组件渲染器 —— 深空玻璃 · 光晕风(docs/design-system.md §3,v2)。
 * 全部为纯函数:token + 数据 → SVG 字符串;不触网、不读写文件。
 * 动效纪律(对齐 emil 动效标准):只动 opacity/transform;轮换、脉冲、光晕漂移全部
 * 包 prefers-reduced-motion 降级;动画集中在 hero,其余卡保持静态。
 */
import {
  W, PAD, FONT_SANS, FONT_MONO, langColor, EASE_IN_OUT, GLASS_MOTION_CSS,
  svgWrap, text, rect, hline, vline, glassSurface, typeRotator, wrapCJK, visLen, truncateCJK, esc,
} from './tokens.mjs';

const RIGHT = W - PAD; // 内容右缘 786
const YEAR = new Date().getFullYear();

/** 600 字重中英混排的经验宽度:visLen 全角单位 × 字号 × k */
const textWidth = (str, size, k = 0.6) => visLen(str) * size * k;

/** 脉冲状态点:CSS 呼吸动画(自定义 ease-in-out),reduced-motion 下静止 */
function pulseDot(cx, cy, r, fill) {
  return (
    `<style>.pl{animation:pl 2.4s ${EASE_IN_OUT} infinite}@keyframes pl{0%,100%{opacity:.95}50%{opacity:.25}}` +
    `@media (prefers-reduced-motion: reduce){.pl{animation:none}}</style>` +
    `<circle class="pl" cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" opacity="0.95"/>`
  );
}

/** 大数字 + 可选中/英文单位:单位小一号并降透明,与数字同基线居中 */
function bigNumber(cx, y, v, { fill, size, unitSize }) {
  const m = /^(-?[\d.,]+)(.*)$/.exec(String(v));
  if (!m || !m[2].trim()) {
    return text(cx, y, String(v), { fill, size, weight: 700, anchor: 'middle', ls: -0.3, style: 'font-variant-numeric:tabular-nums' });
  }
  const unit = m[2].trim();
  return text(cx, y, `${m[1]} `, {
    fill, size, weight: 700, anchor: 'middle', ls: -0.3,
    style: 'font-variant-numeric:tabular-nums', raw: true,
  }).replace(
    '</text>',
    `<tspan font-size="${unitSize}" font-weight="500" opacity="0.85">${esc(unit)}</tspan></text>`,
  );
}

/** 头图 830×232:双粒光晕(漂移动画)+ mono kicker + 姓名 + 文案轮换 + meta 表 + 状态点 */
export function renderHero(t, { user, taglines, meta }) {
  const glow = [
    { cx: 620, cy: 44, r: 82, fill: t.glowA, cls: 'gl1' },
    { cx: 170, cy: 196, r: 64, fill: t.glowB, cls: 'gl2' },
  ];
  const { defs, body } = glassSurface(t, 'hero', W, 232, { glow });
  const b = [defs + body, GLASS_MOTION_CSS];
  b.push(text(PAD, 48, `${user.toUpperCase()} / GITHUB`, { fill: t.muted, family: FONT_MONO, size: 10.5, ls: 3 }));
  b.push(text(46, 112, user, { fill: t.ink, size: 42, weight: 700, ls: -0.5 }));
  b.push(text(PAD, 144, taglines[0], { fill: t.body, size: 15, weight: 500 }));

  // 右侧 meta 表
  const mx = 580;
  b.push(vline(556, 52, 158, t.hair));
  meta.forEach((m, i) => b.push(text(mx, 70 + i * 24, m, { fill: t.muted, family: FONT_MONO, size: 10.5 })));

  // 状态点(呼吸)+ 文案轮换(第 2 条起)
  b.push(pulseDot(mx, 190, 3.5, t.accent));
  b.push(text(mx + 14, 194, `open to build · ${YEAR}`, { fill: t.muted, family: FONT_MONO, size: 10 }));
  if (taglines.length > 1) {
    b.push(typeRotator(PAD, 172, taglines.slice(1), { fill: t.accent, size: 11.5, family: FONT_MONO }));
  }
  return svgWrap(W, 232, b.join(''), `${user} 的 GitHub 头图`);
}

/** 区块头 830×44:`01` accent mono + 标题 + 发丝线贯穿(扁平,不套卡) */
export function renderHeader(t, num, title) {
  const b = [
    text(PAD, 28, num, { fill: t.accent, family: FONT_MONO, size: 11, weight: 700 }),
    text(PAD + 22, 28, title, { fill: t.ink, size: 14.5, weight: 600 }),
    // 起点按 CJK 感知宽度估算(title.length 对混排标题失准)
    hline(PAD + 22 + textWidth(title, 14.5, 0.72) + 22, RIGHT, 24, t.hair),
  ];
  return svgWrap(W, 44, b.join(''), `第 ${num} 节 ${title}`);
}

/** 数据摘要 830×156:五列大数字(等宽数字,列间发丝竖线),右上角一粒静态光晕 */
export function renderStats(t, metrics, tz = 8) {
  const glow = [{ cx: 706, cy: 22, r: 56, fill: t.glowA }];
  const { defs, body } = glassSurface(t, 'stats', W, 156, { glow });
  const b = [defs + body];
  b.push(text(PAD, 38, `LAST 365 DAYS · UTC${tz >= 0 ? '+' : ''}${tz}`, { fill: t.muted, family: FONT_MONO, size: 10, ls: 2 }));
  const col = (RIGHT - PAD) / metrics.length;
  metrics.forEach((m, i) => {
    const cx = PAD + col * i + col / 2;
    b.push(bigNumber(cx, 100, m.v, { fill: t.ink, size: 30, unitSize: 17 }));
    b.push(text(cx, 126, m.label, { fill: t.muted, family: FONT_MONO, size: 9.5, anchor: 'middle', ls: 1.5 }));
    if (i) b.push(vline(PAD + col * i, 58, 130, t.hair));
  });
  return svgWrap(W, 156, b.join(''), 'GitHub 数据摘要');
}

/** 语言构成 830×H(≥130):官方语言色堆叠条 + 两列图例;行数多时自适应增高,底边距恒定 */
export function renderLangs(t, langs) {
  const rows = Math.ceil(langs.length / 2);
  // 首行基线 106、行距 26、基线下留 24px 底边距
  const h = Math.max(130, 106 + (rows - 1) * 26 + 24);
  const { defs, body } = glassSurface(t, 'langs', W, h);
  const b = [defs + body];
  b.push(text(PAD, 38, 'LANGUAGES · BY REPO', { fill: t.muted, family: FONT_MONO, size: 10, ls: 2 }));
  const barW = RIGHT - PAD;
  // 按占比总和归一：各段独立四舍五入后总和可为 101~103，
  // 直接按 /100 缩放会让末段越过内容右缘；归一后条形恰好铺满 [PAD, RIGHT]
  const totalPct = langs.reduce((a, l) => a + l.pct, 0) || 100;
  let x = PAD;
  langs.forEach((l, i) => {
    const w = (barW - 2 * (langs.length - 1)) * (l.pct / totalPct);
    b.push(rect(x, 60, w, 12, { fill: langColor(l.name), rx: 4 }));
    x += (i < langs.length - 1) ? w + 2 : w;
  });
  langs.forEach((l, i) => {
    const col = i % 2, row = (i - col) / 2;
    const lx = PAD + col * 381, ly = 106 + row * 26;
    const color = langColor(l.name);
    b.push(`<circle cx="${lx + 4.5}" cy="${ly - 4.5}" r="4.5" fill="${color}"/>`);
    b.push(text(lx + 17, ly, l.name, { fill: t.body, size: 12.5 }));
    b.push(hline(lx + 17 + textWidth(l.name, 12.5) + 10, lx + 148, ly - 4, t.hair));
    b.push(text(lx + 190, ly, `${l.pct}%`, { fill: t.muted, family: FONT_MONO, size: 11, anchor: 'end' }));
  });
  return svgWrap(W, h, b.join(''), '语言构成');
}

/** 连击与时段 830×180:左三指标 + 右 24h 直方图(soft 柱 + accent 峰值) */
export function renderStreakHours(t, streak, hours, { tz = 8, spanDays = null } = {}) {
  const glow = [{ cx: 764, cy: 162, r: 50, fill: t.glowB }];
  const { defs, body } = glassSurface(t, 'streak', W, 180, { glow });
  const b = [defs + body];
  b.push(text(PAD, 38, `STREAK & HOURS · UTC${tz >= 0 ? '+' : ''}${tz}`, { fill: t.muted, family: FONT_MONO, size: 10, ls: 2 }));
  streak.forEach((s, i) => {
    const y = 68 + i * 38;
    b.push(bigNumber(44, y + 12, s.v, { fill: t.ink, size: 21, unitSize: 14 }));
    b.push(text(130, y + 11, s.label, { fill: t.body, size: 12.5 }));
    b.push(text(130, y + 25, s.en, { fill: t.muted, family: FONT_MONO, size: 9.5, ls: 1 }));
  });
  b.push(vline(310, 56, 156, t.hair));

  const gx = 346, gw = RIGHT - gx, gh = 74, gy = 132;
  const max = Math.max(...hours, 1);
  const bw = gw / 24 - 5;
  hours.forEach((v, h) => {
    const bh = v === 0 ? 2 : Math.max(3, (v / max) * gh);
    const peak = v === max && v > 0;
    b.push(rect(gx + h * (gw / 24), gy - bh, bw, bh, { fill: peak ? t.accent : t.soft, rx: 2 }));
  });
  [0, 6, 12, 18, 23].forEach((h) =>
    b.push(text(gx + h * (gw / 24) + bw / 2, gy + 16, String(h).padStart(2, '0'), { fill: t.muted, family: FONT_MONO, size: 9, anchor: 'middle' })));
  b.push(hline(gx, gx + gw - bw, gy + 2, t.hair));
  // 跨度按 events 真实覆盖天数显示(标签必须与数据窗口一致,不许夸大)
  const span = spanDays ? `近 ${spanDays} 天公开活动` : '近期公开活动';
  b.push(text(gx, 58, `活跃时段 · ${span}`, { fill: t.body, size: 12 }));
  return svgWrap(W, 180, b.join(''), '连击与活跃时段');
}

/** 项目卡 405×156(两列并排):主语言色点 + 编号 + 底缘对齐的仓库链接,右上角一粒淡光晕 */
export function renderProject(t, p, i, total) {
  const glow = [{ cx: 374, cy: 18, r: 42, fill: t.glowA }];
  const { defs, body } = glassSurface(t, `project-${i + 1}`, 405, 156, { rx: 18, glow });
  const b = [defs + body];
  b.push(text(30, 46, p.name, { fill: t.ink, size: 17.5, weight: 700, ls: -0.2 }));
  b.push(text(375, 46, `${String(i + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`, { fill: t.muted, family: FONT_MONO, size: 9.5, anchor: 'end' }));
  wrapCJK(p.desc, 22).slice(0, 2).forEach((line, k) =>
    b.push(text(30, 74 + k * 18, line, { fill: t.body, size: 12 })));
  if (p.lang) {
    b.push(`<circle cx="33.5" cy="141" r="3.5" fill="${langColor(p.lang)}"/>`);
    b.push(text(44, 145, p.stack, { fill: t.muted, family: FONT_MONO, size: 10 }));
  } else {
    b.push(text(30, 145, p.stack, { fill: t.muted, family: FONT_MONO, size: 10 }));
  }
  b.push(hline(30, 375, 124, t.hair));
  b.push(text(375, 145, `→ ${p.repo}`, { fill: t.accent, family: FONT_MONO, size: 10.5, weight: 700, anchor: 'end' }));
  return svgWrap(405, 156, b.join(''), `${p.name} 项目卡`);
}

/** 博客卡 830×210:全页单一强调色 —— kicker + 站点标语 + 最近文章行;README 中整卡包 <a> 跳博客 */
export function renderBlog(t, { site, slogan, url, posts }) {
  const { defs, body } = glassSurface(t, 'blog', W, 210);
  const b = [defs + body];
  b.push(text(PAD, 38, 'BLOG ·', { fill: t.muted, family: FONT_MONO, size: 10, ls: 2 }));
  b.push(text(PAD + 52, 38, site, { fill: t.accent, size: 11, weight: 600 }));
  b.push(text(RIGHT, 38, slogan, { fill: t.muted, family: FONT_MONO, size: 10, anchor: 'end' }));
  posts.forEach((p, i) => {
    const y = 70 + i * 26;
    // 末行标题给右下的 → 链接让位
    const maxUnits = i === posts.length - 1 ? 46 : 52;
    b.push(text(PAD, y, p.date, { fill: t.muted, family: FONT_MONO, size: 10.5 }));
    b.push(text(96, y, truncateCJK(p.title, maxUnits), { fill: t.body, size: 12.5 }));
  });
  b.push(text(RIGHT, 182, `→ ${url}`, { fill: t.accent, family: FONT_MONO, size: 10.5, weight: 700, anchor: 'end' }));
  return svgWrap(W, 210, b.join(''), `${site}最近文章`);
}

/** 页脚 830×64(裸排,不套卡) */
export function renderFooter(t, { user }) {
  const b = [
    hline(PAD, RIGHT, 20, t.hair),
    text(PAD, 46, `© ${YEAR} ${user}`, { fill: t.muted, family: FONT_MONO, size: 10.5 }),
    // 不写 "updated daily"：GitHub schedule 为尽力而为，实测会缺跑，文案不夸大
    text(RIGHT, 46, 'rendered by github actions', { fill: t.muted, family: FONT_MONO, size: 10.5, anchor: 'end' }),
  ];
  return svgWrap(W, 64, b.join(''), '页脚');
}

/** 渲染全部组件(双主题)→ [{ name, mode, svg }]；data = { tokens, hero, projects, ...画像数据 } */
export function renderAll(data) {
  const metrics = [
    { v: String(data.stars), label: 'STARS' },
    { v: String(data.contribs), label: 'CONTRIBS / YR' },
    { v: `${data.current} 天`, label: 'STREAK' },
    { v: String(data.repos), label: 'REPOS' },
    { v: String(data.activeDays), label: 'ACTIVE DAYS' },
  ];
  const streak = [
    { v: `${data.current} 天`, label: '当前连击', en: 'current streak' },
    { v: `${data.longest} 天`, label: '最长连击', en: 'longest streak' },
    { v: String(data.bestDay), label: '最佳单日', en: 'best day' },
  ];
  const hours = data.hours ?? Array(24).fill(0);
  const headers = [
    ['hd-about', '01', '关于'],
    ['hd-stack', '02', '技术栈'],
    ['hd-data', '03', 'GitHub 数据'],
    ['hd-projects', '04', '精选项目'],
    ['hd-blog', '05', '博客手记'],
  ];
  const out = [];
  for (const mode of ['light', 'dark']) {
    const t = { ...data.tokens[mode], mode };
    out.push({ name: 'hero', mode, svg: renderHero(t, data.hero) });
    for (const [name, num, title] of headers) {
      out.push({ name, mode, svg: renderHeader(t, num, title) });
    }
    out.push({ name: 'stats', mode, svg: renderStats(t, metrics, data.tzOffset) });
    out.push({ name: 'langs', mode, svg: renderLangs(t, data.langs) });
    out.push({ name: 'streak', mode, svg: renderStreakHours(t, streak, hours, { tz: data.tzOffset, spanDays: data.spanDays ?? null }) });
    data.projects.forEach((p, i) => {
      out.push({ name: `project-${i + 1}`, mode, svg: renderProject(t, p, i, data.projects.length) });
    });
    // 博客卡是次要数据:RSS 未取到时跳过(README 保留上次提交的产物)
    if (data.blog) out.push({ name: 'blog', mode, svg: renderBlog(t, data.blog) });
    out.push({ name: 'footer', mode, svg: renderFooter(t, data.hero) });
  }
  return out;
}
