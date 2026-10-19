import { reactive } from 'vue'
import { loginWithPair, restoreSession, logout as apiLogout } from '../api/skland.js'
import { loadGameData } from '../core/data.js'
import { buildBase, DEFAULT_MANUAL, loadManual, saveManual } from '../core/base.js'
import { generatePlans } from '../core/optimizer.js'

const OPTIONS_KEY = 'ak_v5_options'
const PRODUCTS_KEY = 'ak_v5_products_v2'
const STRATEGIES_KEY = 'ak_v5_strategies_v2'
const RECIPES_KEY = 'ak_v5_recipes_v2'

const MF_PRODUCTS = ['赤金', '作战记录', '源石碎片']
const TR_STRATEGIES = ['龙门商法', '开采协力']

function productFromRoom(room) {
  const id = String(room.formulaId || '')
  if (id === '4') return '赤金'
  if (id === '13' || id === '14') return room.level >= 3 ? '源石碎片' : '作战记录'
  if (id === '1' || id === '2' || id === '3') return '作战记录'
  return null
}

function strategyFromRoom(room) {
  return room.strategy === 'O_DIAMOND' ? '开采协力' : '龙门商法'
}

function hasRecipeUnlock(rooms) {
  return rooms.some((room) => Number(room.level) >= 3 || ['13', '14'].includes(String(room.formulaId || '')) || room.strategy === 'O_DIAMOND')
}

function readArray(key) {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeArray(key, value) {
  if (typeof localStorage === 'undefined') return
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* ignore */ }
}
const defaultOptions = {
  mode: 'oneclick',
  target: 'balanced',
  operationsPerDay: 2,
  weights: { lmd: 40, exp: 30, orundum: 20, trust: 10 },
  shardCosts: { guiyanLmd: 1600, deviceLmd: 1000 },
  drones: true,
  suggestions: true,
  startHour: 8,
}

function loadOptions() {
  if (typeof localStorage === 'undefined') return { ...defaultOptions, weights: { ...defaultOptions.weights } }
  try {
    const raw = localStorage.getItem(OPTIONS_KEY)
    if (!raw) return { ...defaultOptions, weights: { ...defaultOptions.weights } }
    const parsed = JSON.parse(raw)
    return {
      ...defaultOptions,
      ...parsed,
      weights: { ...defaultOptions.weights, ...(parsed.weights || {}) },
      shardCosts: { ...defaultOptions.shardCosts, ...(parsed.shardCosts || {}) },
    }
  } catch {
    return { ...defaultOptions, weights: { ...defaultOptions.weights } }
  }
}

export const store = reactive({
  ready: false,
  busy: false,
  error: '',
  session: null,
  data: null,
  base: null,
  manual: loadManual(),
  products: readArray(PRODUCTS_KEY),
  strategies: readArray(STRATEGIES_KEY),
  recipes: readArray(RECIPES_KEY),
  options: loadOptions(),
  result: null,
  selected: 0,
})

function syncProduction() {
  if (!store.base) return
  const mfRooms = (store.base.outputs || []).filter((o) => o.type === 'MANUFACTURE')
  const trRooms = (store.base.outputs || []).filter((o) => o.type === 'TRADING')
  const mfUnlocked = hasRecipeUnlock(mfRooms)
  const trUnlocked = hasRecipeUnlock(trRooms)
  const products = mfRooms.map((room, i) => {
    const saved = store.products[i]
    if (saved === '源石碎片' && !mfUnlocked) return '作战记录'
    if (MF_PRODUCTS.includes(saved)) return saved
    return productFromRoom(room) || '赤金'
  })
  const strategies = trRooms.map((room, i) => {
    const saved = store.strategies[i]
    if (saved === '开采协力' && !trUnlocked) return '龙门商法'
    if (TR_STRATEGIES.includes(saved)) return saved
    return strategyFromRoom(room)
  })
  const recipes = mfRooms.map((room, i) => {
    if (products[i] !== '源石碎片') return null
    return ['固源岩', '装置'].includes(store.recipes[i]) ? store.recipes[i] : '固源岩'
  })
  store.products = products
  store.strategies = strategies
  store.recipes = recipes
  writeArray(PRODUCTS_KEY, products)
  writeArray(STRATEGIES_KEY, strategies)
  writeArray(RECIPES_KEY, recipes)
}

function rebuildBase() {
  if (!store.session || !store.data) return
  store.base = buildBase(store.session, store.manual, store.data)
  syncProduction()
}

export async function initApp() {
  if (store.ready) return
  try {
    store.data = await loadGameData()
    const session = await restoreSession()
    if (session) {
      store.session = session
      rebuildBase()
    }
  } catch (error) {
    store.error = String(error?.message || error)
  } finally {
    store.ready = true
  }
}

export async function login(pair) {
  store.busy = true
  store.error = ''
  try {
    const session = await loginWithPair(pair)
    store.session = session
    rebuildBase()
    return true
  } catch (error) {
    store.error = String(error?.message || error)
    return false
  } finally {
    store.busy = false
  }
}

export async function logout() {
  await apiLogout()
  store.session = null
  store.base = null
  store.result = null
  store.selected = 0
}

export function updateManual(patch) {
  store.manual = { ...DEFAULT_MANUAL, ...store.manual, ...patch }
  saveManual(store.manual)
  rebuildBase()
}

export function updateOptions(patch) {
  const next = { ...store.options, ...patch }
  next.weights = { ...defaultOptions.weights, ...(store.options.weights || {}), ...(patch.weights || {}) }
  next.shardCosts = { ...defaultOptions.shardCosts, ...(store.options.shardCosts || {}), ...(patch.shardCosts || {}) }
  next.shardCosts.guiyanLmd = Math.max(0, Number(next.shardCosts.guiyanLmd) || 0)
  next.shardCosts.deviceLmd = Math.max(0, Number(next.shardCosts.deviceLmd) || 0)
  for (const key of ['lmd', 'exp', 'orundum', 'trust']) {
    const value = Number(next.weights[key])
    next.weights[key] = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : defaultOptions.weights[key]
  }
  store.options = next
  if (typeof localStorage !== 'undefined') {
    try { localStorage.setItem(OPTIONS_KEY, JSON.stringify(store.options)) } catch { /* ignore */ }
  }
}

export function setProduct(index, value) {
  const next = store.products.slice()
  next[index] = value
  store.products = next
  if (value === '源石碎片' && !['固源岩', '装置'].includes(store.recipes[index])) {
    const recipes = store.recipes.slice()
    recipes[index] = '固源岩'
    store.recipes = recipes
    writeArray(RECIPES_KEY, recipes)
  }
  writeArray(PRODUCTS_KEY, next)
}

export function setShardCost(key, value) {
  updateOptions({ shardCosts: { [key]: Number(value) || 0 } })
}

export function setRecipe(index, value) {
  const recipes = store.recipes.slice()
  recipes[index] = value
  store.recipes = recipes
  writeArray(RECIPES_KEY, recipes)
}

export function setStrategy(index, value) {
  const next = store.strategies.slice()
  next[index] = value
  store.strategies = next
  writeArray(STRATEGIES_KEY, next)
}

export function generate() {
  if (!store.session || !store.base || !store.data) throw new Error('尚未登录或数据未加载')
  store.result = generatePlans(store.session, store.base, store.data, {
    ...store.options,
    products: store.products,
    strategies: store.strategies,
    recipes: store.recipes,
  })
  const recommended = store.result.candidates.findIndex((c) => c.profile === '推荐')
  store.selected = recommended >= 0 ? recommended : 0
  return store.result
}

export function rebuild() {
  rebuildBase()
}
