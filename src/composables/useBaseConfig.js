import { ref, computed, watch } from 'vue'
import {
  DEFAULT_CONFIG,
  MF_CATS,
  TRADE_STRATEGIES,
  assistantCount,
  configSummary,
  gridCounts,
  normalizeConfig,
  seedConfigFromBuilding,
  slotsOf,
  syncProductionConfig,
  validateConfig,
} from '../utils/schedulerV4'

const CONFIG_KEY = 'ak_base_config'
const MF_KEY = 'ak_mf_config'
const TRADE_KEY = 'ak_trade_config'

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* private mode / quota — the app still works in memory */
  }
}

const hasStoredConfig = localStorage.getItem(CONFIG_KEY) !== null
const config = ref(normalizeConfig(readJson(CONFIG_KEY, null)))
const mfCats = ref(Array.isArray(readJson(MF_KEY, [])) ? readJson(MF_KEY, []) : [])
const tradeStrategies = ref(Array.isArray(readJson(TRADE_KEY, [])) ? readJson(TRADE_KEY, []) : [])

function applyProductionLengths() {
  const next = syncProductionConfig(config.value, mfCats.value, tradeStrategies.value)
  if (JSON.stringify(next.mfCats) !== JSON.stringify(mfCats.value)) mfCats.value = next.mfCats
  if (JSON.stringify(next.tradeStrategies) !== JSON.stringify(tradeStrategies.value)) tradeStrategies.value = next.tradeStrategies
}

applyProductionLengths()

watch(config, () => {
  writeJson(CONFIG_KEY, config.value)
  applyProductionLengths()
}, { deep: true })
watch(mfCats, (value) => writeJson(MF_KEY, value), { deep: true })
watch(tradeStrategies, (value) => writeJson(TRADE_KEY, value), { deep: true })

const counts = computed(() => gridCounts(config.value))
const issues = computed(() => validateConfig(config.value))
const summary = computed(() => configSummary(config.value))
const assistantSlots = computed(() => assistantCount(config.value))
const controlSlots = computed(() => slotsOf(config.value, 'CONTROL'))

const levelRooms = [
  { type: 'MANUFACTURE', name: '制造站', maxLevel: 3 },
  { type: 'TRADING', name: '贸易站', maxLevel: 3 },
  { type: 'POWER', name: '发电站', maxLevel: 3 },
  { type: 'DORMITORY', name: '宿舍', maxLevel: 5 },
  { type: 'MEETING', name: '会客室', maxLevel: 3 },
  { type: 'HIRE', name: '办公室', maxLevel: 3 },
  { type: 'TRAINING', name: '训练室', maxLevel: 3 },
  { type: 'WORKSHOP', name: '加工站', maxLevel: 3 },
]

function cycleCell(index) {
  const order = ['MANUFACTURE', 'TRADING', 'POWER']
  const current = config.value.grid[index]
  config.value.grid[index] = order[(order.indexOf(current) + 1) % order.length]
  applyProductionLengths()
}

function setMfCat(index, category) {
  const next = [...mfCats.value]
  next[index] = category
  mfCats.value = next
}

function setTradeStrategy(index, strategy) {
  const next = [...tradeStrategies.value]
  next[index] = strategy
  tradeStrategies.value = next
}

function syncFromBuilding(building, force = false, storageSeen = false) {
  if (!force && (hasStoredConfig || storageSeen)) return false
  if (!building || Object.keys(building).length === 0) return false
  config.value = seedConfigFromBuilding(building)
  applyProductionLengths()
  return true
}

function resetConfig() {
  config.value = normalizeConfig(DEFAULT_CONFIG)
  applyProductionLengths()
}

export function useBaseConfig() {
  return {
    config,
    counts,
    issues,
    summary,
    assistantSlots,
    controlSlots,
    levelRooms,
    mfCats,
    tradeStrategies,
    hasStoredConfig,
    MF_CATS,
    TRADE_STRATEGIES,
    cycleCell,
    setMfCat,
    setTradeStrategy,
    syncFromBuilding,
    resetConfig,
    slotsOf: (type) => slotsOf(config.value, type),
  }
}
