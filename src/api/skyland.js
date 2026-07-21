/**
 * 鹰角网络 / 森空岛 API 封装
 * 登录方式：账号密码、手机验证码、森空岛扫码
 */

// API 基础地址
const HYPERGRYPH_API = 'https://as.hypergryph.com'
const SKYLAND_API = 'https://www.skland.com/api/v1'

// CORS 代理地址（Cloudflare Worker）
let corsProxy = localStorage.getItem('ak_cors_proxy') || ''

export function setCorsProxy(url) {
  corsProxy = url
  localStorage.setItem('ak_cors_proxy', url)
}

function resolveUrl(url) {
  // 如果当前在 Pages.dev 域名下，用相对路径（无CORS）
  if (typeof window !== 'undefined' && 
      (window.location.hostname.includes('pages.dev') || window.location.hostname.includes('localhost'))) {
    let path = url
    if (url.startsWith(SKYLAND_API)) path = 'skland/' + url.slice(SKYLAND_API.length)
    else if (url.startsWith(HYPERGRYPH_API)) path = 'auth/' + url.slice(HYPERGRYPH_API.length)
    return '/api/' + path
  }
  // 有代理时走 Worker
  if (corsProxy) {
    let path = url
    if (url.startsWith(SKYLAND_API)) path = 'skland/' + url.slice(SKYLAND_API.length)
    else if (url.startsWith(HYPERGRYPH_API)) path = 'auth/' + url.slice(HYPERGRYPH_API.length)
    return corsProxy.replace(/\/$/, '') + '/api/' + path
  }
  return url
}

async function request(url, options = {}) {
  const targetUrl = resolveUrl(url)
  const res = await fetch(targetUrl, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (compatible; AK-Scheduler/1.0)',
      ...options.headers,
    },
  })
  const text = await res.text()
  try { return JSON.parse(text) } catch { return { code: -1, message: text } }
}

export async function loginByPassword(phone, password) {
  const data = await request(`${HYPERGRYPH_API}/user/auth/v1/token_by_phone_password`, {
    method: 'POST',
    body: JSON.stringify({ phone, password }),
  })
  if (data.status !== 0) throw new Error(data.msg || '登录失败')
  return data.data.token
}

export async function sendSmsCode(phone) {
  const data = await request(`${HYPERGRYPH_API}/general/v1/send_phone_code`, {
    method: 'POST',
    body: JSON.stringify({ phone }),
  })
  if (data.status !== 0) throw new Error(data.msg || '发送验证码失败')
  return true
}

export async function loginBySmsCode(phone, code) {
  const data = await request(`${HYPERGRYPH_API}/user/auth/v2/token_by_phone_code`, {
    method: 'POST',
    body: JSON.stringify({ phone, code }),
  })
  if (data.status !== 0) throw new Error(data.msg || '验证码登录失败')
  return data.data.token
}

export function saveCredential(cred) {
  localStorage.setItem('ak_cred', cred)
}

export function getSavedCredential() {
  return localStorage.getItem('ak_cred') || ''
}

export async function exchangeCredential(token) {
  const data = await request(`${SKYLAND_API}/auth/create`, {
    method: 'POST',
    headers: { 'cred': token },
    body: JSON.stringify({ appCode: 'arknights' }),
  })
  if (data.code !== 0) throw new Error(data.message || '换取凭证失败')
  const cred = data.data?.cred
  if (!cred) throw new Error('未获取到credential')
  return cred
}

/**
 * 获取游戏数据（干员列表、基建状态等）
 */
export async function fetchGameData(cred) {
  const ts = Date.now()
  const sign = await generateSign(ts, cred)
  
  const data = await request(
    `${SKYLAND_API}/game/player/info?channel_id=1&app_code=arknights`,
    {
      headers: {
        'cred': cred,
        'Timestamp': String(ts),
        'Sign': sign,
        'dId': 'web',
        'platform': 'web',
      },
    }
  )
  if (data.code !== 0) throw new Error(data.message || '获取数据失败')
  return data.data
}

async function generateSign(ts, cred) {
  const encoder = new TextEncoder()
  const data = encoder.encode(`${ts}${cred}`)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}
