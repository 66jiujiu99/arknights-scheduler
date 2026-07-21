import hmacSHA256 from 'crypto-js/hmac-sha256'
import md5 from 'crypto-js/md5'

/**
 * 鹰角网络 / 森空岛 API 封装 v3
 * 使用正确的 HMAC-SHA256 + MD5 签名
 */

const HYPERGRYPH_API = 'https://as.hypergryph.com'
const SKYLAND_API = 'https://zonai.skland.com/api/v1'

// CORS 代理地址
let corsProxy = localStorage.getItem('ak_cors_proxy') || ''

export function setCorsProxy(url) {
  corsProxy = url
  localStorage.setItem('ak_cors_proxy', url)
}

function resolveUrl(url) {
  // Pages.dev 域名用相对路径
  if (typeof window !== 'undefined' && 
      (window.location.hostname.includes('pages.dev') || window.location.hostname.includes('localhost'))) {
    let path = url
    if (url.startsWith(SKYLAND_API)) path = 'skland/' + url.slice(SKYLAND_API.length)
    else if (url.startsWith(HYPERGRYPH_API)) path = 'auth/' + url.slice(HYPERGRYPH_API.length)
    else if (url.startsWith('https://zonai.skland.com/web/')) path = 'skland-web/' + url.slice('https://zonai.skland.com/web/'.length)
    return '/api/' + path
  }
  if (corsProxy) {
    let path = url
    if (url.startsWith(SKYLAND_API)) path = 'skland/' + url.slice(SKYLAND_API.length)
    else if (url.startsWith(HYPERGRYPH_API)) path = 'auth/' + url.slice(HYPERGRYPH_API.length)
    else if (url.startsWith('https://zonai.skland.com/web/')) path = 'skland-web/' + url.slice('https://zonai.skland.com/web/'.length)
    return corsProxy.replace(/\/$/, '') + '/api/' + path
  }
  return url
}

async function request(url, options = {}) {
  const targetUrl = resolveUrl(url)
  console.log('[API] 请求:', targetUrl, options.method || 'GET')
  try {
    const res = await fetch(targetUrl, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Skland/1.0.1 (com.hypergryph.skland; build:100001014; Android 31; ) Okhttp/4.11.0',
        ...options.headers,
      },
    })
    const text = await res.text()
    console.log('[API] 响应:', res.status, text.slice(0,200))
    try { return JSON.parse(text) } catch { return { code: -1, message: text } }
  } catch (e) {
    console.error('[API] 异常:', e)
    return { code: -1, message: e.message }
  }
}

/**
 * 生成 zonai.skland.com 签名（与一图流完全一致）
 */
function generateSklandSign(path, params, token) {
  const timestamp = String(Math.floor((Date.now() - 300) / 1000))
  const headers = {
    platform: '3',
    timestamp,
    dId: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/118.0',
    vName: '1.2.0'
  }
  const text = path + (params || '') + timestamp + JSON.stringify(headers)
  const sign = md5(hmacSHA256(text, token).toString()).toString()
  return { timestamp, sign, headers }
}

/**
 * 保存凭证（cred + token）
 */
export function saveCredential(cred, token) {
  localStorage.setItem('ak_cred', cred)
  if (token) localStorage.setItem('ak_token', token)
}

export function getSavedCredential() {
  return localStorage.getItem('ak_cred') || ''
}

/**
 * 获取游戏数据
 * 使用 cred(认证) + token(签名) 调用 zonai.skland.com
 */
export async function fetchGameData(cred, _token) {
  // 1. 先刷新签名token
  const tokenResp = await request(SKYLAND_API.replace('/api/v1','') + '/web/v1/auth/refresh', {
    headers: { cred }
  })
  if (tokenResp.code !== 0) throw new Error('刷新签名token失败: ' + (tokenResp.message || ''))
  const token = tokenResp.data.token
  saveCredential(cred, token)
  
  // 2. 获取角色绑定列表
  const bindingPath = '/api/v1/game/player/binding'
  const bindingSign = generateSklandSign(bindingPath, '', token)
  
  const binding = await request(SKYLAND_API + bindingPath, {
    headers: {
      cred,
      ...bindingSign.headers,
      sign: bindingSign.sign,
    }
  })
  
  if (binding.code !== 0) throw new Error(binding.message || '获取绑定列表失败')
  
  // 找到明日方舟的角色
  const arknightsChar = binding.data?.list?.find(c => c.appCode === 'arknights')
  if (!arknightsChar) throw new Error('未找到明日方舟角色绑定')
  const uid = arknightsChar.bindingList[0].uid
  
  // 2. 获取游戏数据（干员+基建）
  const infoPath = '/api/v1/game/player/info'
  const infoQuery = `channel_id=1&uid=${uid}`
  const infoSign = generateSklandSign(infoPath, infoQuery, token)
  
  const info = await request(`${SKYLAND_API}${infoPath}?${infoQuery}`, {
    headers: {
      cred,
      ...infoSign.headers,
      sign: infoSign.sign,
    }
  })
  
  if (info.code !== 0) throw new Error(info.message || '获取游戏数据失败')
  return info.data
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
    method: 'POST', body: JSON.stringify({ phone }),
  })
  if (data.status !== 0) throw new Error(data.msg || '发送验证码失败')
  return true
}

export async function loginBySmsCode(phone, code) {
  const data = await request(`${HYPERGRYPH_API}/user/auth/v2/token_by_phone_code`, {
    method: 'POST', body: JSON.stringify({ phone, code }),
  })
  if (data.status !== 0) throw new Error(data.msg || '验证码登录失败')
  return data.data.token
}

export async function exchangeCredential(token) {
  const data = await request(`${SKYLAND_API}/user/auth/generate_cred_by_code`, {
    method: 'POST',
    body: JSON.stringify({ appCode: '4ca99fa6b56cc2ba', token, type: 0 }),
  })
  if (data.code !== 0) throw new Error(data.message || '换取凭证失败')
  return data.data
}
