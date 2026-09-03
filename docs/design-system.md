# 设计系统 —— 深空玻璃 · 光晕风（v2）

> 2026-09-03 定稿，取代 v1「工程蓝图 · 编辑风」；同日配色由用户从三套候选（冰青/翡翠/琥珀金）中选定「冰青」。方向小样为开发期本地产物
> （`design/style-picker.html` 与构建脚本 `design/build-style-picker.mjs`，均不入库），
> 生成器按本文档实现。方向基调：**high-end-visual-design / Ethereal Glass** ——
> 半透明卡面 + 径向光晕 + 白发丝线，深色优先，浅色为柔光对应版。
> 原则延续 v1：**功能全保留，渲染层统一收归一套自绘 SVG 设计系统**；
> GitHub 官方语言色仍是全页唯一「数据彩色」。

## 1. 设计原则

1. 统一宽度节奏：全宽卡 830px（与 GitHub README 内容列同宽），内容左右内边距 44px（项目卡 30px）
2. 玻璃卡面：半透明白（浅色 60%、深色 4.5%）+ 1px 发丝描边 + 上缘内高光（深色），
   圆角 20（项目卡 18）；**深色不用投影**，层次靠描边与卡面透过率；浅色用紫调柔影（带色阴影，不用纯黑）
3. 光晕语言：hero 双粒（紫罗兰 + 翠绿，漂移动画）；stats / streak / project 各一粒静态小光晕；
   langs / blog / 区块头 / 页脚保持安静。光晕永远在卡面之下，只作氛围不作信息
4. 统一灰阶 + 单一强调色（冰青 `accent`，2026-09-03 用户选定，全页无品牌色例外）；GitHub 官方语言色（linguist）仅用于语言构成
5. 深/浅双 token，每张卡产出一对 SVG，README 用 `<picture>` + `prefers-color-scheme` 自动切换（与贪吃蛇一致）
6. 字体用系统栈，不依赖外部字体（SVG 以 `<img>` 渲染时不加载网络字体）：
   - 无衬线：`-apple-system, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif`
   - 等宽：`ui-monospace, 'Cascadia Code', 'SF Mono', Consolas, 'Courier New', monospace`
7. 数据永远真实：生成器取自 GitHub API；管线失败不提交、保留上次成功产物；**禁止占位符数值**（门禁强制）

## 2. Token

| Token | Light | Dark | 用途 |
|---|---|---|---|
| `card` | `#FFFFFF` | `#FFFFFF` | 玻璃卡基色（配合 `cardOpacity`） |
| `cardOpacity` | `0.6` | `0.045` | 卡面透过率：浅色柔光、深色近乎全透 |
| `border` | `#E2E6EE` | `rgba(255,255,255,0.09)` | 卡片发丝描边（圆角 20/18） |
| `ink` | `#0E1524` | `#F2F5FA` | 标题 / 大数字 |
| `body` | `#46506B` | `#BFC8DA` | 正文 / 描述 |
| `muted` | `#8791A8` | `#76819A` | mono 标注 / 辅助说明 |
| `hair` | `#EAEDF3` | `rgba(255,255,255,0.10)` | 区块头延伸线 / 卡内分隔 / meta 竖线 |
| `accent` | `#0E7490` | `#22D3EE` | 冰青强调：编号、链接、峰值、状态点、轮换文案、博客卡站名 |
| `soft` | `rgba(14,116,144,0.16)` | `rgba(34,211,238,0.20)` | 直方图非峰值柱（accent 同相低透明） |
| `glowA` | `rgba(34,211,238,0.18)` | `rgba(34,211,238,0.20)` | 青色光晕 |
| `glowB` | `rgba(96,165,250,0.14)` | `rgba(96,165,250,0.14)` | 冰蓝光晕 |
| `innerHi` | `rgba(255,255,255,0)` | `rgba(255,255,255,0.12)` | 玻璃上缘反光（浅色不绘制） |
| `shadowColor` | `#0E7490` | `#000000` | 柔影色（深色 opacity 归零 = 无影） |
| `shadowOpacity` | `[0.05, 0.04]` | `[0, 0]` | 双层柔影强度（近 dy2/blur4 · 远 dy12/blur20） |
| 字号 | 姓名 42/700，大数字 30/700（单位 17/500），连击数字 21/700，卡题 17.5/700，区块题 14.5/600，正文 12–12.5，mono 标注 9.5–11 | 同左 | |

## 3. 组件规格（全部由 `scripts/generate.mjs` 产出，成对输出）

