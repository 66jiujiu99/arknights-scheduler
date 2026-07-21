/**
 * 新增：从明日方舟官网登录 — 使用 ak-user-center cookie
 * 
 * 用户登录 ak.hypergryph.com 后，F12 → Application → Cookies → ak-user-center
 * 复制值粘贴到本工具，通过鹰角SSO换取游戏数据
 */

// skland API 基础地址
const SKYLAND_API = 'https://www.skland.com/api/v1'
const HYPERGRYPH_API = 'https://as.hypergryph.com'

/**
 * 使用 ak-user-center cookie 获取游戏数据
 * 流程：ak-user-center → 尝试直接当cred用 → 如果不行，用它换token
 */
export async function loginWithAkcookie(cookieValue) {
  // 尝试1: 直接当 cred 用
  try {
    const data = await fetchGameDataWithCookie(cookieValue)
    if (data && data.chars) return { cred: cookieValue, data }
  } catch {}

  // 尝试2: 用 cookie 换取鹰角 token → cred → 游戏数据
  try {
    const token = await exchangeTokenFromCookie(cookieValue)
    if (token) {
      const cred = await exchangeCredDirect(token)
      if (cred) {
        saveCredential(cred)
        const gameData = await fetchGameDataWithCookie(cred)
        if (gameData) return { cred, data: gameData }
      }
    }
  } catch {}

  throw new Error('无法使用该凭证，请检查是否已登录明日方舟官网')
}

async function fetchGameDataWithCookie(cred) {
  const ts = Date.now()
  const encoder = new TextEncoder()
  const data = encoder.encode(`${ts}${cred}`)
  const hash = await crypto.subtle.digest('SHA-256', data)
  const sign = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')

  const res = await fetch(`${SKYLAND_API}/game/player/info?channel_id=1&app_code=arknights`, {
    headers: {
      'cred': cred,
      'Timestamp': String(ts),
      'Sign': sign,
      'dId': 'web',
      'platform': 'web',
    },
  })
  const json = await res.json()
  if (json.code !== 0) throw new Error(json.message || '获取数据失败')
  return json.data
}

async function exchangeTokenFromCookie(cookieValue) {
  // 假设 ak-user-center 是一个可用的认证令牌
  const res = await fetch(`${HYPERGRYPH_API}/user/info`, {
    headers: {
      'Authorization': `Bearer ${cookieValue}`,
      'Content-Type': 'application/json',
    },
  })
  if (!res.ok) throw new Error('Token无效')
  // 如果能获取用户信息，尝试用这个token换cred
  return cookieValue
}

async function exchangeCredDirect(token) {
  const res = await fetch(`${SKYLAND_API}/auth/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'cred': token,
    },
    body: JSON.stringify({ appCode: 'arknights' }),
  })
  const json = await res.json()
  if (json.code !== 0) throw new Error(json.message || '换取凭证失败')
  return json.data?.cred
}

function saveCredential(cred) {
  localStorage.setItem('ak_cred', cred)
}
