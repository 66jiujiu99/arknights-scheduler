# 罗德岛智能排班系统

> 明日方舟基建自动排班工具 | Arknights Base Scheduler

基于森空岛 API 的纯前端排班系统，自动解析干员数据并生成基建轮换方案。

## 功能

- **森空岛 Credential 一键登录**：粘贴凭证即可同步干员数据，浏览器直连 API，无跨域问题
- **自定义基建配置**：九宫格（制造站≤5 / 贸易站≤5 / 发电站≤3）、控制中枢等级（1-5 人）、各设施等级（可放人数随等级变化）、宿舍数量、基建副手位；带规则校验
- **自动排班**：按你的基建配置对全部设施（控制中枢/制造站/贸易站/发电站/会客室/办公室/训练室/加工站/宿舍/副手）生成 A/B 两班最优方案，含制造站产物配置和控制中枢全局加成
- **干员列表**：展示星级、等级、精英阶段
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
```

## 部署

推送到 GitHub 后，Actions 会自动部署到 GitHub Pages：

```bash
git push origin main
```

访问：`https://66jiujiu99.github.io/arknights-scheduler/`

GitHub Pages 上 **Credential 登录可直接使用**（森空岛 API 支持 CORS）；账号密码/验证码登录需自行配置 CORS 代理。

也可以部署到 Cloudflare Pages（构建命令 `npm run build`，环境变量 `CF_PAGES=1`），此时仓库内的 [`functions/api/[[path]].js`](functions/api/[[path]].js) 会自动成为 API 代理，密码/验证码登录无需额外配置。

## 排班算法

1. 匹配干员基建技能（制造、贸易、发电、会客、训练、控制中枢）
2. 按制造站产物配置分类匹配制造干员
3. 识别技能文本中的搭档关系，将搭档换到同一贸易站
4. 控制中枢干员全局效率加成
5. 生成 A/B 两班轮换方案

## 代码结构

- `index.html` — 单文件应用（登录 + 干员数据 + 排班），Vite 入口
- `public/data/` — 干员基建技能数据（baseSkills.json）、控制中枢技能数据（ctrl_skills.json）
- `functions/api/[[path]].js` — Cloudflare Pages Functions API 代理
- `login-proxy/worker.js` — 独立 Cloudflare Worker 版 CORS 代理
- `src/` — Vue 3 重构版（开发中，尚未接入入口，登录链路已同步更新为现行接口）

## 开发计划

- [ ] 完整干员基建技能数据（从 PRTS 整理）
- [ ] 心情消耗预测和换班提醒
- [ ] 导出排班表图片
- [ ] 自定义基建设施配置
- [ ] Vue 3 重构版接入入口

## 许可

MIT
