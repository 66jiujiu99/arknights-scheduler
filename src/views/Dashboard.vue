<template>
  <div>
    <h1 class="ak-page-title">总览</h1>
    <p class="ak-page-subtitle">欢迎回来，{{ userData.nickname || '博士' }}</p>

    <div class="ak-grid ak-grid-4" style="margin-bottom:24px">
      <div class="ak-card" style="text-align:center">
        <div style="font-size:28px; color:var(--ak-accent2)">{{ userData.chars?.length || 0 }}</div>
        <div style="font-size:13px; color:var(--ak-text-dim)">已拥有干员</div>
      </div>
      <div class="ak-card" style="text-align:center">
        <div style="font-size:28px; color:var(--ak-green)">{{ usedOperators }}</div>
        <div style="font-size:13px; color:var(--ak-text-dim)">基建可用干员</div>
      </div>
      <div class="ak-card" style="text-align:center">
        <div style="font-size:28px; color:var(--ak-blue)">{{ facilities }}</div>
        <div style="font-size:13px; color:var(--ak-text-dim)">基建设施</div>
      </div>
      <div class="ak-card" style="text-align:center">
        <div style="font-size:28px; color:var(--ak-accent)">~{{ suggestInterval }}h</div>
        <div style="font-size:13px; color:var(--ak-text-dim)">建议换班间隔</div>
      </div>
    </div>

    <div class="ak-grid ak-grid-2">
      <div class="ak-card">
        <div class="ak-card-title">最新排班方案</div>
        <div v-if="savedSchedules.length === 0" style="color:var(--ak-text-dim); font-size:14px; padding:12px 0">
          还没有保存的排班方案，前往排班表页面生成
        </div>
        <div v-for="s in savedSchedules.slice(-3).reverse()" :key="s.id" 
             style="padding:10px 0; border-bottom:1px solid var(--ak-border); font-size:14px; display:flex; justify-content:space-between">
          <span>{{ s.name || '未命名方案' }}</span>
          <span style="color:var(--ak-text-dim); font-size:12px">{{ new Date(s.createdAt).toLocaleDateString() }}</span>
        </div>
        <router-link to="/schedule" class="ak-btn ak-btn-secondary" style="margin-top:12px; font-size:13px">
          生成新排班
        </router-link>
      </div>

      <div class="ak-card">
        <div class="ak-card-title">干员速览</div>
        <div style="display:flex; flex-wrap:wrap; gap:6px">
          <span v-for="c in topOperators" :key="c.id" class="ak-tag" 
                :class="c.rarity >= 5 ? 'ak-tag-yellow' : c.rarity >= 4 ? 'ak-tag-blue' : 'ak-tag-green'">
            {{ c.name }}
          </span>
        </div>
        <div style="margin-top:12px; font-size:13px; color:var(--ak-text-dim)">
          共 {{ userData.chars?.length || 0 }} 名干员
        </div>
        <router-link to="/operators" class="ak-btn ak-btn-secondary" style="margin-top:12px; font-size:13px">管理干员</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

const userData = computed(() => {
  try {
    return JSON.parse(localStorage.getItem('ak_user_data') || '{}')
  } catch { return {} }
})

const usedOperators = computed(() => {
  return userData.value.chars?.filter(c => c.level >= 1).length || 0
})

const facilities = computed(() => {
  const b = userData.value.building || {}
  let count = 0
  for (const key of ['tradings', 'manufactures', 'dormitories']) {
    count += (b[key] || []).length
  }
  return count
})

const suggestInterval = computed(() => {
  return 12
})

const savedSchedules = computed(() => {
  try {
    return JSON.parse(localStorage.getItem('ak_schedules') || '[]')
  } catch { return [] }
})

const topOperators = computed(() => {
  return (userData.value.chars || []).slice(0, 12)
})
</script>
