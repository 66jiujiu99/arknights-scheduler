<template>
  <div class="ak-page">
    <header class="ak-page-head">
      <div>
        <div class="ak-kicker">STEP 02 · PLAN</div>
        <h1>排班方案</h1>
        <p v-if="store.result">产物与策略按你的配置固定；3 个候选比较换班次数、效率与心情风险。{{ store.options.mode === 'oneclick' ? '在游戏内为每个设施保存这些队列，之后用队列轮换一键切换。' : '按时间表手动换；会客室 / 办公室 / 训练室可按各自周期单独换。' }}</p>
        <p v-else>还没有生成方案。</p>
      </div>
      <div class="ak-head-actions">
        <router-link to="/setup" class="ak-btn ak-btn-ghost">← 调整配置</router-link>
        <button v-if="store.result" class="ak-btn ak-btn-secondary" @click="copyPlan">复制方案文本</button>
      </div>
    </header>

    <div v-if="!store.result" class="ak-card ak-empty">
      <p>先在「基建配置」选择模式、产物与贸易策略，再生成方案。</p>
      <router-link to="/setup" class="ak-btn ak-btn-primary">去配置</router-link>
    </div>

    <template v-else>
      <div class="ak-candidate-grid">
        <button
          v-for="(c, i) in store.result.candidates"
          :key="c.id"
          :class="['ak-candidate', store.selected === i ? 'active' : '']"
          @click="select(i)"
        >
          <div class="ak-candidate-top">
            <span class="ak-candidate-label">{{ c.label }} · {{ c.profile }}</span>
            <span class="ak-candidate-ops">{{ c.shiftHours }}h / 班</span>
          </div>
          <div class="ak-candidate-score">{{ c.score.total.toFixed(1) }}<small>综合</small></div>
          <div class="ak-candidate-metrics">
            <span>LMD {{ fmt(c.score.lmd) }}</span>
            <span>EXP {{ fmt(c.score.exp) }}</span>
            <span>玉 {{ fmt(c.score.orundum) }}</span>
          </div>
          <div class="ak-candidate-mood" :class="{ 'ak-bad': c.score.minMood < 4 }">
            最低心情 {{ c.score.minMood.toFixed(1) }}
          </div>
        </button>
      </div>

      <div v-if="candidate && candidate.operationsPerDay < 3 && candidate.score.minMood < 4" class="ak-alert ak-alert-warn">
        当前每天 {{ candidate.operationsPerDay }} 次的最低心情低于 4，建议改成 3 次/天，或提高宿舍/降低高消耗干员。
      </div>

      <div v-if="candidate" class="ak-plan">
        <section class="ak-card ak-card-plan-main">
          <div class="ak-card-head">
            <h2>{{ candidate.label }} · 队列安排</h2>
            <span class="ak-tag">{{ candidate.shiftHours }}h / 班</span>
          </div>

          <div class="ak-queue-tabs">
            <button
              v-for="(q, i) in candidate.queues"
              :key="i"
              :class="['ak-queue-tab', queueIndex === i ? 'active' : '']"
              @click="queueIndex = i"
            >
              队列 {{ i + 1 }}<small>{{ hh(q.startHour) }}</small>
            </button>
          </div>

          <div v-if="candidate" class="ak-plan-mix">
            制造：{{ candidate.mix.mfProducts.join(' / ') }}　·　贸易：{{ candidate.mix.trStrategies.join(' / ') }}
          </div>

          <div v-if="queue" class="ak-facilities">
            <div class="ak-facility">
              <div class="ak-facility-head"><span>控制中枢</span><b>Lv{{ store.base.controlLevel }}</b></div>
              <div class="ak-facility-stats">
                <span>{{ moodText(queue.stats.CONTROL.moodPerOp, queue.stats.CONTROL.moodTotal) }}</span>
                <span>制造 +{{ num(queue.stats.CONTROL.manufacture) }}% · 贸易 +{{ num(queue.stats.CONTROL.trading) }}%</span>
              </div>
              <div class="ak-op-list">
                <span v-for="op in queue.assigned.CONTROL" :key="op.charId" class="ak-op">
                  <i :class="'r' + op.rarity">{{ op.rarity }}★</i>{{ op.name }}
                  <small>{{ op.skills?.[0]?.name || '' }}</small>
                </span>
              </div>
            </div>

            <div class="ak-facility" v-for="room in queue.assigned.MANUFACTURE" :key="room.roomId">
              <div class="ak-facility-head"><span>制造站 · {{ room.product }}</span><b>Lv{{ room.level }}</b></div>
              <div class="ak-facility-stats">
                <span>效率 {{ pct(room.efficiency) }}</span>
                <span>{{ moodText(room.moodPerOp, room.moodTotal) }}</span>
              </div>
              <div class="ak-op-list">
                <span v-for="op in room.ops" :key="op.charId" class="ak-op"><i :class="'r' + op.rarity">{{ op.rarity }}★</i>{{ op.name }}<small>{{ op.skill?.name || '' }}</small></span>
              </div>
            </div>

            <div class="ak-facility" v-for="room in queue.assigned.TRADING" :key="room.roomId">
              <div class="ak-facility-head"><span>贸易站 · {{ room.strategy }}</span><b>Lv{{ room.level }}</b></div>
              <div class="ak-facility-stats">
                <span>效率 {{ pct(room.efficiency) }}</span>
                <span>{{ moodText(room.moodPerOp, room.moodTotal) }}</span>
              </div>
              <div class="ak-op-list">
                <span v-for="op in room.ops" :key="op.charId" class="ak-op"><i :class="'r' + op.rarity">{{ op.rarity }}★</i>{{ op.name }}<small>{{ op.skill?.name || '' }}</small></span>
              </div>
            </div>

            <div class="ak-facility" v-for="room in queue.assigned.POWER" :key="room.roomId">
              <div class="ak-facility-head"><span>发电站</span><b>Lv{{ room.level }}</b></div>
              <div class="ak-facility-stats">
                <span>充能 {{ pct(room.efficiency) }}</span>
                <span>{{ moodText(room.moodPerOp, room.moodTotal) }}</span>
              </div>
              <div class="ak-op-list">
                <span v-for="op in room.ops" :key="op.charId" class="ak-op"><i :class="'r' + op.rarity">{{ op.rarity }}★</i>{{ op.name }}<small>{{ op.skill?.name || '' }}</small></span>
              </div>
            </div>

            <div class="ak-facility" v-for="row in fixedRows" :key="row.key">
              <div class="ak-facility-head"><span>{{ row.label }}</span><b>{{ row.level }}</b></div>
              <div class="ak-facility-stats" v-if="row.key !== 'RECYCLE' || store.base.recycleLevel > 0">
                <span v-if="row.key === 'WORKSHOP'">副产物 +{{ num(queue.stats.WORKSHOP.efficiency) }}%</span>
                <span v-else-if="row.key === 'CONTROL'"></span>
                <span v-else>效率 {{ pct(queue.stats[row.key].efficiency) }}</span>
                <span v-if="row.key !== 'WORKSHOP'">{{ moodText(queue.stats[row.key].moodPerOp, queue.stats[row.key].moodTotal) }}</span>
              </div>
              <div class="ak-op-list">
                <span v-if="!queue.assigned[row.key]?.length" class="ak-op ak-op-empty">—</span>
                <span v-for="op in queue.assigned[row.key]" :key="op.charId" class="ak-op"><i :class="'r' + op.rarity">{{ op.rarity }}★</i>{{ op.name }}<small>{{ op.skill?.name || '' }}</small></span>
              </div>
            </div>
          </div>
        </section>

        <aside class="ak-side">
          <section class="ak-card">
            <div class="ak-card-head"><h2>收益估算</h2><span class="ak-tag ak-tag-dim">/ 天</span></div>
            <div class="ak-metric" v-for="m in metrics" :key="m.key">
              <span>{{ m.label }}</span><b>{{ m.value }}</b>
            </div>
            <div class="ak-metric ak-metric-mood">
              <span>最低心情</span><b :class="{ 'ak-bad': candidate.score.minMood < 4 }">{{ candidate.score.minMood.toFixed(1) }}</b>
            </div>
            <div v-if="candidate.score.warnings?.length" class="ak-alert ak-alert-warn">
              <div v-for="w in candidate.score.warnings" :key="w">{{ w }}</div>
            </div>
          </section>

          <section class="ak-card">
            <div class="ak-card-head"><h2>换班时间表</h2></div>
            <div class="ak-timeline">
              <div v-for="t in candidate.timeline" :key="t.label + t.time" class="ak-timeline-item">
                <span class="ak-timeline-time">{{ t.time }}</span>
                <span class="ak-timeline-label">{{ t.label }}</span>
              </div>
            </div>
          </section>

          <section v-if="candidate.score.combos?.length" class="ak-card">
            <div class="ak-card-head"><h2>生效组合</h2></div>
            <div class="ak-combo" v-for="id in candidate.score.combos" :key="id">{{ comboName(id) }}</div>
          </section>

          <section v-if="store.result.meta.recommendations?.length" class="ak-card">
            <div class="ak-card-head"><h2>练度建议</h2><span class="ak-tag ak-tag-dim">仅已拥有</span></div>
            <div class="ak-rec" v-for="r in store.result.meta.recommendations" :key="r.charId + r.room">
              <div class="ak-rec-name">{{ r.name }} <small>{{ r.roomName }}</small></div>
              <div class="ak-rec-detail">{{ r.skill }} · {{ reqText(r) }} <b>+{{ r.gain }}%</b></div>
            </div>
          </section>

          <section v-if="candidate.layoutTips?.length" class="ak-card">
            <div class="ak-card-head"><h2>布局建议</h2><span class="ak-tag ak-tag-dim">参考</span></div>
            <div class="ak-tip" v-for="tip in candidate.layoutTips" :key="tip.id">
              <b>{{ tip.name }}</b><span>{{ tip.note }}</span>
            </div>
          </section>
        </aside>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { store } from '../stores/session'

