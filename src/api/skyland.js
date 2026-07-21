/**
 * 鹰角 / 森空岛 API 封装 v4
 * 依据一图流源码重构：getBinding → getInfo → formatData
 */

import { generateSklandSign } from '../utils/sign.js'

const SKLAND_DOMAIN = 'https://zonai.skland.com'
const HYPERGRYPH_API = 'https://as.hypergryph.com'

let corsProxy = localStorage.getItem('ak_cors_proxy') || ''

export function setCorsProxy(url) {
  corsProxy = url
  localStorage.setItem('ak_cors_proxy', url)
}

function resolveUrl(url) {
  const onDev = typeof window !== 'undefined' &&
    (window.location.hostname.includes('pages.dev') || window.location.hostname.includes('localhost'))
  const base = onDev ? '' : corsProxy
  
  if (url.startsWith(SKYLAND_DOMAIN + '/api/v1')) {
    const path = url.slice(SKYLAND_DOMAIN.length)
    return base ? base.replace(/\/$/, '') + '/api/skland' + path : '/api/skland' + path
  }
  if (url.startsWith(SKYLAND_DOMAIN + '/web')) {
    const path = url.slice(SKYLAND_DOMAIN.length)
    return base ? base.replace(/\/$/, '') + '/api/skland-web' + path : '/api/skland-web' + path
  }
  if (url.startsWith(HYPERGRYPH_API)) {
    const path = url.slice(HYPERGRYPH_API.length)
    return base ? base.replace(/\/$/, '') + '/api/auth' + path : '/api/auth' + path
  }
  return url
}

async function request(url, options = {}) {
  const targetUrl = resolveUrl(url)
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    ...options.headers,
  }
  const res = await fetch(targetUrl, { ...options, headers })
  const text = await res.text()
  try { return JSON.parse(text) } catch { return { code: -1, message: text } }
}

/**
 * 1. 刷新签名 token
 */
async function refreshToken(cred) {
  const resp = await request(`${SKLAND_DOMAIN}/web/v1/auth/refresh`, { headers: { cred } })
  if (resp.code !== 0) throw new Error('刷新token失败: ' + (resp.message || ''))
  return resp.data.token
}

/**
 * 2. 获取绑定列表 → 找到明日方舟 uid
 */
async function getBinding(cred, token) {
  const path = '/api/v1/game/player/binding'
  const sign = generateSklandSign(path, '', token)
  const resp = await request(`${SKLAND_DOMAIN}${path}`, {
    headers: { cred, ...sign.headers, sign: sign.sign }
  })
  if (resp.code !== 0) throw new Error(resp.message || '获取绑定失败')

  const list = resp.data?.list || []
  let akData = { uid: '0', nickName: '', channelMasterId: '1', channelName: '官服' }

  for (const app of list) {
    if (app.appCode !== 'arknights') continue
    for (const b of app.bindingList || []) {
      akData = {
        uid: b.uid,
        nickName: b.nickName || '',
        channelMasterId: b.channelMasterId || '1',
        channelName: b.channelName || '官服'
      }
      if (b.isOfficial) break // 优先官服
    }
    break
  }
  return akData
}

/**
 * 3. 获取游戏数据（干员+基建+全部信息）
 */
async function getPlayerInfo(akUid, cred, token) {
  const param = `uid=${akUid}`
  const path = '/api/v1/game/player/info'
  const sign = generateSklandSign(path, param, token)
  const resp = await request(`${SKLAND_DOMAIN}${path}?${param}`, {
    headers: { cred, ...sign.headers, sign: sign.sign }
  })
  if (resp.code !== 0) throw new Error(resp.message || '获取数据失败')
  return resp.data
}

/**
 * 4. 格式化干员数据（对齐一图流格式）
 */
function formatChars(chars, charInfoMap) {
  // 简化版技能/模组映射（不依赖一图流的 operatorTable）
  const rarityMap = {}
  if (charInfoMap) {
    for (const [id, info] of Object.entries(charInfoMap)) {
      rarityMap[id] = info.rarity != null ? info.rarity + 1 : 1
    }
  }

  return (chars || []).map(c => ({
    charId: c.id || c.charId,
    rarity: rarityMap[c.id || c.charId] || c.rarity || 1,
    level: c.level || 1,
    elite: c.evolvePhase || 0,
    potential: Math.ceil((c.potentialRank || 0) + 1),
    mainSkillLevel: c.mainSkillLevel || 1,
    skills: (c.skills || []).map(s => s ? s.level || 0 : 0),
    equips: (c.equips || []).reduce((acc, e) => {
      acc[e.id || e.slotId] = e.level || 0
      return acc
    }, {}),
    own: true,
  }))
}

/**
 * 完整流程：cred → refreshToken → getBinding → getPlayerInfo → formatData
 */
export async function fetchGameData(cred) {
  const token = await refreshToken(cred)
  saveCredential(cred, token)

  const binding = await getBinding(cred, token)
  if (binding.uid === '0') throw new Error('未找到明日方舟角色绑定')

  const gameData = await getPlayerInfo(binding.uid, cred, token)

  const chars = formatChars(gameData.chars, gameData.charInfoMap)
  const building = gameData.building || {}

  const userData = {
    nickname: gameData.status?.nickName || binding.nickName || '博士',
    level: gameData.status?.level || 0,
    uid: binding.uid,
    server: binding.channelName,
    chars,
    charInfoMap: gameData.charInfoMap || {},
    building: {
      manufactures: building.manufactures || [],
      tradings: building.tradings || [],
      dormitories: building.dormitories || [],
      power: building.power || null,
      meeting: building.meeting || null,
      training: building.training || null,
      tiredChars: building.tiredChars || [],
      labor: building.labor || {},
    },
    skins: gameData.skins || [],
    recruit: gameData.recruit || null,
  }

  localStorage.setItem('ak_user_data', JSON.stringify(userData))
  return userData
}

// 保留兼容的登录函数（后续可删，但 Login.vue 还引用）
export async function loginByPassword() { throw new Error('请使用森空岛Credential登录') }
export async function loginBySmsCode() { throw new Error('请使用森空岛Credential登录') }
export async function sendSmsCode() { throw new Error('请使用森空岛Credential登录') }
export async function exchangeCredential() { throw new Error('请使用森空岛Credential登录') }

// 保存/读取凭证
export function saveCredential(cred, token) {
  if (cred) localStorage.setItem('ak_cred', cred)
  if (token) localStorage.setItem('ak_token', token)
}

export function getSavedCredential() {
  return localStorage.getItem('ak_cred') || ''
}
