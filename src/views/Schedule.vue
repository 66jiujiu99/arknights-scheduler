<template>
  <div>
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; flex-wrap:wrap; gap:12px">
      <div>
        <h1 class="ak-page-title">排班表</h1>
        <p class="ak-page-subtitle">按你的实际基建生成 A/B 两班排班（v4：自定义设施 + 全设施 + 中枢加成）</p>
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap">
        <button class="ak-btn ak-btn-primary" :disabled="generating" @click="generate">
          <span v-if="generating" class="ak-spinner"></span>
          <span v-else>🔄 生成新方案</span>
        </button>
        <button class="ak-btn ak-btn-secondary" :disabled="!currentSchedule" @click="saveSchedule">💾 保存方案</button>
        <button class="ak-btn ak-btn-secondary" :disabled="!currentSchedule" @click="copySchedule">📋 复制文本</button>
        <button class="ak-btn ak-btn-secondary" :disabled="!currentSchedule" @click="downloadJson">⬇️ 导出 JSON</button>
      </div>
    </div>

    <div v-if="!hasUserData" class="ak-card" style="text-align:center; padding:40px">
      <p style="color:var(--ak-text-dim); margin-bottom:16px">请先登录以同步干员数据</p>
      <router-link to="/login" class="ak-btn ak-btn-primary" style="text-decoration:none">去登录</router-link>
    </div>

    <template v-else>
      <BaseConfig />

      <ak-alert v-if="!currentSchedule && !generating" type="info">
        点击「生成新方案」：系统会按上方基建配置，把控制中枢、制造站、贸易站、发电站、会客室、
        办公室、训练室、加工站、宿舍和副手全部排入 A/B 两班。制造站按产物、贸易站按策略匹配，
        并计算控制中枢的效率加成与心情消耗。
      </ak-alert>

      <div v-if="currentSchedule" class="ak-card" style="margin-top:16px">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:14px">
          <div>
            <span class="ak-card-title" style="margin-bottom:0">{{ currentSchedule.name }}</span>
            <span style="font-size:12px; color:var(--ak-text-dim); margin-left:12px">
              {{ new Date(currentSchedule.createdAt).toLocaleString() }}
            </span>
            <span style="font-size:11px; color:var(--ak-text-dim); margin-left:8px; background:var(--ak-bg-panel); padding:2px 6px; border-radius:4px">
              {{ currentSchedule.meta?.algorithm }}
            </span>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap">
            <span class="ak-tag ak-tag-yellow" style="font-size:13px">总效率：{{ currentSchedule.totalEfficiency.toFixed(1) }}</span>
            <span class="ak-tag ak-tag-red" style="font-size:13px">心情消耗：{{ currentSchedule.totalMoodCost.toFixed(2) }}/h</span>
          </div>
        </div>

        <div class="ak-tab-bar" style="overflow-x:auto; margin-bottom:14px">
          <div
            v-for="(shift, index) in currentSchedule.schedules"
            :key="shift.shift"
            class="ak-tab"
            :class="{ active: activeShift === index }"
            style="white-space:nowrap; min-width:180px"
            @click="activeShift = index"
          >
            {{ shift.label }}
            <span style="font-size:11px; color:var(--ak-text-dim); margin-left:4px">
              （效率 {{ shift.efficiency.toFixed(1) }} · 心情 {{ shift.moodCost.toFixed(2) }}/h）
            </span>
          </div>
        </div>

        <div v-if="activeShiftData" class="ak-grid ak-grid-3">
          <div v-for="station in activeShiftData.stations" :key="station.id" class="ak-facility">
            <div class="ak-facility-title" style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:8px; padding-bottom:8px; border-bottom:1px solid var(--ak-border)">
              <span>{{ station.name }}</span>
              <div style="display:flex; gap:6px; flex-wrap:wrap">
                <span v-if="station.eff > 0" class="ak-tag ak-tag-blue">效率 {{ station.eff.toFixed(1) }}</span>
                <span v-if="station.controlBonus > 0" class="ak-tag ak-tag-yellow">中枢 +{{ station.controlBonus }}%</span>
                <span v-if="station.type !== 'dormitory' && station.mood > 0" class="ak-tag" style="background:rgba(255,77,79,.12); color:#ff7875">-{{ (station.mood * occupiedCount(station)).toFixed(2) }}/h</span>
              </div>
            </div>

            <div
              v-for="op in station.ops"
              :key="op.charId"
              class="ak-facility-slot"
              :style="{ opacity: op.charId.startsWith('empty_') ? 0.4 : 1, padding: '4px', margin: '2px 0', borderRadius: '6px' }"
            >
              <div class="ak-operator-avatar" :style="{ background: avatarBg(op, station.type) }">
                {{ op.name?.charAt(0) || '?' }}
              </div>
              <div style="flex:1; min-width:0">
                <div style="font-size:13px; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis">
                  {{ op.displayName || op.name || '空位' }}
                  <span v-if="op.skill?.type === 'rest'" style="font-size:10px; color:#52c41a; margin-left:4px">休息</span>
                  <span v-else-if="op.skill?.type === 'general'" style="font-size:10px; color:var(--ak-text-dim); margin-left:4px">通用</span>
                </div>
                <div style="font-size:11px; color:var(--ak-text-dim); white-space:nowrap; overflow:hidden; text-overflow:ellipsis">
                  {{ op.skill?.desc || '无技能' }}
                </div>
              </div>
              <span v-if="op.skill?.value > 0" class="ak-tag" :class="tagClass(op.skill.value)" style="flex-shrink:0; font-size:11px">
                +{{ op.skill.value }}%
              </span>
              <span v-if="op.moodCost" class="ak-tag ak-tag-red" style="flex-shrink:0; font-size:10px">
                {{ op.moodCost.cost > 0 ? '+' : '' }}{{ op.moodCost.cost }}/h
              </span>
            </div>
          </div>
        </div>

        <div style="margin-top:14px; font-size:12px; color:var(--ak-text-dim)">
          提示：心情消耗按「站内人数 × 设施基础消耗 + 干员技能修正」估算；控制中枢加成已计入制造站/贸易站效率。
        </div>
      </div>

      <div v-if="savedSchedules.length" class="ak-card" style="margin-top:16px">
        <div class="ak-card-title">已保存的方案</div>
        <div
          v-for="saved in savedSchedules.slice().reverse()"
          :key="saved.id"
          style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; padding:10px 0; border-bottom:1px solid var(--ak-border)"
        >
          <div>
            <div style="font-size:14px; font-weight:500">{{ saved.name || '未命名方案' }}</div>
            <div style="font-size:11px; color:var(--ak-text-dim); display:flex; gap:12px; flex-wrap:wrap">
              <span>效率 {{ Number(saved.totalEfficiency || 0).toFixed(1) }}</span>
              <span v-if="saved.totalMoodCost !== undefined">心情 {{ Number(saved.totalMoodCost || 0).toFixed(2) }}/h</span>
              <span>{{ new Date(saved.createdAt).toLocaleString() }}</span>
            </div>
          </div>
          <div style="display:flex; gap:8px">
            <button class="ak-btn ak-btn-secondary" style="padding:4px 10px; font-size:12px" @click="loadSchedule(saved)">加载</button>
            <button class="ak-btn ak-btn-secondary" style="padding:4px 10px; font-size:12px" @click="deleteSchedule(saved.id)">删除</button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import AkAlert from '../components/AkAlert.vue'
