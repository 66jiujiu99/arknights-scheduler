<template>
  <div class="ak-page ak-about">
    <header class="ak-page-head">
      <div>
        <div class="ak-kicker">ABOUT</div>
        <h1>说明与隐私</h1>
        <p>纯静态的明日方舟基建排班工具，部署在 GitHub Pages。</p>
      </div>
    </header>

    <section class="ak-card">
      <h2>它做什么</h2>
      <ul class="ak-list">
        <li>用森空岛凭证拉取干员、房间等级、无人机、订单等数据。</li>
        <li>按你的真实基建生成两套方案：一键换班（少操作）与效率最大（按时刻表手动换）。</li>
        <li>制造站产物、贸易站策略按站指定；每次生成 3 个候选，比较换班次数、日收益与最低心情。</li>
        <li>给出练度建议：已拥有但技能未解锁的干员，升到对应精英/等级后大约提升多少。</li>
      </ul>
    </section>

    <section class="ak-card">
      <h2>隐私</h2>
      <ul class="ak-list">
        <li>凭证只保存在浏览器 localStorage，不上传任何服务器。</li>
        <li>所有请求由浏览器直接发往森空岛官方接口。</li>
        <li>方案、产物/策略、手动补全的设施也只保存在本地。</li>
        <li>换设备或清缓存后需要重新粘贴凭证。</li>
      </ul>
    </section>

    <section class="ak-card">
      <h2>数据与限制</h2>
      <ul class="ak-list">
        <li>技能数据来自官方游戏数据（Kengxxiao/ArknightsGameData）与 PRTS 交叉核对，当前版本 2026-10（昨日海）。</li>
        <li>森空岛 API 不返回加工站、回收站、活动室、副手，因此需要首次手动补全。</li>
        <li>收益是估算值；订单质量、中间产物链、部分条件技能并未完全精确建模。</li>
        <li>组合加成在 <code>scripts/combos.source.json</code> 中手动维护，构建时解析为 charId。</li>
        <li>工具只给方案，不会操作游戏；一键换班仍需你在游戏内使用队列轮换。</li>
      </ul>
    </section>

    <section class="ak-card">
      <h2>部署</h2>
      <p class="ak-hint">Vue 3 + Vite，构建产物为纯静态文件；推送到 main 后 GitHub Actions 自动部署到 Pages。</p>
    </section>
  </div>
</template>
