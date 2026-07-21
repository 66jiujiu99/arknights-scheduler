<template>
  <div>
    <h1 class="ak-page-title">干员管理</h1>
    <p class="ak-page-subtitle">管理你的干员数据和基建技能（共 {{ operators.length }} 名）</p>

    <div class="ak-card" style="margin-bottom:16px">
      <div style="display:flex; gap:12px; align-items:center">
        <input v-model="searchQuery" class="ak-input" placeholder="搜索干员名称..." style="max-width:300px" />
        <span style="font-size:13px; color:var(--ak-text-dim); flex:1">
          {{ filteredOps.length }} 名匹配
        </span>
        <button class="ak-btn ak-btn-secondary" style="font-size:12px; padding:6px 12px" @click="showAddForm = !showAddForm">
          {{ showAddForm ? '收起' : '+ 添加干员' }}
        </button>
        <button class="ak-btn ak-btn-secondary" style="font-size:12px; padding:6px 12px" @click="resetData">
          🔄 重新同步
        </button>
      </div>
    </div>

    <!-- 添加干员表单 -->
    <div v-if="showAddForm" class="ak-card">
      <div class="ak-card-title">手动添加干员</div>
      <div class="ak-grid ak-grid-4" style="align-items:end">
        <div class="ak-form-group">
          <label class="ak-label">干员名称</label>
          <input v-model="newOp.name" class="ak-input" placeholder="如：银灰" />
        </div>
        <div class="ak-form-group">
          <label class="ak-label">稀有度</label>
          <select v-model="newOp.rarity" class="ak-input">
            <option :value="3">3星</option>
            <option :value="4">4星</option>
            <option :value="5">5星</option>
            <option :value="6">6星</option>
          </select>
        </div>
        <div class="ak-form-group">
          <label class="ak-label">等级</label>
          <input v-model="newOp.level" class="ak-input" type="number" placeholder="等级" />
        </div>
        <div class="ak-form-group">
          <label class="ak-label">基建技能</label>
          <select v-model="newOp.baseSkill" class="ak-input">
            <option value="">无特殊技能</option>
            <option value="manufacture">制造站 - 生产力</option>
            <option value="trading">贸易站 - 订单效率</option>
            <option value="power">发电站 - 无人机</option>
            <option value="dormitory">宿舍 - 心情恢复</option>
          </select>
        </div>
      </div>
      <button class="ak-btn ak-btn-primary" @click="addOperator" style="margin-top:8px">添加</button>
    </div>

    <!-- 干员列表 -->
    <div class="ak-card" style="padding:0">
      <table class="ak-schedule-table">
        <thead>
          <tr>
            <th>干员</th>
            <th>稀有度</th>
            <th>等级</th>
            <th>基建技能</th>
            <th>效率</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="op in filteredOps" :key="op.id">
            <td>
              <div class="ak-operator-name">
                <div class="ak-operator-avatar" :style="{ background: op.rarity >= 5 ? 'rgba(245,197,24,0.2)' : op.rarity >= 4 ? 'rgba(83,152,255,0.2)' : 'var(--ak-bg-panel)' }">
                  {{ op.name?.charAt(0) || '?' }}
                </div>
                {{ op.name || '未知' }}
              </div>
            </td>
            <td>
              <span class="ak-tag" :class="op.rarity >= 5 ? 'ak-tag-yellow' : op.rarity >= 4 ? 'ak-tag-blue' : 'ak-tag-green'">
                ★{{ op.rarity || 1 }}
              </span>
            </td>
            <td>{{ op.level || '-' }}</td>
            <td style="font-size:12px; color:var(--ak-text-dim)">{{ op.baseSkill?.desc || op.skillDesc || '无' }}</td>
            <td>
              <span v-if="op.baseSkill?.value > 0" class="ak-tag ak-tag-green">+{{ op.baseSkill.value }}%</span>
            </td>
            <td>
              <button class="ak-btn ak-btn-secondary" style="padding:2px 8px; font-size:11px" @click="removeOperator(op.id)">移除</button>
            </td>
          </tr>
          <tr v-if="filteredOps.length === 0">
            <td colspan="6" style="text-align:center; color:var(--ak-text-dim); padding:40px">暂无干员数据，请先登录同步</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const searchQuery = ref('')
const showAddForm = ref(false)
const newOp = ref({ name: '', rarity: 5, level: 1, baseSkill: '' })

function getOperators() {
  try {
    const data = JSON.parse(localStorage.getItem('ak_user_data') || '{}')
    return data.chars || []
  } catch { return [] }
}

function saveOperators(ops) {
  const data = JSON.parse(localStorage.getItem('ak_user_data') || '{}')
  data.chars = ops
  localStorage.setItem('ak_user_data', JSON.stringify(data))
}

const operators = computed(() => getOperators())

const filteredOps = computed(() => {
  if (!searchQuery.value) return operators.value
  return operators.value.filter(o => 
    (o.name || '').toLowerCase().includes(searchQuery.value.toLowerCase())
  )
})

function addOperator() {
  if (!newOp.value.name) return
  const ops = getOperators()
  ops.push({
    id: `manual_${Date.now()}`,
    name: newOp.value.name,
    rarity: newOp.value.rarity,
    level: newOp.value.level,
    skillDesc: newOp.value.baseSkill ? `${newOp.value.baseSkill}相关技能` : '无',
  })
  saveOperators(ops)
  newOp.value = { name: '', rarity: 5, level: 1, baseSkill: '' }
}

function removeOperator(id) {
  if (!confirm('确定移除该干员？')) return
  const ops = getOperators().filter(o => o.id !== id)
  saveOperators(ops)
}

function resetData() {
  if (!confirm('重新同步将清空当前干员数据并从森空岛重新获取，确定？')) return
  localStorage.removeItem('ak_user_data')
  localStorage.removeItem('ak_cred')
  window.location.reload()
}
</script>
