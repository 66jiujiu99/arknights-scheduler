<template>
  <div>
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px">
      <div>
        <h1 class="ak-page-title">排班表</h1>
        <p class="ak-page-subtitle">自动生成最优基建设施轮换方案（v3: 全局最优+组合加成+心情管理）</p>
      </div>
      <div style="display:flex; gap:8px">
        <button class="ak-btn ak-btn-primary" @click="generate" :disabled="generating">
          <span v-if="generating" class="ak-spinner"></span>
          <span v-else>🔄 生成新方案</span>
        </button>
        <button class="ak-btn ak-btn-secondary" @click="optimize" :disabled="generating || !currentSchedule">
          ⚡ 局部优化
        </button>
      </div>
    </div>

    <div v-if="!hasUserData" class="ak-card" style="text-align:center; padding:40px">
      <p style="color:var(--ak-text-dim); margin-bottom:16px">请先登录以同步干员数据</p>
      <router-link to="/login" class="ak-btn ak-btn-primary" style="text-decoration:none">去登录</router-link>
    </div>

    <template v-else>
      <ak-alert type="info" v-if="!currentSchedule && !generating">
        点击「生成新方案」按钮，系统将根据你的干员列表和基建设施自动计算出最优排班。
        <br>算法 v3：全局联合优化、技能组合加成（巫恋+龙舌兰等）、24h心情动态管理、真三班倒(8h/班)、配方/订单感知匹配。
      </ak-alert>

      <!-- 当前排班 -->
      <div v-if="currentSchedule">
        <div class="ak-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:8px">
            <div>
              <span class="ak-card-title" style="margin-bottom:0">{{ currentSchedule.name }}</span>
              <span style="font-size:12px; color:var(--ak-text-dim); margin-left:12px">
                {{ new Date(currentSchedule.createdAt).toLocaleString() }}
              </span>
              <span v-if="currentSchedule.meta" style="font-size:11px; color:var(--ak-text-dim); margin-left:8px; background:var(--ak-bg-panel); padding:2px 6px; border-radius:4px">
                {{ currentSchedule.meta.algorithm }}
              </span>
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap">
              <span class="ak-tag ak-tag-yellow" style="font-size:13px">效率: {{ currentSchedule.totalEfficiency.toFixed(1) }}</span>
              <span class="ak-tag ak-tag-green" style="font-size:13px">心情恢复: +{{ currentSchedule.totalMoodRecovery?.toFixed(1) || 0 }}</span>
              <span class="ak-tag ak-tag-red" style="font-size:13px">心情消耗: -{{ currentSchedule.totalMoodCost?.toFixed(1) || 0 }}</span>
              <span class="ak-tag ak-tag-purple" style="font-size:13px">净分: {{ currentSchedule.totalNetScore?.toFixed(1) || 0 }}</span>
              <button class="ak-btn ak-btn-secondary" style="padding:6px 12px; font-size:12px" @click="saveSchedule">💾 保存方案</button>
            </div>
          </div>

          <!-- 检测到的组合加成 -->
          <div v-if="currentSchedule.meta?.combosDetected?.length" class="ak-card" style="margin-bottom:16px; background:rgba(245,197,24,0.1); border-color:rgba(245,197,24,0.3)">
            <div class="ak-card-title" style="color:#f5c518; margin-bottom:8px">🎯 检测到的组合加成</div>
            <div style="display:flex; flex-wrap:wrap; gap:8px">
              <span v-for="c in currentSchedule.meta.combosDetected" :key="c.shift+'-'+c.facility+'-'+c.desc" 
                    class="ak-tag" style="background:rgba(245,197,24,0.2); color:#f5c518; font-size:11px">
                {{ ['早班','中班','晚班'][c.shift-1] }} {{ FACILITY_LABELS[c.facility] }}: {{ c.desc }} (+{{ (c.bonus*100).toFixed(0) }%)
              </span>
            </div>
          </div>

          <!-- 三班切换 -->
          <div class="ak-tab-bar" style="margin-bottom:16px; overflow-x:auto">
            <div v-for="s in currentSchedule.schedules" :key="s.shift"
                 class="ak-tab" :class="{ active: activeShift === s.shift }"
                 @click="activeShift = s.shift"
                 style="white-space:nowrap; min-width:140px">
              {{ s.label }} 
              <span style="font-size:11px; color:var(--ak-text-dim); margin-left:4px">
                (效率: {{ s.efficiency.toFixed(1) }} | 净分: {{ s.netScore?.toFixed(1) || 0 }})
              </span>
            </div>
          </div>

          <!-- 班次汇总统计 -->
          <div class="ak-grid ak-grid-3" style="margin-bottom:16px">
            <div class="ak-facility" style="background:var(--ak-bg-panel); border-radius:8px; padding:12px; text-align:center">
              <div style="font-size:11px; color:var(--ak-text-dim)">总效率产出</div>
              <div style="font-size:20px; font-weight:600; color:var(--ak-text)">{{ currentSchedule.totalEfficiency.toFixed(1) }}</div>
            </div>
            <div class="ak-facility" style="background:var(--ak-bg-panel); border-radius:8px; padding:12px; text-align:center">
              <div style="font-size:11px; color:var(--ak-text-dim)">心情净变化</div>
              <div style="font-size:20px; font-weight:600" :style="{ color: (currentSchedule.totalMoodRecovery || 0) > (currentSchedule.totalMoodCost || 0) ? '#52c41a' : '#ff4d4f' }">
                {{ ((currentSchedule.totalMoodRecovery || 0) - (currentSchedule.totalMoodCost || 0)).toFixed(1) }}
              </div>
            </div>
            <div class="ak-facility" style="background:var(--ak-bg-panel); border-radius:8px; padding:12px; text-align:center">
              <div style="font-size:11px; color:var(--ak-text-dim)">综合净分</div>
              <div style="font-size:20px; font-weight:600; color:#722ed1">{{ currentSchedule.totalNetScore?.toFixed(1) || 0 }}</div>
            </div>
          </div>

          <!-- 当前班次的设施排班 -->
          <div class="ak-grid ak-grid-3" v-if="activeData">
            <div v-for="(ops, facility) in activeData" :key="facility" class="ak-facility">
              <div class="ak-facility-title" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding-bottom:8px; border-bottom:1px solid var(--ak-border)">
                <span>{{ FACILITY_LABELS[facility] || facility }}</span>
                <div style="display:flex; gap:8px; font-size:11px">
                  <span v-if="getShiftFacilityEfficiency(facility) > 0" class="ak-tag ak-tag-blue">效率: {{ getShiftFacilityEfficiency(facility).toFixed(1) }}</span>
                  <span v-if="getShiftFacilityMoodCost(facility) > 0" class="ak-tag ak-tag-red">心情: -{{ getShiftFacilityMoodCost(facility).toFixed(1) }}</span>
                  <span v-if="getShiftFacilityMoodRecovery(facility) > 0" class="ak-tag ak-tag-green">恢复: +{{ getShiftFacilityMoodRecovery(facility).toFixed(1) }}</span>
                </div>
              </div>
              <div v-for="op in ops" :key="op.id" class="ak-facility-slot" 
                   :style="{ opacity: op.id.startsWith('empty_') ? 0.4 : 1, background: op.currentSkill?.type === 'rest' ? 'rgba(82,196,26,0.1)' : 'transparent', borderRadius: '6px', padding: '4px', margin: '2px 0' }">
                <div class="ak-operator-avatar" 
                     :style="{ background: getAvatarBg(op) }">
                  {{ op.name?.charAt(0) || '?' }}
                </div>
                <div style="flex:1; min-width:0">
                  <div style="font-size:13px; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis">
                    {{ op.displayName || op.name || '空位' }}
                    <span v-if="op.currentSkill?.type === 'general'" style="font-size:10px; color:var(--ak-text-dim); margin-left:4px">(通用)</span>
                    <span v-if="op.currentSkill?.type === 'rest'" style="font-size:10px; color:#52c41a; margin-left:4px">(休息)</span>
                    <span v-if="isInCombo(op, facility)" style="font-size:10px; color:#f5c518; margin-left:4px">★组合</span>
                  </div>
                  <div style="font-size:11px; color:var(--ak-text-dim); white-space:nowrap; overflow:hidden; text-overflow:ellipsis">
                    {{ op.currentSkill?.desc || '无技能' }}
                  </div>
                </div>
                <span v-if="op.currentSkill?.value > 0" class="ak-tag" 
                      :class="getTagClass(op.currentSkill.value)"
                      style="flex-shrink:0; font-size:11px">
                  +{{ op.currentSkill.value }}%
                </span>
                <span v-else-if="op.currentSkill?.type === 'rest'" class="ak-tag ak-tag-green" style="flex-shrink:0; font-size:11px">
                  休息
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
             style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--ak-border); flex-wrap:wrap; gap:8px">
          <div style="min-width:200px">
            <div style="font-size:14px; font-weight:500">{{ s.name }}</div>
            <div style="font-size:11px; color:var(--ak-text-dim); display:flex; gap:12px; flex-wrap:wrap">
              <span>效率: {{ s.totalEfficiency?.toFixed(1) || s.totalEfficiency }}</span>
              <span v-if="s.totalNetScore !== undefined">净分: {{ s.totalNetScore.toFixed(1) }}</span>
              <span v-if="s.totalMoodRecovery !== undefined">心情恢复: +{{ s.totalMoodRecovery.toFixed(1) }}</span>
              <span v-if="s.totalMoodCost !== undefined">心情消耗: -{{ s.totalMoodCost.toFixed(1) }}</span>
              <span>{{ new Date(s.createdAt).toLocaleString() }}</span>
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
import { generateSchedule, optimizeSchedule, FACILITY_CONFIG, SHIFT_HOURS } from '../utils/scheduler.js'

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

