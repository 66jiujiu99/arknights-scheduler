import { reactive } from 'vue'
import { loginWithPair, restoreSession, logout as apiLogout } from '../api/skland.js'
import { loadGameData } from '../core/data.js'
import { buildBase, DEFAULT_MANUAL, loadManual, saveManual } from '../core/base.js'
import { generatePlans } from '../core/optimizer.js'

const OPTIONS_KEY = 'ak_v5_options'
const defaultOptions = {
  mode: 'oneclick',
  operationsPerDay: 2,
  weights: { lmd: 40, exp: 30, orundum: 20, trust: 10 },
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
  options: loadOptions(),
  result: null,
  selected: 0,
})

function rebuildBase() {
  if (!store.session || !store.data) return
  store.base = buildBase(store.session, store.manual, store.data)
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
  for (const key of ['lmd', 'exp', 'orundum', 'trust']) {
    const value = Number(next.weights[key])
    next.weights[key] = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : defaultOptions.weights[key]
  }
  store.options = next
  if (typeof localStorage !== 'undefined') {
    try { localStorage.setItem(OPTIONS_KEY, JSON.stringify(store.options)) } catch { /* ignore */ }
  }
}

export function generate() {
  if (!store.session || !store.base || !store.data) throw new Error('尚未登录或数据未加载')
  store.result = generatePlans(store.session, store.base, store.data, store.options)
  store.selected = 0
  return store.result
}

export function rebuild() {
  rebuildBase()
}
