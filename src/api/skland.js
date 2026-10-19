/**
 * Skland login + player data.
 *
 * The user pastes the two values from the Skland web app:
 *   localStorage.getItem('SK_OAUTH_CRED_KEY') + ',' + localStorage.getItem('SK_TOKEN_CACHE_KEY')
 *
 * Everything runs in the browser: the Skland API allows CORS and the device
 * fingerprint endpoint (fp-it.portal101.cn) also allows CORS. No server is used.
 *
 * The bundled vendor/skland-kit.js handles:
 *  - 数美 device fingerprint (dId) generation
 *  - request signing (hmac-sha256 + md5)
 *  - refresh / binding / player info
 */
import {
  createClient,
  STORAGE_CREDENTIAL_KEY,
  STORAGE_DID_KEY,
  STORAGE_OAUTH_TOKEN_KEY,
  STORAGE_USER_ID_KEY,
} from '../vendor/skland-kit.js'

const PREFIX = 'ak_v5:'
const API_BASE = 'https://zonai.skland.com'

/** localStorage driver; falls back to memory for unit tests / SSR. */
function createDriver() {
  if (typeof localStorage !== 'undefined') {
    return {
      async getItem(key) { return localStorage.getItem(PREFIX + key) },
      async setItem(key, value) { localStorage.setItem(PREFIX + key, String(value)) },
      async removeItem(key) { localStorage.removeItem(PREFIX + key) },
      async getKeys() {
        const keys = []
        for (let i = 0; i < localStorage.length; i += 1) {
          const k = localStorage.key(i)
          if (k && k.startsWith(PREFIX)) keys.push(k.slice(PREFIX.length))
        }
        return keys
      },
      async clear() {
        for (const k of await this.getKeys()) localStorage.removeItem(PREFIX + k)
      },
      async hasItem(key) { return localStorage.getItem(PREFIX + key) !== null },
    }
  }
  const memory = new Map()
  return {
    async getItem(key) { return memory.has(key) ? memory.get(key) : null },
    async setItem(key, value) { memory.set(key, String(value)) },
    async removeItem(key) { memory.delete(key) },
    async getKeys() { return [...memory.keys()] },
    async clear() { memory.clear() },
    async hasItem(key) { return memory.has(key) },
  }
}

// Skland's CORS preflight only allows Cred/Sign/Timestamp/Did/Platform/Vname/Content-Type.
// Third-party clients add x-requested-with / referer / origin, which makes the browser
// preflight fail even though the same request works from Node. Strip them here.
function installBrowserFetchFix() {
  if (typeof window === 'undefined' || globalThis.__akFetchCorsFix) return
  globalThis.__akFetchCorsFix = true
  const nativeFetch = globalThis.fetch
  const drop = new Set(['x-requested-with', 'referer', 'origin', 'connection', 'accept-encoding'])
  globalThis.fetch = (input, init = {}) => {
    if (!init || !init.headers) return nativeFetch(input, init)
    const headers = new Headers(init.headers)
    for (const name of drop) headers.delete(name)
    return nativeFetch(input, { ...init, headers })
  }
}
installBrowserFetchFix()

const driver = createDriver()
const client = createClient({ baseURL: API_BASE, timeout: 45000, driver })

const RARITY = { TIER_1: 1, TIER_2: 2, TIER_3: 3, TIER_4: 4, TIER_5: 5, TIER_6: 6 }
const PROF_CN = {
  CASTER: '术师', WARRIOR: '近卫', MEDIC: '医疗', PIONEER: '先锋', SNIPER: '狙击',
  SUPPORT: '辅助', SPECIAL: '特种', TANK: '重装', TOKEN: '召唤物', TRAP: '装置',
}

function parsePair(raw) {
  const text = String(raw || '').trim().replace(/\s+/g, '')
  if (!text) throw new Error('请粘贴 SK_OAUTH_CRED_KEY,SK_TOKEN_CACHE_KEY')
  const comma = text.indexOf(',')
  if (comma < 0) throw new Error('凭证格式应为：SK_OAUTH_CRED_KEY,SK_TOKEN_CACHE_KEY（中间用英文逗号）')
  const cred = text.slice(0, comma).trim()
  const token = text.slice(comma + 1).trim()
  if (!cred || !token) throw new Error('凭证不完整：需要 cred 和 token 两段')
  return { cred, token }
}

export function getStoredPair() {
  if (typeof localStorage === 'undefined') return null
  const cred = localStorage.getItem(PREFIX + STORAGE_CREDENTIAL_KEY)
  const token = localStorage.getItem(PREFIX + STORAGE_OAUTH_TOKEN_KEY)
  return cred && token ? { cred, token } : null
}

function rarityOf(info) {
  if (!info) return 1
  if (RARITY[info.rarity]) return RARITY[info.rarity]
  const n = Number(info.rarity)
  return Number.isFinite(n) ? Math.min(6, Math.max(1, n + 1)) : 1
}

