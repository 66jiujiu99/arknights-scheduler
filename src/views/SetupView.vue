<template>
  <div v-if="store.session && store.base" class="ak-page">
    <header class="ak-page-head">
      <div>
        <div class="ak-kicker">STEP 01 · BASE</div>
        <h1>基建配置</h1>
        <p>已从账号读取真实房间与等级。加工站 / 回收站 / 活动室 / 副手不在 API 中，请补一次。</p>
      </div>
      <div class="ak-account">
        <div class="ak-account-name">{{ store.session.profile.nickname || '博士' }}</div>
        <div class="ak-account-meta">
          <span>Lv{{ store.session.profile.level }}</span>
          <span>{{ store.session.profile.channel || '官服' }}</span>
          <span>{{ store.session.chars.length }} 名干员</span>
        </div>
      </div>
    </header>

    <div class="ak-layout-2">
      <section class="ak-card ak-card-base">
        <div class="ak-card-head">
          <h2>罗德岛基建</h2>
          <span class="ak-tag">LIVE DATA</span>
        </div>

        <div class="ak-base-top">
          <div class="ak-control">
            <div class="ak-control-level">Lv{{ store.base.controlLevel }}</div>
            <div class="ak-control-name">控制中枢</div>
            <div class="ak-control-sub">{{ store.base.assistants }} 个副手位</div>
          </div>
          <div class="ak-grid9">
            <div v-for="(cell, i) in store.base.outputs" :key="i" class="ak-cell" :class="cellClass(cell)">
              <span class="ak-cell-type">{{ typeShort(cell.type) }}</span>
              <span class="ak-cell-level">Lv{{ cell.level }}</span>
            </div>
          </div>
        </div>

        <div class="ak-room-row">
          <div class="ak-room-chip">
            <span>宿舍</span>
            <b>{{ store.base.dorms.map(d => 'Lv' + d.level).join(' / ') }}</b>
          </div>
          <div class="ak-room-chip">
            <span>会客室</span><b>Lv{{ store.base.meetingLevel }}</b>
          </div>
          <div class="ak-room-chip">
            <span>办公室</span><b>Lv{{ store.base.hireLevel }}</b>
          </div>
          <div class="ak-room-chip">
            <span>训练室</span><b>Lv{{ store.base.trainingLevel }}</b>
          </div>
        </div>

        <div class="ak-power">
          <div class="ak-power-head">
            <span>电力</span>
            <b :class="{ 'ak-bad': store.base.power.balance < 0 }">
              {{ store.base.power.demand }} / {{ store.base.power.supply }}
            </b>
          </div>
          <div class="ak-power-bar">
            <div class="ak-power-fill" :class="{ 'ak-bad': store.base.power.balance < 0 }" :style="{ width: powerPct + '%' }"></div>
          </div>
          <div class="ak-power-foot" :class="{ 'ak-bad': store.base.power.balance < 0 }">
            {{ store.base.power.balance >= 0 ? '剩余 ' + store.base.power.balance + ' 电力' : '缺 ' + Math.abs(store.base.power.balance) + ' 电力' }}
          </div>
        </div>

        <div v-if="store.base.issues.length" class="ak-alert ak-alert-warn">
          <div v-for="issue in store.base.issues" :key="issue">{{ issue }}</div>
        </div>

        <div class="ak-manual">
          <div class="ak-card-head">
            <h2>补全设施</h2>
            <span class="ak-tag ak-tag-dim">API 未返回</span>
          </div>
          <div class="ak-field-grid">
            <label class="ak-field">
              <span>加工站等级</span>
              <select :value="store.manual.workshopLevel" @change="setManual({ workshopLevel: Number($event.target.value) })">
                <option v-for="n in 3" :key="n" :value="n">Lv{{ n }}</option>
              </select>
            </label>
            <label class="ak-field">
              <span>回收站等级</span>
              <select :value="store.manual.recycleLevel" @change="setManual({ recycleLevel: Number($event.target.value) })">
                <option :value="0">未建造</option>
                <option v-for="n in 3" :key="n" :value="n">Lv{{ n }}</option>
              </select>
            </label>
            <label class="ak-field">
              <span>活动室数量</span>
              <select :value="store.manual.privateCount" @change="setManual({ privateCount: Number($event.target.value) })">
                <option v-for="n in 9" :key="n" :value="n - 1">{{ n - 1 }} 间</option>
              </select>
            </label>
            <label class="ak-field ak-field-check">
              <span>启用副手</span>
              <input type="checkbox" :checked="store.manual.useAssistants" @change="setManual({ useAssistants: $event.target.checked })" />
            </label>
          </div>
          <p class="ak-hint">加工站等级影响配方；回收站 3 级解锁转化提效；活动室只影响活动信赖。</p>
        </div>
      </section>

      <aside class="ak-side">
        <section class="ak-card">
          <div class="ak-card-head"><h2>方案参数</h2></div>
          <div class="ak-mode">
            <button :class="['ak-mode-btn', store.options.mode === 'oneclick' ? 'active' : '']" @click="setMode('oneclick')">
              <b>一键换班</b><small>少操作 · 预设队列</small>
            </button>
            <button :class="['ak-mode-btn', store.options.mode === 'manual' ? 'active' : '']" @click="setMode('manual')">
              <b>效率最大</b><small>按时刻表手动换</small>
            </button>
          </div>

          <div class="ak-option">
            <div class="ak-option-head"><span>每天换班次数</span><b>{{ store.options.mode === 'oneclick' ? Math.min(3, store.options.operationsPerDay) : store.options.operationsPerDay }}</b></div>
            <div class="ak-seg ak-ops-seg">
              <button v-for="n in 4" :key="n" :disabled="store.options.mode === 'oneclick' && n > 3" :class="{ active: effectiveOps === n }" @click="setOps(n)">{{ n }}</button>
            </div>
            <p class="ak-hint">{{ hoursPerShift }} 小时一班{{ effectiveOps > 3 ? '；游戏预设只有 3 套，4 次需手动改' : '' }}</p>
          </div>

          <div class="ak-option">
            <div class="ak-option-head"><span>目标</span><span class="ak-hint">影响目标分与练度建议</span></div>
            <div class="ak-seg ak-seg-3 ak-target-seg">
              <button :class="{ active: store.options.target === 'balanced' }" @click="updateOptions({ target: 'balanced' })">均衡</button>
              <button :class="{ active: store.options.target === 'lmd' }" @click="updateOptions({ target: 'lmd' })">主攻龙门币</button>
              <button :class="{ active: store.options.target === 'orundum' }" @click="updateOptions({ target: 'orundum' })">主攻合成玉</button>
            </div>
          </div>

          <div class="ak-option">
            <div class="ak-option-head"><span>制造站产物</span><span class="ak-hint">按站指定</span></div>
            <div class="ak-station-list">
              <label v-for="(room, i) in mfRooms" :key="'mf' + i" class="ak-station">
                <span>制造站 {{ i + 1 }} <small>Lv{{ room.level }}</small></span>
                <select :value="store.products[i]" @change="setProduct(i, $event.target.value)">
                  <option value="赤金">赤金</option>
                  <option value="作战记录">作战记录</option>
                  <option value="源石碎片" :disabled="!mfUnlocked">{{ mfUnlocked ? '源石碎片' : '源石碎片（需曾达 Lv3）' }}</option>
                </select>
                <select
                  v-if="store.products[i] === '源石碎片'"
                  class="ak-station-recipe"
                  :value="store.recipes[i]"
                  @change="setRecipe(i, $event.target.value)"
                >
                  <option value="固源岩">固源岩 ×2</option>
                  <option value="装置">装置 ×1</option>
                </select>
              </label>
            </div>
          </div>

          <div class="ak-option">
            <div class="ak-option-head"><span>贸易站策略</span><span class="ak-hint">按站指定</span></div>
            <div class="ak-station-list">
              <label v-for="(room, i) in trRooms" :key="'tr' + i" class="ak-station">
                <span>贸易站 {{ i + 1 }} <small>Lv{{ room.level }}</small></span>
                <select :value="store.strategies[i]" @change="setStrategy(i, $event.target.value)">
                  <option value="龙门商法">龙门商法（龙门币）</option>
                  <option value="开采协力" :disabled="!trUnlocked">{{ trUnlocked ? '开采协力（合成玉）' : '开采协力（需曾达 Lv3）' }}</option>
                </select>
              </label>
            </div>
            <p class="ak-hint">源石碎片 / 开采协力需要账号曾把对应设施升到 Lv3；解锁后任意等级可用。固源岩按一图流 1-7（1.09 玉/理智）折算。</p>
            <details class="ak-help">
              <summary>搓玉配方成本（高级，默认按游戏数据）</summary>
              <div class="ak-field-grid">
                <label class="ak-field">固源岩配方龙门币
                  <input type="number" min="0" step="100" :value="store.options.shardCosts.guiyanLmd" @change="setShardCost('guiyanLmd', $event.target.value)" />
                </label>
                <label class="ak-field">装置配方龙门币
                  <input type="number" min="0" step="100" :value="store.options.shardCosts.deviceLmd" @change="setShardCost('deviceLmd', $event.target.value)" />
                </label>
              </div>
            </details>
          </div>

          <div class="ak-option ak-switches">
            <label class="ak-switch"><input type="checkbox" :checked="store.options.drones" @change="setOption({ drones: $event.target.checked })" /><span>无人机加速</span></label>
            <label class="ak-switch"><input type="checkbox" :checked="store.options.suggestions" @change="setOption({ suggestions: $event.target.checked })" /><span>显示布局建议</span></label>
          </div>

          <div class="ak-option">
            <div class="ak-option-head"><span>第一班开始</span></div>
            <select :value="store.options.startHour" @change="setOption({ startHour: Number($event.target.value) })">
              <option v-for="h in [0, 4, 8, 12, 16, 20]" :key="h" :value="h">{{ String(h).padStart(2, '0') }}:00</option>
            </select>
          </div>

          <button class="ak-btn ak-btn-primary ak-btn-wide" :disabled="store.busy" @click="doGenerate">
            生成 3 个候选方案 →
          </button>
          <div v-if="localError" class="ak-alert">{{ localError }}</div>
        </section>

        <section class="ak-card ak-card-note">
          <div class="ak-card-head"><h2>说明</h2></div>
          <ul class="ak-list">
            <li>按真实房间数量/等级，假设无人进驻、心情满、无人机满。</li>
            <li>加工站/回收站/活动室/副手为手动补全。</li>
            <li>收益为估算值，组合加成来自 <code>scripts/combos.source.json</code>。</li>
          </ul>
        </section>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { store, updateManual, updateOptions, generate, setProduct, setStrategy, setRecipe, setShardCost } from '../stores/session'

