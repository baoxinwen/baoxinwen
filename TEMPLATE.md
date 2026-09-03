# 模板使用说明

把本仓库变成你自己的 GitHub 主页，目标 10 分钟内完成。主页的视觉资产由仓库自带的生成器产出（深空玻璃 · 光晕风，规格见 `docs/design-system.md`），你不需要写任何代码。

## 第 1 步：Fork 并改名

1. Fork 本仓库到你的账号
2. 进入你 fork 的仓库 → Settings → General → Repository name，**把仓库名改成你的 GitHub 用户名**（例如 `octocat/octocat`）。这是 GitHub 的特殊仓库规则：与用户同名的公开仓库，其 README 会渲染到你的个人主页
3. 进入 Actions 页，按提示启用 workflows（GitHub 默认禁用 fork 仓库的定时任务）

## 第 2 步：替换 8 处内容

| # | 替换点 | 位置 | 说明 |
|---|---|---|---|
| 1 | 用户名 | 全局 | 编辑器里全局替换 `baoxinwen` → 你的用户名（README 项目卡/贪吃蛇/访客徽章；资产生成与门禁自动取 `repository_owner`/git remote，无需改脚本） |
| 2 | 头图链接 | README 头图区的 `<a href="https://xsfly.com">` | 默认链到作者的博客——换成你的站点 URL，或删掉 `<a>` 包裹只留 `<picture>` |
| 3 | 头图文案 | `scripts/generate.mjs` 的 `CONTENT.hero` | taglines（第一行常驻展示，其余轮换）与 meta 表（blog / focus / lang） |
| 4 | 近况三行 | README 介绍区 | 🔭 正在做 / 🌱 在学 / 📫 联系方式 |
| 5 | 技术栈图标 | README 技术栈区 | [skill-icons 图标 id 列表](https://skillicons.dev)（`theme=light` 与 `theme=dark` 两处同步改） |
| 6 | 精选项目 | `scripts/generate.mjs` 的 `CONTENT.projects` + README 项目卡链接 | 4 个项目（名字/描述/技术栈/仓库），或整块删除 |
| 7 | 时区（可选） | `assets.yml` 的 `TZ_OFFSET`（默认 `8` = UTC+8） | 时段分布与卡片标注按此时区计算；本地运行用环境变量 `TZ_OFFSET` 传入 |
| 8 | 博客卡 | `scripts/generate.mjs` 的 `CONTENT.blog` | site/slogan/url/rss 四项（生成器每日拉 RSS 渲染博客卡）；没有博客就删除该配置与 README 博客卡区块 |

> 贪吃蛇 workflow 无需任何修改：它用 `github.repository_owner` 自动取你的用户名。

## 第 3 步：生成你的资产

- 推送后 `generate-profile-assets` 会每日自动运行，用你的真实 GitHub 数据重新生成 `assets/generated/` 下全部 SVG（深浅各一套）
- 想立刻看效果：Actions → generate-profile-assets → Run workflow；或本地运行
  `GITHUB_TOKEN=$(gh auth token) GITHUB_USER=你的用户名 node scripts/generate.mjs` 后提交产物

## 第 4 步：验收

```bash
npm install        # 仅门禁依赖 js-yaml
npm test           # 门禁 + 生成器测试（node --test）
npm run check      # README / 资产 / workflow 不变量校验
```

- 打开 `https://github.com/你的用户名`，确认各卡片显示你的真实数据
- GitHub 头像菜单 → Settings → Appearance 切换深浅色，所有资产应自动切换版本

## 想换配色？

全部颜色集中在 `scripts/lib/tokens.mjs` 的 `TOKENS`（深浅两套），改完重新生成资产即可；规格与组件布局见 [docs/design-system.md](docs/design-system.md)。

## 致谢（本模板保留的开源组件）

[snk](https://github.com/Platane/snk)（贪吃蛇） · [skill-icons](https://github.com/tandpfun/skill-icons)（图标墙） · [komarev/ghpvc](https://github.com/komarevme/hpcv)（访客计数）；数据来自 GitHub GraphQL / REST 公开 API 与博客 RSS（生成器见 `scripts/lib/`）