const activeShiftData = computed(() => {
  if (!currentSchedule.value) return null
  return currentSchedule.value.schedules.find(s => s.shift === activeShift.value) || null
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

function optimize() {
  if (!currentSchedule.value) return
  generating.value = true
  try {
    const userData = JSON.parse(localStorage.getItem('ak_user_data') || '{}')
    const optimized = optimizeSchedule(currentSchedule.value, userData)
    currentSchedule.value = optimized
    activeShift.value = 1
    
    const schedules = getCachedSchedules()
    const idx = schedules.findIndex(s => s.id === optimized.id)
    if (idx >= 0) schedules[idx] = optimized
    else schedules.push(optimized)
    localStorage.setItem('ak_schedules', JSON.stringify(schedules))
    savedSchedules.value = schedules
  } catch (e) {
    alert('优化失败: ' + e.message)
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
  if (currentSchedule.value?.id === id) currentSchedule.value = null
}

function getAvatarBg(op) {
  if (op.id.startsWith('empty_')) return 'var(--ak-border)'
  if (op.currentSkill?.type === 'rest') return 'rgba(82,196,26,0.2)'
  if (op.currentSkill?.value > 25) return 'rgba(245,197,24,0.25)'
  if (op.currentSkill?.value > 15) return 'rgba(82,196,26,0.2)'
  if (op.currentSkill?.value > 0) return 'rgba(24,144,255,0.15)'
  return 'var(--ak-bg-panel)'
}

function getTagClass(value) {
  if (value > 25) return 'ak-tag-yellow'
  if (value > 15) return 'ak-tag-green'
  return 'ak-tag-blue'
}

function isInCombo(op, facility) {
  if (!currentSchedule.value?.meta?.combosDetected) return false
  const shift = currentSchedule.value.schedules.find(s => s.shift === activeShift.value)
  if (!shift) return false
  for (const combo of currentSchedule.value.meta.combosDetected) {
    if (combo.shift !== activeShift.value || combo.facility !== facility) continue
    if (combo.ids.includes(op.id)) return true
  }
  return false
}

function getShiftFacilityEfficiency(facility) {
  const shift = activeShiftData.value
  if (!shift) return 0
  const ops = shift.facilities[facility] || []
  return ops.reduce((sum, op) => sum + (op.currentSkill?.value || 0), 0)
}

function getShiftFacilityMoodCost(facility) {
  const shift = activeShiftData.value
  if (!shift) return 0
  if (facility === 'dormitory' || facility === 'training') return 0
  const ops = shift.facilities[facility] || []
  return ops.filter(op => !op.id.startsWith('empty_') && op.currentSkill?.value > 0).length * FACILITY_CONFIG[facility]?.moodCost * SHIFT_HOURS
}

function getShiftFacilityMoodRecovery(facility) {
  const shift = activeShiftData.value
  if (!shift || facility !== 'dormitory') return 0
  const ops = shift.facilities[facility] || []
  return ops.filter(op => !op.id.startsWith('empty_') && op.currentSkill?.type === 'mood').length * 0.65 * 8
}

// 初始化
savedSchedules.value = getCachedSchedules()
</script>