const queueIndex = ref(0)
const candidate = computed(() => store.result?.candidates?.[store.selected] || null)
const queue = computed(() => candidate.value?.queues?.[queueIndex.value] || null)
const fixedRows = computed(() => [
  { key: 'MEETING', label: '会客室', level: 'Lv' + store.base.meetingLevel },
  { key: 'HIRE', label: '办公室', level: 'Lv' + store.base.hireLevel },
  { key: 'TRAINING', label: '训练室', level: 'Lv' + store.base.trainingLevel },
  { key: 'WORKSHOP', label: '加工站', level: 'Lv' + store.base.workshopLevel },
  { key: 'RECYCLE', label: '回收站', level: store.base.recycleLevel ? 'Lv' + store.base.recycleLevel : '未建' },
])
const metrics = computed(() => candidate.value ? [
  { key: 'lmd', label: '龙门币', value: fmt(candidate.value.score.lmd) },
  { key: 'exp', label: '作战记录经验', value: fmt(candidate.value.score.exp) },
  { key: 'orundum', label: '合成玉', value: fmt(candidate.value.score.orundum) },
  { key: 'trust', label: '信赖', value: fmt(candidate.value.score.trust) },
] : [])

function select(i) { store.selected = i; queueIndex.value = 0 }
function pct(n) { return Math.round(Number(n || 0) * 100) + '%' }
function num(n) { return Math.round(Number(n || 0)) }
function fmtMood(n) { return '-' + Number(n || 0).toFixed(2) }
function moodText(perOp, total) {
  if (!Number.isFinite(Number(perOp)) || Number(perOp) <= 0) return '心情 —'
  return '心情 -' + Number(perOp).toFixed(2) + '/h/人 · 总 -' + Number(total || 0).toFixed(2) + '/h'
}
function hh(h) { return String(Math.floor(h)).padStart(2, '0') + ':00' }
function fmt(n) { return Math.round(Number(n || 0)).toLocaleString('zh-CN') }
function reqText(r) {
  const parts = []
  if (r.phase > 0) parts.push('精' + r.phase)
  if (r.level > 1) parts.push('Lv' + r.level)
  return parts.length ? parts.join(' / ') : '解锁'
}
function comboName(id) {
  const combo = (store.data?.allCombos || []).find((c) => c.id === id)
  return combo ? combo.name : id
}
function copyPlan() {
  const c = candidate.value
  if (!c) return
  const lines = ['【' + c.label + '】' + c.operationsPerDay + ' 次/天，' + c.shiftHours + 'h/班']
  c.queues.forEach((q, i) => {
    lines.push('')
    lines.push('队列 ' + (i + 1) + '（' + hh(q.startHour) + '）')
    lines.push('中枢：' + q.assigned.CONTROL.map((o) => o.name).join(' / '))
    q.assigned.MANUFACTURE.forEach((r) => lines.push('制造·' + r.product + '：' + r.ops.map((o) => o.name).join(' / ')))
    q.assigned.TRADING.forEach((r) => lines.push('贸易·' + r.strategy + '：' + r.ops.map((o) => o.name).join(' / ')))
    q.assigned.POWER.forEach((r) => lines.push('发电：' + r.ops.map((o) => o.name).join(' / ')))
    for (const key of ['MEETING', 'HIRE', 'TRAINING', 'WORKSHOP', 'RECYCLE']) {
      const list = q.assigned[key] || []
      if (list.length) lines.push(key + '：' + list.map((o) => o.name).join(' / '))
    }
  })
  navigator.clipboard?.writeText(lines.join('\n'))
}
</script>
