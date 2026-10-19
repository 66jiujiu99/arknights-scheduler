<template>
  <div class="ak-card">
    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap; margin-bottom:14px">
      <div>
        <div class="ak-card-title" style="margin-bottom:4px">🏗️ 自定义基建配置</div>
        <p style="font-size:12px; color:var(--ak-text-dim); margin:0; line-height:1.6">
          按你实际的基建填写。左侧 9 格点击切换：制造站 → 贸易站 → 发电站。
          配置只保存在浏览器本地，用于生成排班。
        </p>
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap">
        <button class="ak-btn ak-btn-secondary" type="button" @click="syncFromGame">按游戏数据同步</button>
        <button class="ak-btn ak-btn-secondary" type="button" @click="reset">恢复默认</button>
      </div>
    </div>

    <div class="ak-grid ak-grid-2" style="align-items:start">
      <div>
        <div class="ak-form-group">
          <label class="ak-label">控制中枢等级（决定可进驻人数与设施等级上限）</label>
          <select v-model.number="config.controlLevel" class="ak-input">
            <option v-for="level in 5" :key="level" :value="level">Lv.{{ level }} → {{ level }} 人</option>
          </select>
        </div>

        <div class="ak-label" style="margin-bottom:6px">左侧九宫格</div>
        <div class="base-grid">
          <button
            v-for="(type, index) in config.grid"
            :key="index"
            type="button"
            class="base-grid-cell"
            :style="cellStyle(type)"
            :title="`点击切换（当前：${roomName(type)}）`"
            @click="cycleCell(index)"
          >
            {{ roomName(type) }}
          </button>
        </div>

        <div style="margin-top:10px; font-size:12px; color:var(--ak-text-dim); display:flex; gap:12px; flex-wrap:wrap">
          <span>制造站 ×{{ counts.MANUFACTURE }}</span>
          <span>贸易站 ×{{ counts.TRADING }}</span>
          <span>发电站 ×{{ counts.POWER }}</span>
          <span>宿舍 ×{{ config.dorms }}</span>
        </div>
      </div>

      <div>
        <div class="ak-label" style="margin-bottom:6px">设施等级</div>
        <div class="base-levels">
          <label v-for="room in levelRooms" :key="room.type" class="base-level-item">
            <span>{{ room.name }} · {{ slotsOf(room.type) }} 人</span>
            <select v-model.number="config.levels[room.type]" class="ak-input" style="padding:3px 6px; font-size:12px">
              <option v-for="level in room.maxLevel" :key="level" :value="level">Lv.{{ level }}</option>
            </select>
          </label>
        </div>

        <div class="ak-form-group" style="margin-top:12px">
          <label class="ak-label">宿舍数量</label>
          <select v-model.number="config.dorms" class="ak-input">
            <option v-for="count in 4" :key="count" :value="count">{{ count }} 间（{{ count * 5 }} 人）</option>
          </select>
        </div>
        <label class="base-check">
          <input v-model="config.useAssistant" type="checkbox" />
          启用基建副手（{{ assistantSlots }} 人）
        </label>
      </div>
    </div>

    <div v-if="counts.MANUFACTURE > 0 || counts.TRADING > 0" class="base-production">
      <div v-for="index in counts.MANUFACTURE" :key="'mf-' + index" class="base-production-row">
        <span class="base-production-label" style="color:#5ddf5d">制造站{{ index }}</span>
        <button
          v-for="category in MF_CATS"
          :key="category"
          type="button"
          class="base-chip"
          :class="{ active: mfCats[index - 1] === category }"
          @click="setMfCat(index - 1, category)"
        >{{ category }}</button>
      </div>
      <div v-for="index in counts.TRADING" :key="'tr-' + index" class="base-production-row">
        <span class="base-production-label" style="color:#6bb5ff">贸易站{{ index }}</span>
        <button
          v-for="strategy in TRADE_STRATEGIES"
          :key="strategy"
          type="button"
          class="base-chip"
          :class="{ active: tradeStrategies[index - 1] === strategy }"
          @click="setTradeStrategy(index - 1, strategy)"
        >{{ strategy }}</button>
      </div>
    </div>

    <div class="base-summary">{{ summary }}</div>
    <div v-if="issues.length" class="base-issues">⚠️ {{ issues.join('；') }}</div>
  </div>
</template>

<script setup>
import { useBaseConfig } from '../composables/useBaseConfig'
import { ROOM_TYPES } from '../utils/schedulerV4'

const {
  config,
  counts,
  issues,
  summary,
  assistantSlots,
  levelRooms,
  mfCats,
  tradeStrategies,
  MF_CATS,
  TRADE_STRATEGIES,
  cycleCell,
  setMfCat,
  setTradeStrategy,
  syncFromBuilding,
  resetConfig,
  slotsOf,
} = useBaseConfig()

const roomName = (type) => ROOM_TYPES[type]?.name || type

function cellStyle(type) {
  const info = ROOM_TYPES[type]
  return {
    borderColor: `${info.color}66`,
    background: `${info.color}1a`,
    color: info.color,
  }
}

function syncFromGame() {
  try {
    const data = JSON.parse(localStorage.getItem('ak_user_data') || '{}')
    if (!data.building || Object.keys(data.building).length === 0) {
      alert('请先登录获取游戏数据')
      return
    }
    syncFromBuilding(data.building, true)
    alert('已按游戏数据同步基建配置')
  } catch (error) {
    alert('同步失败：' + (error.message || error))
  }
}

function reset() {
  if (!confirm('恢复默认基建配置（5 制造 / 3 贸易 / 3 发电，中枢 Lv.5）？')) return
  resetConfig()
}
</script>

<style scoped>
.base-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  max-width: 280px;
}
.base-grid-cell {
  cursor: pointer;
  text-align: center;
  padding: 10px 2px;
  border-radius: 6px;
  font-size: 11px;
  letter-spacing: 0.5px;
  border: 1px solid transparent;
  background: transparent;
  font-family: inherit;
}
.base-levels {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.base-level-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 11px;
  color: var(--ak-text-dim);
}
.base-check {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  font-size: 12px;
  color: var(--ak-text-dim);
  cursor: pointer;
}
.base-production {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--ak-border);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.base-production-row {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}
.base-production-label {
  font-size: 11px;
  width: 62px;
  flex-shrink: 0;
}
.base-chip {
  cursor: pointer;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  border: 1px solid var(--ak-border);
  background: var(--ak-bg-panel);
  color: var(--ak-text-dim);
  font-family: inherit;
}
.base-chip.active {
  border-color: var(--ak-accent2);
  background: rgba(83, 152, 255, 0.15);
  color: var(--ak-accent2);
}
.base-summary {
  margin-top: 12px;
  font-size: 12px;
  color: var(--ak-text-dim);
  line-height: 1.7;
}
.base-issues {
  margin-top: 8px;
  font-size: 12px;
  color: #ff7875;
}
</style>
