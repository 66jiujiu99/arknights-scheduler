/**
 * 鹰角 / 森空岛 API 封装 — 全部内联，零外部依赖
 *
 * 现行协议（2026-08 从官方 web 端 JS 逆向确认）：
 * 1. GET  zonai.skland.com/web/v1/auth/refresh（header: cred）→ data.token（签名 token）
 * 2. 业务请求（zonai.skland.com/api/v1/...）签名：
 *    sign = md5(hmacSHA256(path + (GET ? query : body) + timestamp +
 *           JSON.stringify({platform:'3', timestamp, dId, vName}), token))
 * 3. zonai.skland.com 允许浏览器跨域（ACAO: *），GitHub Pages 直连可用；
 *    as.hypergryph.com 不带 CORS 头：密码/验证码登录需走 CF Pages Functions 代理或自定义 CORS 代理
 *
 * 登录链路：
 *   账号密码  -> POST /user/auth/v1/token_by_phone_password        -> token
 *   手机验证码 -> POST /general/v1/send_phone_code + /user/auth/v2/token_by_phone_code -> token
 *   token     -> POST /user/oauth2/v2/grant  (appCode 固定值)      -> code
 *   code      -> POST /api/v1/user/auth/generate_cred_by_code      -> cred
 *   cred      -> GET  /web/v1/auth/refresh                         -> 签名 token
 *   cred+token-> GET  /api/v1/game/player/binding / player/info    -> 游戏数据
 */
const SKLAND = 'https://zonai.skland.com'
const HYPERGRYPH = 'https://as.hypergryph.com'
const APP_CODE = '4ca99fa6b56cc2ba' // 森空岛 OAuth2 appCode（固定值）

function onCfPages() {
  if (typeof window === 'undefined') return false
  const h = window.location.hostname
  return h.includes('pages.dev') || h === 'localhost' || h === '127.0.0.1'
}

/**
 * 按部署环境解析 API 地址：
 * - CF Pages / 本地：走仓库内 functions/api 代理（/api/sw、/api/sk、/api/ah）
 * - GitHub Pages 等其他静态托管：直连 zonai.skland.com（支持 CORS），
 *   若配置了自定义 CORS 代理（ak_cors_proxy）则优先走代理
 */
export function resolveApiUrl(url) {
  const pre = (localStorage.getItem('ak_cors_proxy') || '').replace(/\/$/, '')
  if (url.startsWith(SKLAND + '/web')) {
    const suffix = url.slice(SKLAND.length + 4) // 去掉 '/web/'
    if (onCfPages()) return '/api/sw' + suffix
    return pre ? pre + '/api/sw' + suffix : url
  }
  if (url.startsWith(SKLAND + '/api')) {
    const suffix = url.slice(SKLAND.length + 4) // 去掉 '/api/'
    if (onCfPages()) return '/api/sk' + suffix
    return pre ? pre + '/api/sk' + suffix : url
  }
  if (url.startsWith(HYPERGRYPH)) {
    const suffix = url.slice(HYPERGRYPH.length)
    if (onCfPages()) return '/api/ah' + suffix
    return pre ? pre + '/api/ah' + suffix : url
  }
  return url
}

