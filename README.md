# 罗德岛智能排班系统

> 明日方舟基建自动排班工具 | Arknights Base Scheduler

基于森空岛 API 的纯前端排班系统，自动解析干员数据并生成基建轮换方案。

## 功能

- **森空岛 Credential 一键登录**：粘贴凭证即可同步干员数据，浏览器直连 API，无跨域问题
- **自定义基建配置**：九宫格（制造站≤5 / 贸易站≤5 / 发电站≤3）、控制中枢等级（1-5 人）、各设施等级（可放人数随等级变化）、宿舍数量、基建副手位；带规则校验和「按游戏数据同步」
- **v4 全设施排班**：按你的基建配置生成 A/B 两班方案，覆盖控制中枢/制造站/贸易站/发电站/会客室/办公室/训练室/加工站/宿舍/副手；制造站按产物、贸易站按策略匹配，贸易站搭档联动，控制中枢加成计入效率
- **心情与效率统计**：每班效率、心情消耗/小时、中枢加成
- **方案管理**：保存/加载/删除方案，复制排班文本，导出 JSON
- **Vue 3 单页应用**：Vue 3 + Vite，Hash 路由；旧版单文件应用保留在 `legacy.html`
- **数据本地存储**：所有数据保存在浏览器 localStorage，不上传任何服务器

## 登录方式说明

| 方式 | 说明 |
|------|------|
| **Credential（推荐）** | 从森空岛官网浏览器开发者工具中复制 `SK_OAUTH_CRED_KEY` 的值粘贴即可。森空岛 API（zonai.skland.com）允许浏览器跨域，GitHub Pages 部署也能直接使用 |
| **账号密码 / 手机验证码** | 鹰角通行证接口（as.hypergryph.com）**不带 CORS 头**，需要部署 `login-proxy/worker.js`（Cloudflare Worker）或使用浏览器跨域插件 |

### 账号密码 / 验证码登录代理配置

1. 打开 [Cloudflare Dashboard](https://dash.cloudflare.com/) → Workers & Pages
2. 创建一个新的 Worker，代码使用仓库中 [`login-proxy/worker.js`](login-proxy/worker.js) 的内容
3. 部署后把 Worker 地址填入应用的「CORS 代理配置」（Vue 版登录页内）

> 代理只允许来自 `*.pages.dev` / `*.github.io` / `localhost` 的调用，避免被第三方滥用。

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式（本地起静态服务，应用为单文件 index.html）
npm run dev

# 构建
npm run build

# 预览构建结果
npm run preview

# 算法自测（无需浏览器）
npm run test:scheduler
```

## 部署

推送到 GitHub 后，Actions 会自动部署到 GitHub Pages：

```bash
git push origin main
```

访问：`https://66jiujiu99.github.io/arknights-scheduler/`

GitHub Pages 上 **Credential 登录可直接使用**（森空岛 API 支持 CORS）；账号密码/验证码登录需自行配置 CORS 代理。

也可以部署到 Cloudflare Pages（构建命令 `npm run build`，环境变量 `CF_PAGES=1`），此时仓库内的 [`functions/api/[[path]].js`](functions/api/[[path]].js) 会自动成为 API 代理，密码/验证码登录无需额外配置。

## 排班算法（v4）

1. 按基建配置生成站点：控制中枢 + 九宫格（制造/贸易/发电）+ 会客室/办公室/训练室/加工站 + 宿舍 + 副手
2. 把森空岛干员数据与 `baseSkills.json` 合成基建技能（制造、贸易、发电、会客、训练、控制中枢、宿舍）
3. 制造站按产物分类、贸易站按策略匹配；贸易站搭档联动
4. 控制中枢的全设施加成计入制造站/贸易站效率
5. 生成 A/B 两班轮换，统计效率与心情消耗（站内人数 × 设施基础消耗 + 干员技能修正）

## 代码结构

- `index.html` — Vue 入口页
- `src/` — Vue 3 应用（主入口）
  - `views/` — Login / Dashboard / Schedule / Operators
  - `components/BaseConfig.vue` — 自定义基建配置
  - `utils/schedulerV4.js` — v4 排班算法（纯函数）
  - `composables/useBaseConfig.js` — 基建配置状态与 localStorage
- `public/data/` — 干员基建技能数据（baseSkills.json）、控制中枢技能数据（ctrl_skills.json）
- `public/legacy.html` — 旧版单文件应用（保留可用，入口在首页底部）
- `functions/api/[[path]].js` — Cloudflare Pages Functions API 代理
- `login-proxy/worker.js` — 独立 Cloudflare Worker 版 CORS 代理

## 开发计划

- [x] 自定义基建设施配置
- [x] Vue 3 重构版接入入口
- [ ] 完整干员基建技能数据（从 PRTS 整理）
- [ ] 心情消耗预测和换班提醒（当前已统计心情/小时）
- [ ] 导出排班表图片（当前支持复制文本/导出 JSON）

## 许可

MIT
