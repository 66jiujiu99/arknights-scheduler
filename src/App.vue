<template>
  <div id="ak-app">
    <nav class="ak-nav" v-if="showNav">
      <div class="ak-nav-inner">
        <router-link to="/" class="ak-logo">
          <span class="ak-logo-icon">◇</span>
          <span class="ak-logo-text">罗德岛智能排班</span>
        </router-link>
        <div class="ak-nav-links" v-if="isLoggedIn">
          <router-link to="/dashboard" class="ak-nav-link">总览</router-link>
          <router-link to="/schedule" class="ak-nav-link">排班表</router-link>
          <router-link to="/operators" class="ak-nav-link">干员管理</router-link>
          <button @click="logout" class="ak-btn-logout">退出登录</button>
        </div>
      </div>
    </nav>
    <main class="ak-main">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

const showNav = computed(() => route.name !== 'Login')
const isLoggedIn = computed(() => !!localStorage.getItem('ak_user_data'))

function logout() {
  localStorage.removeItem('ak_user_data')
  localStorage.removeItem('ak_cred')
  router.push({ name: 'Login' })
}
</script>
