<template>
  <div id="ak-app">
    <nav class="ak-nav">
      <div class="ak-nav-inner">
        <router-link to="/" class="ak-logo">
          <span class="ak-logo-mark">◇</span>
          <span class="ak-logo-text">罗德岛排班 <small>v5</small></span>
        </router-link>
        <div class="ak-nav-links">
          <router-link v-if="store.session" to="/setup" class="ak-nav-link">基建配置</router-link>
          <router-link v-if="store.session" to="/plan" class="ak-nav-link">排班方案</router-link>
          <router-link to="/about" class="ak-nav-link">说明</router-link>
          <template v-if="store.session">
            <span class="ak-nav-user">{{ store.session.profile.nickname || '博士' }} · Lv{{ store.session.profile.level }}</span>
            <button class="ak-btn-ghost" @click="signOut">退出</button>
          </template>
        </div>
      </div>
    </nav>
    <main class="ak-main">
      <router-view />
    </main>
    <footer class="ak-footer">
      <span>凭证只保存在你的浏览器；本站为纯静态页面，不上传任何数据。</span>
      <router-link to="/about">隐私与说明</router-link>
    </footer>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { store, logout } from './stores/session'

const router = useRouter()

async function signOut() {
  await logout()
  router.push({ name: 'Login' })
}
</script>
