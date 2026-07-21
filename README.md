# 罗德岛智能排班系统

> 明日方舟基建自动排班工具 | Arknights Base Scheduler

基于森空岛 API 的纯前端排班系统，自动解析干员数据并生成最优基建轮换方案。

## 功能

- **多种登录方式**：森空岛 Credential / 账号密码 / 手机验证码
- **自动排班**：基于干员基建技能和组合加成，生成 A/B/C 三班轮换方案
- **干员管理**：查看和手动添加干员
- **数据本地存储**：所有数据保存在浏览器 localStorage，不上传任何服务器
- **GitHub Pages 部署**：纯静态网站，无需后端

## 技术栈

- Vue 3 + Vite
- Vue Router + Pinia
- 纯 CSS（明日方舟风格 UI，无外部依赖）

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式
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

## 登录方式说明

| 方式 | 说明 |
|------|------|
| **Credential** | 从森空岛官网的浏览器开发者工具中获取 `cred` 值粘贴即可，无跨域问题 |
| **账号密码** | 直接通过鹰角官方 API 验证，可能受浏览器 CORS 限制 |
| **手机验证码** | 发送验证码到绑定手机后登录 |

> 如果账号密码/验证码登录遇到 CORS 错误，可以配置一个 CORS 代理地址，或使用浏览器 CORS 插件。

## 排班算法

1. 匹配干员基建技能（制造、贸易、发电、宿舍等）
2. 识别技能组合（巫恋+龙舌兰等）
3. 贪心选择最优干员组合
4. 生成三班轮换方案

## 开发计划

- [ ] 完整干员基建技能数据（从 PRTS 整理）
- [ ] 心情消耗预测和换班提醒
- [ ] 导出排班表图片
- [ ] 自定义基建设施配置

## 许可

MIT