| 组件 | 尺寸 | 要点 |
|---|---|---|
| `hero` | 830×232 | 双粒光晕（右上紫、左下绿，`gl1`/`gl2` 漂移动画）+ mono kicker `BAOXINWEN / GITHUB` + 42px/700 姓名 + 文案轮换（CSS 交叉淡化，负相位错开）+ 右侧 meta 表（发丝竖线）+ 脉冲状态点 `open to build` |
| `hd-*` 区块头 ×5 | 830×44 | `01` accent mono + 标题 14.5/600 + 发丝线延伸至右缘（**扁平，不套卡**；起点按 CJK 感知宽度估算） |
| `stats` | 830×156 | 五列大数字 30/700（单位 tspan 17/500，`tabular-nums`），mono 标签，列间发丝竖线；右上角一粒静态紫光晕；顶部 `LAST 365 DAYS · UTC±N` |
| `langs` | 830×H（≥130） | 单条堆叠条（官方语言色，2px 缝隙，rx4）+ 两列图例（圆点 + 名称 + 引线 + 百分比）；图例行自适应增高：首行基线 106、行距 26、基线下 24px 底边距 |
| `streak` | 830×180 | 左：当前连击 / 最长连击 / 最佳单日（大数字 + 中文标签 + mono 英文）；右：24h 直方图（`soft` 柱 + `accent` 峰值），小时刻度 00/06/12/18/23；右下角一粒静态绿光晕；跨度标注按 events 真实覆盖天数显示 |
| `project-*` ×4 | 405×156 | 2×2 网格：项目名 17.5/700 + 右上 `01 / 04` 编号 + 两行描述 + 主语言色点（linguist 色）+ mono 技术栈 + `→ repo` accent 链接；右上角一粒淡紫光晕；README 中包 `<a>` 跳转仓库 |
| `blog` | 830×210 | 博客卡：`BLOG ·` mono + 站名（accent 色）+ 右侧站点标语 + 5 行最近文章（mono 日期 + 标题单行截断，行距 26）+ 右下 `→ url` accent 链接；README 中整卡包 `<a>` 跳博客首页 |
| `footer` | 830×64 | 发丝线 + `© 当前年份`（动态）+ `rendered by github actions`（裸排，不套卡） |

**玻璃卡面**（`glassSurface` 原语）：光晕（卡后，feGaussianBlur）→ 半透明卡面（`card` × `cardOpacity`，发丝描边）→ 上缘内高光（深色）；浅色另叠双层紫调柔影（`feDropShadow`，filter id 按 `sh-{uid}` 命名空间隔离，每张 SVG 只定义一次）。深色 `shadowOpacity=[0,0]` 时不输出投影 filter。

**动效规格**（对齐 emil 动效标准：只动 `opacity`/`transform`，全部包 `prefers-reduced-motion` 降级；动画集中在 hero，其余卡静态）：
- 文案轮换：CSS keyframes 交叉淡化，`cubic-bezier(0.77, 0, 0.175, 1)`（强化版 ease-in-out），负 `animation-delay` 错相，单条停留约 2.4s；reduced-motion 下停轮换只显首条
- 状态脉冲：2.4s 呼吸循环，同一曲线；静态回退 `opacity: 0.95`
- 光晕漂移：`gl1`/`gl2` 22s/26s `ease-in-out` alternate 缓慢 `translate(16px,10px)`，仅 transform；reduced-motion 下静止
- 无障碍说明：`prefers-reduced-motion` 的 media query 写在 SVG 内部；部分渲染器在 `<img>` 上下文不对 SVG 内部求值该 media query（Chromium 实测不生效），此时动画照常播放但不会破坏布局。**2026-09-03 用户复盘定案：维持现状**——动画均为装饰性 opacity/transform 循环，幅度轻微，且图片嵌入是 GitHub 主页唯一可行方式（v1 起同一取舍）

## 4. 数据管线

```
GitHub GraphQL（1 次调用）          REST（≤10 页，API 仅保留近 90 天）
├─ repositories(非 fork)            └─ /users/{u}/events/public
│   stars、语言字节、仓库数              └→ 24h 活跃分布 + 真实跨度（UTC±TZ_OFFSET）
├─ contributionsCollection
│   年度贡献、贡献日历 → 当前/最长连击、活跃日、最佳单日
└→ scripts/lib/render.mjs → assets/generated/*.{light,dark}.svg → 提交 main

博客 RSS（scripts/lib/rss.mjs，次要数据）
└─ CONTENT.blog.rss → 最近 5 篇文章 → assets/generated/blog.{light,dark}.svg
   （拉取失败仅告警并跳过该卡，线上保留上次产物，不阻塞其它卡片）
```

- 认证：`GITHUB_TOKEN`（Actions 内建 token 即可；本地开发 `GITHUB_TOKEN=$(gh auth token)`）
- 用户：`GITHUB_USER` 环境变量（默认 `baoxinwen`；fork 者改此处）
- 时区：`TZ_OFFSET` 环境变量（默认 `8` = UTC+8；影响时段分布归桶、卡片标注与博客文章日期）
- 失败策略：任一 GitHub 请求失败 → 进程 exit 1 → workflow 不提交 → 线上保留上次成功产物；博客 RSS 失败 → 仅跳过博客卡
- 语言色：内置 linguist 常用色映射，未知语言回退 `#8b949e`

## 5. README 组装规则

1. 所有自绘资产用 `<picture>` 包裹（dark source + light img），`width="100%"` 响应式
2. 头图包 `<a href="https://xsfly.com">`（博客首页），项目卡包 `<a href="仓库">`，博客卡整卡包 `<a href="https://xsfly.com">`
3. 区块间距依赖 GitHub `<p>` 默认 16px 外边距，不额外塞空行
4. 保留组件：skillicons（`<picture>` 双主题）、贪吃蛇（output 分支，不变）、komarev（`style=flat` + 冰青配色 `color=0E7490&labelColor=0E1524`）
5. About 文案保持 markdown 手工维护（与组件解耦）；博客手记区由自绘博客卡组成
