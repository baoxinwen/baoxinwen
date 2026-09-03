/**
 * 设计 token 与 SVG 渲染原语 —— 深空玻璃 · 光晕风(v2.1 冰青配色)
 * 规格见 docs/design-system.md;方向小样 design/style-picker.html、配色小样
 * design/color-picker.html(均为本地产物,不入库)。
 * 方向:high-end-visual-design / Ethereal Glass —— 半透明卡面 + 径向光晕 + 白发丝线,
 * 浅色为柔光对应版;配色为 2026-09-03 用户选定的「冰青」。
 * GitHub 官方语言色仍是全页唯一「数据彩色」;全页单一强调色,无品牌色例外。
 */

export const W = 830; // GitHub README 内容列宽
export const PAD = 44; // 卡片内容左右内边距

export const FONT_SANS = `-apple-system,'Segoe UI','PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif`;
export const FONT_MONO = `ui-monospace,'Cascadia Code','SF Mono',Consolas,'Courier New',monospace`;

/**
 * 深/浅双主题 token,两侧键集必须一致(有测试守护)。
 * 半透明值直接写 rgba():SVG 以 <img> 渲染时由浏览器解析,与 hex 同级可靠。
 */
export const TOKENS = {
  light: {
    card: '#FFFFFF', // 玻璃卡基色,配合 cardOpacity 透出页面与光晕
    cardOpacity: 0.6,
    border: '#E2E6EE', // 发丝描边
    ink: '#0E1524',
    body: '#46506B',
    muted: '#8791A8',
    hair: '#EAEDF3', // 卡内分隔线
    accent: '#0E7490', // 冰青强调:编号、链接、峰值、状态点
    soft: 'rgba(14,116,144,0.16)', // 直方图非峰值柱(accent 同相低透明)
    glowA: 'rgba(34,211,238,0.18)', // 青色光晕
    glowB: 'rgba(96,165,250,0.14)', // 冰蓝光晕
    innerHi: 'rgba(255,255,255,0)', // 玻璃上缘反光(浅色不可见,不绘制)
    shadowColor: '#0E7490', // 青调柔影(带色阴影,不用纯黑)
    shadowOpacity: [0.05, 0.04],
  },
  dark: {
    card: '#FFFFFF',
    cardOpacity: 0.045,
    border: 'rgba(255,255,255,0.09)',
    ink: '#F2F5FA',
    body: '#BFC8DA',
    muted: '#76819A',
    hair: 'rgba(255,255,255,0.10)',
    accent: '#22D3EE',
    soft: 'rgba(34,211,238,0.20)',
    glowA: 'rgba(34,211,238,0.20)',
    glowB: 'rgba(96,165,250,0.14)',
    innerHi: 'rgba(255,255,255,0.12)',
    shadowColor: '#000000', // 深色不用投影(opacity 归零),层次靠描边 + 内高光
    shadowOpacity: [0, 0],
  },
};

/** GitHub linguist 官方语言色(常用子集);未知语言回退灰色 */
const LINGUIST = {
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  Python: '#3572A5',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Shell: '#89e051',
  Rust: '#dea584',
  Go: '#00ADD8',
  Java: '#b07219',
  Kotlin: '#A97BFF',
  Swift: '#F05138',
  'C': '#555555',
  'C++': '#f34b7d',
  'C#': '#178600',
  Ruby: '#701516',
  PHP: '#4F5D95',
  Dart: '#00B4AB',
  Lua: '#000080',
  Vue: '#41b883',
  Scala: '#c22d40',
  PowerShell: '#012456',
  Dockerfile: '#384d54',
  Makefile: '#427819',
  Batchfile: '#C1F12E',
};
export const FALLBACK_LANG_COLOR = '#8b949e';
export const langColor = (name) => LINGUIST[name] ?? FALLBACK_LANG_COLOR;

/* ------------------------------------------------------------ 原语 */

export const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const svgWrap = (w, h, body, label) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">${body}</svg>`;

export function text(x, y, str, o = {}) {
  const a = [
    `x="${x}"`, `y="${y}"`, `fill="${o.fill}"`,
    `font-family="${o.family || FONT_SANS}"`,
    `font-size="${o.size || 13}"`,
  ];
  if (o.weight) a.push(`font-weight="${o.weight}"`);
  if (o.anchor) a.push(`text-anchor="${o.anchor}"`);
  if (o.ls) a.push(`letter-spacing="${o.ls}"`);
  if (o.cls) a.push(`class="${o.cls}"`);
  if (o.opacity !== undefined) a.push(`opacity="${o.opacity}"`);
  if (o.style) a.push(`style="${o.style}"`);
  return `<text ${a.join(' ')}>${o.raw ? str : esc(str)}</text>`;
}

export function rect(x, y, w, h, o = {}) {
  const a = [`x="${x}"`, `y="${y}"`, `width="${w}"`, `height="${h}"`];
  if (o.fill) a.push(`fill="${o.fill}"`);
  if (o.stroke) a.push(`stroke="${o.stroke}" stroke-width="${o.sw || 1}"`);
  if (o.rx) a.push(`rx="${o.rx}"`);
  if (o.opacity !== undefined) a.push(`opacity="${o.opacity}"`);
  if (o.filter) a.push(`filter="url(#${o.filter})"`);
  return `<rect ${a.join(' ')}/>`;
}

export const hline = (x1, x2, y, color, sw = 1) =>
  `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${color}" stroke-width="${sw}"/>`;
export const vline = (x, y1, y2, color, sw = 1) =>
  `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${color}" stroke-width="${sw}"/>`;

