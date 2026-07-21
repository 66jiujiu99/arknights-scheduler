<template>
  <div>
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px">
      <div>
        <h1 class="ak-page-title">排班表</h1>
        <p class="ak-page-subtitle">自动生成最优基建设施轮换方案</p>
      </div>
      <button class="ak-btn ak-btn-primary" @click="generate" :disabled="generating">
        <span v-if="generating" class="ak-spinner"></span>
        <span v-else>🔄 生成新方案</span>
      </button>
    </div>

    <div v-if="!hasUserData" class="ak-card" style="text-align:center; padding:40px">
      <p style="color:var(--ak-text-dim); margin-bottom:16px">请先登录以同步干员数据</p>
      <router-link to="/login" class="ak-btn ak-btn-primary" style="text-decoration:none">去登录</router-link>
    </div>

    <template v-else>
      <ak-alert type="info" v-if="!currentSchedule && !generating">
        点击「生成新方案」按钮，系统将根据你的干员列表和基建设施自动计算出最优排班。
        <br>算法会考虑：干员基建技能、技能组合加成（巫恋+龙舌兰等）、A/B/C三班轮换。
      </ak-alert>

      <!-- 当前排班 -->
      <div v-if="currentSchedule">
        <div class="ak-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px">
            <div>
              <span class="ak-card-title" style="margin-bottom:0">{{ currentSchedule.name }}</span>
              <span style="font-size:12px; color:var(--ak-text-dim); margin-left:12px">
                {{ new Date(currentSchedule.createdAt).toLocaleString() }}
              </span>
            </div>
            <div>
              <span class="ak-tag ak-tag-yellow" style="font-size:14px">综合效率评分: {{ currentSchedule.totalEfficiency }}</span>
              <button class="ak-btn ak-btn-secondary" style="margin-left:8px; padding:6px 12px; font-size:12px" @click="saveSchedule">💾 保存方案</button>
            </div>
          </div>

          <!-- 三班切换 -->
          <div class="ak-tab-bar" style="margin-bottom:16px">
            <div v-for="s in currentSchedule.schedules" :key="s.shift"
                 class="ak-tab" :class="{ active: activeShift === s.shift }"
                 @click="activeShift = s.shift">
              {{ s.label }} <span style="font-size:12px; color:var(--ak-text-dim)">(效率: {{ s.efficiency }})</span>
            </div>
          </div>

          <!-- 当前班次的设施排班 -->
          <div class="ak-grid ak-grid-3" v-if="activeData">
            <div v-for="(ops, facility) in activeData" :key="facility" class="ak-facility">
              <div class="ak-facility-title">
                <span>{{ FACILITY_LABELS[facility] || facility }}</span>
                <span style="font-size:12px; color:var(--ak-text-dim)">{{ ops.length }}人</span>
              </div>
              <div v-for="op in ops" :key="op.id" class="ak-facility-slot">
                <div class="ak-operator-avatar" 
                     :style="{ background: op.isGeneral ? 'var(--ak-border)' : op.baseSkill?.value > 20 ? 'rgba(245,197,24,0.2)' : 'var(--ak-bg-panel)' }">
                  {{ op.name?.charAt(0) || '?' }}
                </div>
                <div style="flex:1">
                  <div style="font-size:13px; font-weight:500">
                    {{ op.name || '空位' }}
                    <span v-if="op.isGeneral" style="font-size:11px; color:var(--ak-text-dim)">(通用)</span>
                  </div>
                  <div style="font-size:11px; color:var(--ak-text-dim)">
                    {{ op.baseSkill?.desc || '无技能' }}
                  </div>
                </div>
                <span v-if="op.baseSkill?.value > 0" class="ak-tag" 
                      :class="op.baseSkill.value > 25 ? 'ak-tag-yellow' : op.baseSkill.value > 15 ? 'ak-tag-green' : 'ak-tag-blue'"
                      style="flex-shrink:0">
                  +{{ op.baseSkill.value }}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 已保存的方案列表 -->
      <div class="ak-card" v-if="savedSchedules.length > 0">
        <div class="ak-card-title">已保存的方案</div>
        <div v-for="s in savedSchedules" :key="s.id"
             style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--ak-border)">
          <div>
            <div style="font-size:14px; font-weight:500">{{ s.name }}</div>
            <div style="font-size:12px; color:var(--ak-text-dim)">
              综合效率: {{ s.totalEfficiency }} | {{ new Date(s.createdAt).toLocaleString() }}
            </div>
          </div>
          <div style="display:flex; gap:8px">
            <button class="ak-btn ak-btn-secondary" style="padding:4px 10px; font-size:12px" @click="loadSchedule(s)">加载</button>
            <button class="ak-btn ak-btn-secondary" style="padding:4px 10px; font-size:12px" @click="deleteSchedule(s.id)">删除</button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'
import AkAlert from '../components/AkAlert.vue'
import { generateSchedule } from '../utils/scheduler.js'

const FACILITY_LABELS = {
  manufacture: '🏭 制造站',
  trading: '💰 贸易站',
  power: '⚡ 发电站',
  dormitory: '🛏️ 宿舍',
  meeting: '🤝 会客室',
  training: '📚 训练室',
}

const hasUserData = computed(() => !!localStorage.getItem('ak_user_data'))
const generating = ref(false)
const currentSchedule = ref(null)
const activeShift = ref(1)
const savedSchedules = ref([])

const activeData = computed(() => {
  if (!currentSchedule.value) return null
  const shift = currentSchedule.value.schedules.find(s => s.shift === activeShift.value)
  return shift?.facilities || null
})

function getCachedSchedules() {
  try {
    return JSON.parse(localStorage.getItem('ak_schedules') || '[]')
  } catch { return [] }
}

function generate() {
  generating.value = true
  try {
    const userData = JSON.parse(localStorage.getItem('ak_user_data') || '{}')
    const result = generateSchedule(userData)
    currentSchedule.value = result
    activeShift.value = 1
    
    // 自动保存
    const schedules = getCachedSchedules()
    schedules.push(result)
    localStorage.setItem('ak_schedules', JSON.stringify(schedules))
    savedSchedules.value = schedules
  } catch (e) {
    alert('生成失败: ' + e.message)
  } finally {
    generating.value = false
  }
}

function saveSchedule() {
  if (!currentSchedule.value) return
  const schedules = getCachedSchedules()
  const idx = schedules.findIndex(s => s.id === currentSchedule.value.id)
  if (idx >= 0) {
    schedules[idx] = currentSchedule.value
  } else {
    schedules.push(currentSchedule.value)
  }
  localStorage.setItem('ak_schedules', JSON.stringify(schedules))
  savedSchedules.value = schedules
  alert('方案已保存')
}

function loadSchedule(s) {
  currentSchedule.value = s
  activeShift.value = 1
}

function deleteSchedule(id) {
  let schedules = getCachedSchedules()
  schedules = schedules.filter(s => s.id !== id)
  localStorage.setItem('ak_schedules', JSON.stringify(schedules))
  savedSchedules.value = schedules
}

// 初始化
savedSchedules.value = getCachedSchedules()
</script>
