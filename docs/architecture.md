# GitHub 主页美化 — 架构文档

| | |
|---|---|
| 版本 | v2.1（玻璃风视觉重塑,架构不变） |
| 日期 | 2026-09-03 |
| 关联文档 | [PRD](specs/requirements.md) · [设计系统](design-system.md) · [设计小样](../design/style-picker.html)（本地产物,不入库） |

> v2.0 摘要：推翻「组装开源组件」路线，渲染层收归**一套自绘 SVG 设计系统**（当期风格为 v2「深空玻璃 · 光晕风」，v2.0 重构时为「工程蓝图 · 编辑风」）。
> 原因：多种开源组件各带一套设计语言，拼装后风格杂凑、区块无衔接（2026-09-02 用户复盘结论）。
> v1.0 的选型结论（组装而非自研）自此作废，保留于 git 历史。

## 1. 现行架构

**总体形态**：README（布局层）+ 自绘资产生成器（渲染层）+ 3 个 GitHub Actions（数据层）。
README 运行时零 JS/CSS（GitHub 平台限制不变）；自研代码只在生成器与门禁中，运行于 Actions / 开发期。

| 决策 | 内容 |
|---|---|
| 统一渲染层 | 除贪吃蛇/图标墙/访客徽章外，全部视觉资产由 `scripts/generate.mjs` 产出：同一套 token（`scripts/lib/tokens.mjs`）、同一批组件渲染器（`scripts/lib/render.mjs`），深浅双版本成对输出（规格见 [design-system.md](design-system.md)） |
| 数据真实 | 生成器经 GitHub GraphQL（1 次调用）+ REST events + 博客 RSS 取真实数据；GitHub 请求失败即退出、不提交，RSS 失败仅跳过博客卡；门禁封禁占位符与冲突标记 |
| 组件取舍 | 保留：贪吃蛇（用户认可）、skillicons（`<picture>` 双主题融入）、komarev（自定义配色对齐 token）。退役：typing-svg、streak-stats、profile-summary-cards（门禁封禁回潮）、blog-sync markdown 列表（2026-09 由自绘博客卡替代，RSS 改由生成器拉取） |
| 模板友好 | workflow 全部使用 `github.repository_owner`（时区经 `TZ_OFFSET` 环境变量配置，默认 +8），资产引用相对路径，门禁的 owner/repo 从 `GITHUB_REPOSITORY`/git remote 自动推导，fork 后改用户名即用 |

## 2. 模块划分

| 模块 | 职责 | 组成 |
|---|---|---|
| M1 README 内容层 | 布局与静态内容 | 全部自绘资产 `<picture>` 深浅切换；About 文案为 markdown |
| M2 Actions 层（2 个，NFR4 上限内） | 定时数据 | `assets.yml`（每日，生成资产并提交 main）、`snake.yml`（每周，产物在 output 分支）；blog-sync 已退役（博客卡由生成器拉 RSS） |
| M3 生成器 | 数据 → SVG | `scripts/generate.mjs` + `scripts/lib/{tokens,github,render}.mjs`，纯 Node 零依赖 |
| M4 设计规范 | 视觉一致性 | token + 组件规格（docs/design-system.md），门禁校验资产成对与无占位符 |
| M5 门禁 | 质量约束 | `scripts/check.mjs`：不变量校验（资产成对、存在性、占位符封禁、退役组件封禁、workflow 白名单/NFR4） |
| M6 模板化层 | 开源复用 | LICENSE、TEMPLATE.md |

## 3. 数据流

```
GitHub API / 博客 RSS（assets.yml 每日 05:23 UTC+8；提交前先跑 npm test + npm run check 门禁）
  ├─ GraphQL：非 fork 仓库（stars/语言字节）、贡献日历（年度贡献/连击/活跃日）
  ├─ REST events：≤10 页（API 仅保留近 90 天）→ 24h 时段分布 + 真实跨度标注（失败降级为空分布）
  ├─ 博客 RSS：最近 5 篇文章 → 博客卡（失败降级为跳过该卡，保留上次产物）
  └→ scripts/generate.mjs → assets/generated/*.{light,dark}.svg（15 组 30 个）→ commit main

访客浏览器
  └→ GitHub CDN 渲染 README.md
       ├─ 自绘资产（含博客卡，整卡 <a> 跳 xsfly.com）：相对路径 → main 分支内 SVG（<picture> 按主题切换）
       ├─ 贪吃蛇：raw.githubusercontent（output 分支，周更）
       ├─ skillicons / komarev：公共实时服务（保留的唯一外部依赖）
       └─ About：README 静态文本
```

## 4. 仓库结构

```
github-profile/
├── README.md                  # 主页（M1）
├── assets/generated/          # 自绘 SVG 产物（28 个，Action 提交）
├── scripts/
│   ├── generate.mjs           # 生成器入口
│   ├── lib/{tokens,github,render}.mjs
│   ├── check.mjs              # 门禁
│   └── test/                  # node --test（门禁 + 生成器）
├── .github/workflows/         # assets / snake（2 个）
├── design/                    # 设计期本地产物（风格小样构建脚本与预览页，不入库）
└── docs/                      # PRD / 架构 / 设计系统 / 计划
```

## 5. 降级策略与升级位

| 故障 | 表现 | 应对 |
|---|---|---|
| assets workflow API 失败 | 本地不提交，线上保留上次产物 | 查 Action 日志；重跑 workflow_dispatch |
| 博客 RSS 不可达 | 仅博客卡保留上次产物，其它卡片正常更新 | workflow 日志记录 warn，恢复后自愈 |
| snake Action 失败 | 显示旧版贪吃蛇 | 产物在 output 分支持续可用 |
| skillicons/komarev 故障 | alt 文本占位 | 择机替换或移除（这两者是仅存的外部依赖） |

升级位：新增卡片 = 在 render.mjs 增加渲染函数 + README 插一对 `<picture>`；换配色 = 只改 tokens.mjs（门禁与测试不受影响）。lowlighter/metrics 保持 YAGNI。

## 6. 安全与权限

- 3 个 workflow 仅用默认 `GITHUB_TOKEN`，最低权限 `contents: write`
- 生成器在 Actions 内读 `secrets.GITHUB_TOKEN`，不引入 PAT / 第三方 secret
- 外部请求只读：GraphQL/REST 拉取公开数据，无数据外泄面
