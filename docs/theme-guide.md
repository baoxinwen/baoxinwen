# 主题指南（换配色只看这里）

> v2.0 起配色收敛为单一事实来源：`scripts/lib/tokens.mjs` 的 `TOKENS`。
> 完整设计规格（间距、字号、组件布局）见 [design-system.md](design-system.md)。

## 换配色的最短路径

编辑 `scripts/lib/tokens.mjs`：

```js
export const TOKENS = {
  light: { card: '#FFFFFF', cardOpacity: 0.6, border: '#E2E6EE', ink: '#0E1524', body: '#46506B',
           muted: '#8791A8', hair: '#EAEDF3', accent: '#0E7490', soft: 'rgba(14,116,144,0.16)',
           glowA: 'rgba(124,92,255,0.20)', glowB: 'rgba(45,212,167,0.16)',
           innerHi: 'rgba(255,255,255,0)', shadowColor: '#0E7490', shadowOpacity: [0.05, 0.04] },
  dark:  { /* 同一组键，深色取值 */ },
};
```

- 深浅两套的**键集必须一致**（有测试守护：`node --test scripts/test/generate.test.mjs`）
- 颜色值支持 6 位 hex 与 `rgba()`（玻璃卡面、光晕、发丝线的半透明都靠 rgba 表达）
- `accent` 是全页唯一强调色（编号、链接、峰值柱、轮换文案、状态点、博客卡站名）；语言构成使用 GitHub 官方语言色，不在 token 内
- 改完运行 `node scripts/generate.mjs` 重新生成资产并提交，README 无需改动

## 深浅色双版本约定

全部自绘资产成对产出（`*.light.svg` / `*.dark.svg`），README 用 `<picture>` 切换：

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/generated/stats.dark.svg" />
  <img src="assets/generated/stats.light.svg" alt="描述" width="100%" />
</picture>
```

保留的外部组件里，skillicons 用同一模式切换 `theme=light|dark`；贪吃蛇由 snake.yml 的 palette 参数控制。门禁（`npm run check`）会校验：成对引用、文件存在、无占位符、`prefers-color-scheme` 媒体查询齐全。

## 保留组件的配色对齐

| 组件 | 参数 |
|---|---|
| skillicons | `theme=light` / `theme=dark`（<picture> 两处） |
| komarev 访客徽章 | `color=0E7490`（冰青强调色）+ `labelColor=0E1524`（墨黑底，深浅背景都可读） |
| 贪吃蛇 | snake.yml：浅色默认 palette，深色 `?palette=github-dark` |