const blurFilter = (id, dev) =>
  `<filter id="${id}" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="${dev}"/></filter>`;

const hasShadow = (t) => t.shadowOpacity.some((n) => n > 0);

/**
 * 玻璃卡面(v2 核心原语):光晕(卡后)→ 半透明卡面 → 上缘反光,(浅色)紫调柔影。
 * glow 为光晕数组 [{ cx, cy, r, fill, cls? }];cls 用于 hero 光晕的漂移动画类。
 * blur filter 按 uid 命名空间隔离,同页多 SVG 不串。
 * 返回 { defs, body }:调用方只 push body(defs 已前置,重复 push 会重复定义 filter id)。
 */
export function glassSurface(t, uid, w = W, h = 100, { rx = 20, glow = [] } = {}) {
  const defs = [];
  const [near, far] = t.shadowOpacity;
  if (near > 0 || far > 0) {
    defs.push(
      `<filter id="sh-${uid}" x="-8%" y="-15%" width="116%" height="140%">` +
      `<feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="${t.shadowColor}" flood-opacity="${near}"/>` +
      `<feDropShadow dx="0" dy="12" stdDeviation="20" flood-color="${t.shadowColor}" flood-opacity="${far}"/>` +
      `</filter>`,
    );
  }
  glow.forEach((_, i) => defs.push(blurFilter(`gl-${uid}-${i}`, i === 0 ? 34 : 26)));

  const body = [];
  glow.forEach((g, i) => {
    const cls = g.cls ? ` class="${g.cls}"` : ``;
    body.push(`<circle${cls} cx="${g.cx}" cy="${g.cy}" r="${g.r}" fill="${g.fill}" filter="url(#gl-${uid}-${i})"/>`);
  });
  body.push(
    `<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${rx}" fill="${t.card}"` +
    ` fill-opacity="${t.cardOpacity}" stroke="${t.border}" stroke-width="1"` +
    (hasShadow(t) ? ` filter="url(#sh-${uid})"` : ``) + `/>`,
  );
  if (!/,\s*0\)$/.test(t.innerHi)) {
    body.push(`<line x1="${rx}" y1="2" x2="${w - rx}" y2="2" stroke="${t.innerHi}" stroke-width="1"/>`);
  }
  return { defs: defs.length ? `<defs>${defs.join('')}</defs>` : '', body: body.join('') };
}

/** 视觉宽度:CJK 记 2 个等宽格,其余记 1 */
export const visLen = (s) =>
  [...s].reduce((n, ch) => n + (/[\u2E80-\u9FFF\uF900-\uFFEF\u3000-\u303F“”‘’…—·]/.test(ch) ? 2 : 1), 0);

/** CJK 感知的近似换行(maxUnits 为全角单位数) */
export function wrapCJK(str, maxUnits) {
  const rows = [];
  let cur = '', curU = 0;
  for (const ch of str) {
    const u = visLen(ch) / 2;
    if (curU + u > maxUnits && cur) { rows.push(cur); cur = ch; curU = u; }
    else { cur += ch; curU += u; }
  }
  if (cur) rows.push(cur);
  return rows;
}

/** 单行截断:超宽则以 ellipsis 收尾(对齐站点文章标题的 line-clamp 习惯) */
export function truncateCJK(str, maxUnits, ellipsis = '…') {
  const rows = wrapCJK(str, maxUnits);
  return rows.length > 1 ? rows[0] + ellipsis : str;
}

/** CSS 自定义缓动令牌:淡入淡出属屏上变化 → 强化版 ease-in-out(内置曲线太弱,规格同 emil 动效标准) */
export const EASE_IN_OUT = 'cubic-bezier(0.77,0,0.175,1)';

/**
 * 光晕漂移动效(玻璃方向签名动效):22s/26s 缓慢 translate 漂移,仅 transform,
 * reduced-motion 下静止。只随 hero 输出(动效集中在头图,其余卡的光晕为静态)。
 */
export const GLASS_MOTION_CSS =
  `<style>.gl1{animation:glA 22s ease-in-out infinite alternate}` +
  `.gl2{animation:glA 26s ease-in-out infinite alternate-reverse}` +
  `@keyframes glA{from{transform:translate(0,0)}to{transform:translate(16px,10px)}}` +
  `@media (prefers-reduced-motion: reduce){.gl1,.gl2{animation:none}}</style>`;

/**
 * 多文案交叉淡入淡出(CSS 动画,<img> 上下文可播放;SMIL 无法响应 prefers-reduced-motion,故不用)。
 * 关键帧与 keyTimes 0/0.05/0.32/0.4/1 对齐;负 animation-delay 错相。
 * reduced-motion 降级:停轮换,仅显示首条标语(文案信息保留)。
 */
export function typeRotator(x, y, phrases, o, cycle = 7.5) {
  const seg = cycle / phrases.length;
  const style =
    `<style>.tr{opacity:0;animation:trFade ${cycle}s ${EASE_IN_OUT} infinite}` +
    `@keyframes trFade{0%{opacity:0}5%{opacity:1}32%{opacity:1}40%{opacity:0}100%{opacity:0}}` +
    `@media (prefers-reduced-motion: reduce){.tr{animation:none}.tr-a{opacity:1}}</style>`;
  return (
    style +
    phrases
      .map((p, i) => {
        const delay = (-(seg * (phrases.length - 1 - i))).toFixed(2);
        return text(x, y, p, {
          ...o,
          cls: i === 0 ? 'tr tr-a' : 'tr',
          style: `animation-delay:${delay}s`,
        });
      })
      .join('')
  );
}