function normalize(info) {
  const charInfoMap = info.charInfoMap || {}
  const nameCounts = {}
  for (const c of info.chars || []) {
    const n = charInfoMap[c.charId]?.name || c.charId
    nameCounts[n] = (nameCounts[n] || 0) + 1
  }
  const chars = (info.chars || []).map((c) => {
    const infoItem = charInfoMap[c.charId] || {}
    const rawName = infoItem.name || c.charId
    const profession = PROF_CN[infoItem.profession] || infoItem.profession || ''
    const name = nameCounts[rawName] > 1 ? rawName + '(' + profession + ')' : rawName
    return {
      charId: c.charId,
      name,
      rarity: rarityOf(infoItem),
      profession,
      nation: infoItem.nationId || '',
      group: infoItem.groupId || '',
      level: Number(c.level || 1),
      elite: Number(c.evolvePhase || 0),
      potential: Number(c.potentialRank || 0),
      mainSkillLvl: Number(c.mainSkillLvl || 1),
      skills: (c.skills || []).map((s) => ({ id: s?.id || '', mastery: Number(s?.specializeLevel || 0) })),
      equip: (c.equip || []).map((e) => ({ id: e?.id || '', level: Number(e?.level || 0) })),
      favor: Number(c.favorPercent || 0),
    }
  })
  const b = info.building || {}
  const room = (r) => r ? {
    slotId: r.slotId,
    level: Number(r.level || 1),
    chars: (r.chars || []).map((c) => ({ ...c, charId: c.charId })),
  } : null

  const outputs = []
  for (const r of b.manufactures || []) outputs.push({ ...room(r), type: 'MANUFACTURE' })
  for (const r of b.tradings || []) outputs.push({ ...room(r), type: 'TRADING' })
  for (const r of b.powers || []) outputs.push({ ...room(r), type: 'POWER' })

  return {
    profile: {
      uid: info.status?.uid || '',
      nickname: info.status?.name || '',
      level: Number(info.status?.level || 0),
      channel: info.status?.channelName || '',
    },
    chars,
    charInfoMap,
    building: {
      control: room(b.control),
      outputs,
      dorms: (b.dormitories || []).map((r) => ({
        ...room(r),
        comfort: Number(r.comfort || 0),
      })),
      meeting: room(b.meeting),
      hire: room(b.hire),
      training: b.training ? {
        slotId: b.training.slotId,
        level: Number(b.training.level || 1),
        trainee: b.training.trainee || null,
        trainer: b.training.trainer || null,
        remainSecs: Number(b.training.remainSecs || 0),
      } : null,
      labor: b.labor ? {
        value: Number(b.labor.value || 0),
        maxValue: Number(b.labor.maxValue || 0),
        remainSecs: Number(b.labor.remainSecs || 0),
      } : null,
      tired: (b.tiredChars || []).map((c) => c.charId),
    },
    raw: info,
  }
}

async function fetchAll() {
  const token = await client.refresh()
  if (!token?.token) throw new Error('刷新 token 失败')
  const binding = await client.collections.player.getBinding()
  let uid = ''
  let channel = ''
  for (const app of binding.list || []) {
    if (app.appCode !== 'arknights') continue
    for (const item of app.bindingList || []) {
      uid = item.uid
      channel = item.channelName || ''
      break
    }
    break
  }
  if (!uid) throw new Error('该账号没有绑定明日方舟角色')
  if (channel) await driver.setItem(STORAGE_USER_ID_KEY, uid)
  const info = await client.collections.player.getInfo({ uid })
  const normalized = normalize(info)
  normalized.profile.channel = channel || normalized.profile.channel
  return normalized
}

export async function loginWithPair(raw) {
  const { cred, token } = parsePair(raw)
  await driver.setItem(STORAGE_CREDENTIAL_KEY, cred)
  await driver.setItem(STORAGE_OAUTH_TOKEN_KEY, token)
  try {
    const session = await fetchAll()
    return session
  } catch (error) {
    // Do not keep a half-written pair that cannot be used.
    await driver.removeItem(STORAGE_CREDENTIAL_KEY)
    await driver.removeItem(STORAGE_OAUTH_TOKEN_KEY)
    throw new Error(friendlyError(error))
  }
}

export async function restoreSession() {
  const pair = getStoredPair()
  if (!pair) return null
  try {
    return await fetchAll()
  } catch {
    return null
  }
}

export async function logout() {
  await driver.removeItem(STORAGE_CREDENTIAL_KEY)
  await driver.removeItem(STORAGE_OAUTH_TOKEN_KEY)
  await driver.removeItem(STORAGE_USER_ID_KEY)
  // Keep the device id; it is not a credential and avoids extra fingerprint calls.
  void STORAGE_DID_KEY
}

function friendlyError(error) {
  const msg = String(error?.message || error || '')
  if (msg.includes('设备信息无效')) return '森空岛设备校验失败，请刷新页面重试（设备指纹生成异常）'
  if (msg.includes('cred') || msg.includes('登录')) return msg
  if (msg.includes('fetch') || msg.includes('timeout')) return '网络请求失败，请检查网络或稍后重试'
  return msg || '登录失败'
}