const router = useRouter()
const localError = ref('')

const TYPE = {
  MANUFACTURE: { short: '制', cls: 'mf' },
  TRADING: { short: '贸', cls: 'tr' },
  POWER: { short: '电', cls: 'pw' },
}
const mfRooms = computed(() => (store.base?.outputs || []).filter((o) => o.type === 'MANUFACTURE'))
const trRooms = computed(() => (store.base?.outputs || []).filter((o) => o.type === 'TRADING'))
const mfUnlocked = computed(() => mfRooms.value.some((room) => room.level >= 3 || ['13', '14'].includes(String(room.formulaId || ''))))
const trUnlocked = computed(() => trRooms.value.some((room) => room.level >= 3 || room.strategy === 'O_DIAMOND'))

const powerPct = computed(() => {
  const p = store.base?.power || { supply: 0, demand: 0 }
  if (!p.demand) return 0
  return Math.min(100, Math.round((p.supply / p.demand) * 100))
})
const effectiveOps = computed(() => store.options.mode === 'oneclick' ? Math.min(3, store.options.operationsPerDay) : store.options.operationsPerDay)
const hoursPerShift = computed(() => Math.round((24 / effectiveOps.value) * 10) / 10)
function typeShort(type) { return TYPE[type]?.short || '?' }
function cellClass(cell) { return TYPE[cell.type]?.cls || '' }
function setManual(patch) { updateManual(patch) }
function setOption(patch) { updateOptions(patch) }
function setMode(mode) {
  updateOptions({ mode, operationsPerDay: mode === 'oneclick' ? Math.min(3, store.options.operationsPerDay || 2) : Math.max(3, store.options.operationsPerDay || 3) })
}
function setOps(n) { updateOptions({ operationsPerDay: n }) }

function doGenerate() {
  localError.value = ''
  try {
    generate()
    router.push({ name: 'Plan' })
  } catch (error) {
    localError.value = String(error?.message || error)
  }
}
</script>
