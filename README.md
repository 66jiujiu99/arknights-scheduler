# 罗德岛排班 v5

> 明日方舟基建排班工具 · 纯静态 · GitHub Pages
>
> 当前数据版本：2026-10（昨日海）

## 这是什么

用森空岛凭证读取你的干员与基建数据，生成 **3 个候选排班方案**：

- **一键换班**：少操作。按游戏内「队列轮换」的预设队列设计，每天点 1~3 次。
- **效率最大**：按时刻表手动换，允许不同设施不同周期，追求更高的日产出。

制造站产物、贸易站策略默认读取你账号当前的 `formulaId` / `strategy`，也可以逐站修改；每个候选比较换班次数、日收益、最低心情与操作成本，并给出每个设施的效率 / 心情消耗、换班时间表、生效组合、练度建议与布局建议。

## 纯静态

- Vue 3 + Vite，构建产物是纯 HTML/JS/CSS，可部署 Cloudflare Pages / GitHub Pages。
- 莱茵生命 / Rhine Lab 视觉：暖灰纸面、墨黑、暖杏金、档案式编号与细线。
- 没有后端：凭证只存浏览器 localStorage；请求由浏览器直连森空岛。
- 浏览器侧包含设备指纹生成与请求签名（vendor 的 skland-kit 浏览器 bundle）。
- 游戏数据在构建时生成静态 JSON，页面运行时只读。

## 登录

1. 浏览器打开 <https://www.skland.com/> 并登录。
2. F12 → Console，执行：

   ~~~js
   localStorage.getItem('SK_OAUTH_CRED_KEY') + ',' + localStorage.getItem('SK_TOKEN_CACHE_KEY')
   ~~~

3. 把输出的整段字符串粘贴到登录框。

凭证等价于登录态，请勿发给他人；换设备/清缓存后需重新粘贴。

> 账号密码/验证码登录需要跨域代理，与「纯静态」目标冲突，v5 不再提供。

## 开发

~~~bash
npm install
npm run dev          # 本地开发
npm run build        # 构建到 dist
npm run preview      # 预览构建
npm run build:data   # 重新生成 public/data/v5（需要网络）
npm run test:optimizer
~~~

游戏数据生成脚本从 [Kengxxiao/ArknightsGameData](https://github.com/Kengxxiao/ArknightsGameData) 拉取
<code>building_data.json</code> 与 <code>character_table.json</code>，生成：

- <code>public/data/v5/operators.json</code>：432 名干员的全部后勤技能（含精英阶段/等级条件）
- <code>public/data/v5/facilities.json</code>：房间、电力、配方、订单、常量、布局模板
- <code>public/data/v5/combos.json</code>：由 <code>scripts/combos.source.json</code> 的中文名解析成 charId

## 组合配置

组合是手动维护的。编辑 <code>scripts/combos.source.json</code>：

~~~json
{
  "id": "trade_texas_lappland",
  "name": "德克萨斯 + 拉普兰德（恩怨）",
  "facility": "TRADING",
  "members": ["德克萨斯", "拉普兰德"],
  "effect": { "tradeEfficiency": 0.65 },
  "verified": true
}
~~~

然后运行 <code>npm run build:data</code>。<code>verified: false</code> 的组合会保留在数据里，但默认不参与算法。

## 测试

~~~bash
npm run test:optimizer   # 16 个效率/结构用例，无需凭证
npm run test:options     # 2 个权重状态回归用例
npm run check:efficiency # 真实账号端到端效率检查，需要 AK_CRED
~~~

测试报告见 [docs/v5-test-report.md](docs/v5-test-report.md)。

## 已知限制

- 森空岛 API 不返回加工站、回收站、活动室、副手，需在「基建配置」首次手动补全。
- 收益为估算值：订单质量、中间产物链、部分条件技能未完全精确建模。
- 工具只给方案，不操作游戏；一键换班仍需在游戏内点队列轮换。
- 活动室按单人间使用计算活动信赖。

## 目录

~~~text
src/
  api/skland.js       登录、设备指纹、数据映射
  core/data.js        静态数据加载与技能筛选
  core/base.js        基建配置、电力校验
  core/optimizer.js   心情模拟、产品组合、3 候选、组合/练度建议
  views/              Login / Setup / Plan / About
  vendor/             skland-kit 浏览器 bundle（MIT）
public/data/v5/       运行时静态数据
scripts/              数据生成 + 组合源文件
tests/                效率与结构测试
~~~

## 部署

### Cloudflare Pages（当前主站）

- 项目：<code>ak-scheduler</code>
- 地址：<https://ak-scheduler.pages.dev/>
- 构建命令：<code>npm run build</code>
- 输出目录：<code>dist</code>
- 根目录：<code>/</code>

Cloudflare Pages 构建环境会设置 <code>CF_PAGES=1</code>，Vite 因此使用根路径 <code>/</code>；推送到 <code>main</code> 后自动构建部署。

### GitHub Pages（备用）

GitHub Actions 仍会在 push 后构建，使用子路径 <code>/arknights-scheduler/</code>：

<https://66jiujiu99.github.io/arknights-scheduler/>

## 许可

MIT

## 商标说明

浏览器标签图标使用《明日方舟》罗德岛标志，版权归 Hypergryph / 鹰角网络所有；本项目为非官方同人工具。