import BaseConfig from '../components/BaseConfig.vue'
import { useBaseConfig } from '../composables/useBaseConfig'
import { generateSchedule, loadBaseSkills, loadCtrlSkills } from '../utils/schedulerV4'

const { config, mfCats, tradeStrategies, syncFromBuilding } = useBaseConfig()

const hasUserData = computed(() => !!localStorage.getItem('ak_user_data'))
const generating = ref(false)
const currentSchedule = ref(null)
const activeShift = ref(0)
const savedSchedules = ref(getSavedSchedules())

const activeShiftData = computed(() => currentSchedule.value?.schedules?.[activeShift.value] || null)

function getUserData() {
  try {
    return JSON.parse(localStorage.getItem('ak_user_data') || '{}')
  } catch {
    return {}
  }
}

function getSavedSchedules() {
  try {
    const list = JSON.parse(localStorage.getItem('ak_schedules') || '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

async function generate() {
  const userData = getUserData()
  if (!userData.chars || userData.chars.length === 0) {
    alert('没有干员数据，请先登录')
    return
  }
  generating.value = true
  try {
    const [skills, ctrlOps] = await Promise.all([loadBaseSkills(), loadCtrlSkills()])
    const result = generateSchedule(userData, skills, ctrlOps, config.value, mfCats.value, tradeStrategies.value)
    currentSchedule.value = result
    activeShift.value = 0
  } catch (error) {
    alert('生成失败：' + (error.message || error))
  } finally {
    generating.value = false
  }
}

function saveSchedule() {
  if (!currentSchedule.value) return
  const list = getSavedSchedules()
  const index = list.findIndex((item) => item.id === currentSchedule.value.id)
  if (index >= 0) list[index] = currentSchedule.value
  else list.push(currentSchedule.value)
  localStorage.setItem('ak_schedules', JSON.stringify(list))
  savedSchedules.value = list
  alert('方案已保存')
}

function loadSchedule(saved) {
  if (!saved.schedules?.[0]?.stations) {
    alert('这是旧版（v3）方案，设施结构不兼容，请重新生成')
    return
  }
  currentSchedule.value = saved
  activeShift.value = 0
}

function deleteSchedule(id) {
  if (!confirm('确定删除该方案？')) return
  const list = getSavedSchedules().filter((item) => item.id !== id)
  localStorage.setItem('ak_schedules', JSON.stringify(list))
  savedSchedules.value = list
  if (currentSchedule.value?.id === id) currentSchedule.value = null
}

function scheduleText() {
  if (!currentSchedule.value) return ''
  const lines = [currentSchedule.value.name, '']
  for (const shift of currentSchedule.value.schedules) {
    lines.push(`【${shift.label}】效率 ${shift.efficiency.toFixed(1)} · 心情 ${shift.moodCost.toFixed(2)}/h`)
    for (const station of shift.stations) {
      const ops = station.ops.map((op) => op.displayName || op.name).join(' / ')
      lines.push(`- ${station.name}: ${ops}`)
    }
    lines.push('')
  }
  lines.push(`总效率：${currentSchedule.value.totalEfficiency.toFixed(1)}`)
  return lines.join('\n')
}

async function copySchedule() {
  const text = scheduleText()
  try {
    await navigator.clipboard.writeText(text)
    alert('已复制排班文本')
  } catch {
    const area = document.createElement('textarea')
    area.value = text
    document.body.appendChild(area)
    area.select()
    document.execCommand('copy')
    area.remove()
    alert('已复制排班文本')
  }
}

function downloadJson() {
  if (!currentSchedule.value) return
  const blob = new Blob([JSON.stringify(currentSchedule.value, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `arknights-schedule-${currentSchedule.value.id}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

function occupiedCount(station) {
  return (station.ops || []).filter((op) => !op.charId.startsWith('empty_')).length
}

function avatarBg(op, stationType) {
  if (op.charId.startsWith('empty_')) return 'var(--ak-border)'
  if (stationType === 'dormitory') return 'rgba(82,196,26,0.2)'
  if (op.skill?.value > 25) return 'rgba(245,197,24,0.25)'
  if (op.skill?.value > 15) return 'rgba(82,196,26,0.2)'
  if (op.skill?.value > 0) return 'rgba(24,144,255,0.15)'
  return 'var(--ak-bg-panel)'
}

function tagClass(value) {
  if (value > 25) return 'ak-tag-yellow'
  if (value > 15) return 'ak-tag-green'
  return 'ak-tag-blue'
}

onMounted(() => {
  const userData = getUserData()
  if (userData.building && Object.keys(userData.building).length && !localStorage.getItem('ak_base_config')) {
    syncFromBuilding(userData.building, true)
  }
})
</script>