async function req(url, opt = {}) {
  const tu = resolveApiUrl(url)
  try {
    const r = await fetch(tu, { ...opt, headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0', ...opt.headers } })
    const t = await r.text()
    try { return JSON.parse(t) } catch { return { code: -1, message: t.slice(0, 500) } }
  } catch (e) { return { code: -1, message: e.message } }
}

// ===== 签名 =====
function getDId() {
  if (typeof localStorage === 'undefined') return 'web'
  let id = localStorage.getItem('ak_did')
  if (!id) {
    id = (crypto.randomUUID ? crypto.randomUUID() : 'web-' + Math.random().toString(16).slice(2) + Date.now().toString(16))
    localStorage.setItem('ak_did', id)
  }
  return id
}

async function hmacSHA256Hex(key, msg) {
  const enc = new TextEncoder()
  const keyBuf = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', keyBuf, enc.encode(msg))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// 标准 MD5（RFC 1321），已用测试向量验证（'abc' -> 900150983cd24fb0d6963f7d28e17f72）
function md5(s) {
  const HEX = '0123456789abcdef'
  const T = [0xd76aa478,0xe8c7b756,0x242070db,0xc1bdceee,0xf57c0faf,0x4787c62a,0xa8304613,0xfd469501,0x698098d8,0x8b44f7af,0xffff5bb1,0x895cd7be,0x6b901122,0xfd987193,0xa679438e,0x49b40821,0xf61e2562,0xc040b340,0x265e5a51,0xe9b6c7aa,0xd62f105d,0x02441453,0xd8a1e681,0xe7d3fbc8,0x21e1cde6,0xc33707d6,0xf4d50d87,0x455a14ed,0xa9e3e905,0xfcefa3f8,0x676f02d9,0x8d2a4c8a,0xfffa3942,0x8771f681,0x6d9d6122,0xfde5380c,0xa4beea44,0x4bdecfa9,0xf6bb4b60,0xbebfbc70,0x289b7ec6,0xeaa127fa,0xd4ef3085,0x04881d05,0xd9d4d039,0xe6db99e5,0x1fa27cf8,0xc4ac5665,0xf4292244,0x432aff97,0xab9423a7,0xfc93a039,0x655b59c3,0x8f0ccc92,0xffeff47d,0x85845dd1,0x6fa87e4f,0xfe2ce6e0,0xa3014314,0x4e0811a1,0xf7537e82,0xbd3af235,0x2ad7d2bb,0xeb86d391]
  const S = [[7,12,17,22],[5,9,14,20],[4,11,16,23],[6,10,15,21]]
  const enc = new TextEncoder()
  const bytes = enc.encode(s)
  const l = bytes.length
  const words = (((l + 8) >> 6) + 1) * 16
  const X = new Uint32Array(words)
  for (let i = 0; i < l; i++) X[i >> 2] |= (bytes[i] & 255) << ((i % 4) * 8)
  X[l >> 2] |= 0x80 << ((l % 4) * 8)
  X[words - 2] = (l * 8) >>> 0
  X[words - 1] = Math.floor(l / 0x100000000)
  const rotl = (v, n) => (v << n) | (v >>> (32 - n))
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476
  for (let i = 0; i < words; i += 16) {
    let A = a0, B = b0, C = c0, D = d0
    for (let j = 0; j < 64; j++) {
      let f, g, s
      if (j < 16)      { f = (B & C) | (~B & D);          g = j;                s = S[0][j % 4] }
      else if (j < 32) { f = (D & B) | (~D & C);          g = (5 * j + 1) % 16; s = S[1][j % 4] }
      else if (j < 48) { f = B ^ C ^ D;                   g = (3 * j + 5) % 16; s = S[2][j % 4] }
      else             { f = C ^ (B | ~D);                g = (7 * j) % 16;    s = S[3][j % 4] }
      const tmp = D
      D = C
      C = B
      B = (B + rotl((A + f + X[i + g] + T[j]) | 0, s)) | 0
      A = tmp
    }
    a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0
  }
  let r = ''
  for (const v of [a0, b0, c0, d0]) {
    for (let i = 0; i < 4; i++) { const byte = (v >>> (i * 8)) & 255; r += HEX[(byte >> 4) & 15] + HEX[byte & 15] }
  }
  return r
}

async function computeSign(path, query, method, body, ts, token) {
  const headers = { platform: '3', timestamp: ts, dId: getDId(), vName: '1.0.0' }
  let text = path
  text += method === 'GET' ? (query || '') : (body || '')
  text += ts
  text += JSON.stringify(headers)
  const hmacHex = await hmacSHA256Hex(token, text)
  return { sign: md5(hmacHex), ...headers }
}

async function signedReq(path, query, cred, token) {
  const ts = Math.floor(Date.now() / 1000).toString()
  const sig = await computeSign(path, query, 'GET', '', ts, token)
  return req(SKLAND + path + (query ? '?' + query : ''), {
    headers: { cred, sign: sig.sign, timestamp: sig.timestamp, dId: sig.dId, platform: sig.platform, vName: sig.vName },
  })
}

async function refreshToken(cred) {
  const r = await req(SKLAND + '/web/v1/auth/refresh', { headers: { cred } })
  if (r.code !== 0) throw new Error('刷新token:' + (r.message || r.code))
  return r.data?.token
}

// ===== 游戏数据 =====
export async function fetchGameData(cred, token = '') {
  if (!token) {
    token = await refreshToken(cred)
    if (!token) throw new Error('刷新token失败: 响应缺少 token')
    saveCredential(cred, token)
  }

  const r2 = await signedReq('/api/v1/game/player/binding', '', cred, token)
  if (r2.code !== 0) throw new Error('绑定:' + (r2.message || r2.code))

  let akUid = '0', akNick = '', akCh = '官服'
  for (const a of (r2.data?.list || [])) {
    if (a.appCode === 'arknights') {
      const b = a.bindingList[0]
      akUid = b.uid
      akNick = b.nickName || ''
      akCh = b.channelName || '官服'
      break
    }
  }
  if (akUid === '0') throw new Error('未找到明日方舟绑定')

  const r3 = await signedReq('/api/v1/game/player/info', 'uid=' + akUid, cred, token)
  if (r3.code !== 0) throw new Error('数据:' + (r3.message || r3.code))

  const d = r3.data
  const charInfoMap = d.charInfoMap || {}

  // 干员职业（区分多职业重名干员，如三个阿米娅：术师/近卫/医疗）
  const PROF_CN = { CASTER: '术师', WARRIOR: '近卫', MEDIC: '医疗', PIONEER: '先锋', SNIPER: '狙击', SUPPORT: '辅助', SPECIAL: '特种', TANK: '重装' }
  const nameCount = {}
  for (const c of (d.chars || [])) { const n = charInfoMap[c.charId]?.name || c.charId; nameCount[n] = (nameCount[n] || 0) + 1 }
  const displayNameOf = c => {
    const info = charInfoMap[c.charId] || {}
    const n = info.name || c.charId
    if (nameCount[n] > 1) return n + '(' + (PROF_CN[info.profession] || info.profession || '') + ')'
    return n
  }
  // charInfoMap 的 rarity 是 0 起始（5星=4），转成实际星级需 +1
  const starOf = c => c.rarity || ((charInfoMap[c.charId]?.rarity ?? -1) + 1) || 1

  const chars = (d.chars || []).map(c => {
    const info = charInfoMap[c.charId] || {}
    return {
      id: c.charId,
      charId: c.charId,
      name: info.name || c.charId,
      displayName: displayNameOf(c),
      rarity: starOf(c),
      level: c.level || 1,
      elite: c.evolvePhase || 0,
      potential: Math.ceil((c.potentialRank || 0) + 1),
      mainSkillLevel: c.mainSkillLvl || 1,
      skills: (c.skills || []).map(s => s ? (s.specializeLevel || 0) : 0),
      equips: (c.equip || []).reduce((a, e) => (a[e.id || e.slotId] = e.level || 0, a), {}),
      own: true,
    }
  })
  const b = d.building || {}
  return {
    nickname: d.status?.name || akNick,
    level: d.status?.level || 0,
    uid: akUid,
    server: akCh,
    chars,
    building: {
      manufactures: b.manufactures || [],
      tradings: b.tradings || [],
      dormitories: b.dormitories || [],
      powers: b.powers || [],
      meeting: b.meeting || null,
      training: b.training || null,
      tiredChars: b.tiredChars || [],
      labor: b.labor || {},
    },
  }
}

// ===== 登录 =====
export function saveCredential(cred, token) { if (cred) localStorage.setItem('ak_cred', cred); if (token) localStorage.setItem('ak_token', token) }
export function getSavedCredential() { return localStorage.getItem('ak_cred') || '' }
export function setCorsProxy(u) { localStorage.setItem('ak_cors_proxy', u) }

export async function sendSmsCode(phone) {
  const r = await req(HYPERGRYPH + '/general/v1/send_phone_code', { method: 'POST', body: JSON.stringify({ phone, type: 2 }) })
  if (r.status !== 0) throw new Error(r.msg || r.message || '发送验证码失败')
}

export async function loginByPassword(phone, password) {
  const r = await req(HYPERGRYPH + '/user/auth/v1/token_by_phone_password', { method: 'POST', body: JSON.stringify({ phone, password }) })
  if (r.status !== 0) throw new Error(r.msg || r.message || '密码登录失败')
  return r.data?.token
}

export async function loginBySmsCode(phone, code) {
  const r = await req(HYPERGRYPH + '/user/auth/v2/token_by_phone_code', { method: 'POST', body: JSON.stringify({ phone, code }) })
  if (r.status !== 0) throw new Error(r.msg || r.message || '验证码登录失败')
  return r.data?.token
}

/**
 * 鹰角通行证 token（或 ak-user-center cookie）→ 森空岛 cred
 */
export async function exchangeCredential(token) {
  const r = await req(HYPERGRYPH + '/user/oauth2/v2/grant', { method: 'POST', body: JSON.stringify({ token, appCode: APP_CODE, type: 0 }) })
  if (r.status !== 0) throw new Error(r.msg || r.message || '换取授权码失败')
  const code = r.data?.code
  if (!code) throw new Error('换取授权码失败: 响应缺少 code')

  const r2 = await req(SKLAND + '/api/v1/user/auth/generate_cred_by_code', { method: 'POST', body: JSON.stringify({ kind: 1, code }) })
  if (r2.code !== 0) throw new Error(r2.message || '生成凭证失败')
  return r2.data?.cred
}
