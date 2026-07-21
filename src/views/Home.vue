<template>
  <div>
    <h1 class="ak-page-title">◇ 罗德岛智能排班</h1>
    <p class="ak-page-subtitle">自动解析干员数据，生成最优基建轮换排班方案</p>

    <div class="ak-card" style="text-align:center; padding:60px 20px">
      <div style="font-size:64px; margin-bottom:16px">◇</div>
      <h2 style="font-size:20px; margin-bottom:12px">欢迎使用罗德岛智能排班系统</h2>
      <p style="color:var(--ak-text-dim); margin-bottom:24px; max-width:480px; margin-left:auto; margin-right:auto">
        通过森空岛登录同步你的干员数据，系统将自动为你生成
        最优的基建设施轮换排班方案，最大化资源产出效率。
      </p>
      <router-link to="/login" class="ak-btn ak-btn-primary" style="text-decoration:none">
        开始使用 — 登录森空岛
      </router-link>
    </div>

    <div class="ak-grid ak-grid-3">
      <div class="ak-card" style="text-align:center">
        <div style="font-size:32px; margin-bottom:8px">🔐</div>
        <h3 style="font-size:15px; margin-bottom:6px">多种登录方式</h3>
        <p style="font-size:13px; color:var(--ak-text-dim)">支持森空岛Credential、账号密码、手机验证码</p>
      </div>
      <div class="ak-card" style="text-align:center">
        <div style="font-size:32px; margin-bottom:8px">⚙️</div>
        <h3 style="font-size:15px; margin-bottom:6px">智能排班算法</h3>
        <p style="font-size:13px; color:var(--ak-text-dim)">基于干员技能组合优化，自动生成A/B/C轮换方案</p>
      </div>
      <div class="ak-card" style="text-align:center">
        <div style="font-size:32px; margin-bottom:8px">🔒</div>
        <h3 style="font-size:15px; margin-bottom:6px">数据本地存储</h3>
        <p style="font-size:13px; color:var(--ak-text-dim)">所有数据存于浏览器，不上传任何服务器</p>
      </div>
    </div>
  </div>
</template>

<script setup>
</script>
