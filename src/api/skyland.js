/**
 * 鹰角 / 森空岛 API 封装 — 全部内联，零外部依赖
 *
 * 现行接口（2026 实测确认）：
 * - zonai.skland.com 允许浏览器跨域（Access-Control-Allow-Origin: *），cred 直连即可，无需签名
 * - 旧版 /web/v1/auth/refresh + HMAC 签名流程已随接口改版失效，已移除
 * - as.hypergryph.com 不带 CORS 头：密码/验证码登录需走 CF Pages Functions 代理或自定义 CORS 代理
 *
 * 登录链路（现行）：
 *   账号密码  -> POST /user/auth/v1/token_by_phone_password        -> token
 *   手机验证码 -> POST /general/v1/send_phone_code + /user/auth/v2/token_by_phone_code -> token
 *   token     -> POST /user/oauth2/v2/grant  (appCode 固定值)      -> code
 *   code      -> POST /api/v1/user/auth/generate_cred_by_code      -> cred
 *   cred      -> GET  /api/v1/game/player/binding / player/info    -> 游戏数据
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
 * - CF Pages / 本地：走仓库内 functions/api 代理（/api/sk、/api/ah）
 * - GitHub Pages 等其他静态托管：直连（zonai.skland.com 支持 CORS），
 *   若配置了自定义 CORS 代理（ak_cors_proxy）则优先走代理
 */
export function resolveApiUrl(url) {
  const pre = (localStorage.getItem('ak_cors_proxy') || '').replace(/\/$/, '')
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

// ===== 游戏数据 =====
export async function fetchGameData(cred) {
  const r2 = await req(SKLAND + '/api/v1/game/player/binding', { headers: { cred } })
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

  const r3 = await req(SKLAND + '/api/v1/game/player/info?uid=' + akUid, { headers: { cred } })
  if (r3.code !== 0) throw new Error('数据:' + (r3.message || r3.code))

  const d = r3.data
  const charInfoMap = d.charInfoMap || {}
  const chars = (d.chars || []).map(c => {
    const info = charInfoMap[c.charId] || {}
    return {
      id: c.charId,
      charId: c.charId,
      name: info.name || c.charId,
      rarity: info.rarity || c.rarity || 1,
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
export function saveCredential(cred) { if (cred) localStorage.setItem('ak_cred', cred) }
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
