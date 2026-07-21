/**
 * 鹰角登录代理 Worker
 * 部署到 Cloudflare Workers（免费版即可）
 * 
 * 解决静态页面调鹰角API的CORS问题
 * 不存储任何数据，仅做请求转发
 */

// 允许的来源域名（改成你的GitHub Pages地址）
const ALLOW_ORIGINS = [
  'https://66jiujiu99.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
]

// 鹰角 API 基础地址
const HYPERGRYPH_API = 'https://as.hypergryph.com'
const SKYLAND_API = 'https://www.skland.com/api/v1'

async function handleRequest(request) {
  const url = new URL(request.url)
  const origin = request.headers.get('Origin') || ''
  
  // CORS 预检
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders(origin),
    })
  }

  // 只处理 POST 请求到 /api/* 路径
  if (request.method !== 'POST' || !url.pathname.startsWith('/api/')) {
    return new Response('Not Found', { status: 404 })
  }

  const targetPath = url.pathname.replace('/api/', '')
  let targetUrl

  if (targetPath.startsWith('auth/')) {
    targetUrl = `${HYPERGRYPH_API}/${targetPath}`
  } else if (targetPath.startsWith('skland/')) {
    targetUrl = `${SKYLAND_API}/${targetPath.replace('skland/', '')}`
  } else {
    return new Response('Invalid path', { status: 400 })
  }

  const body = await request.text()
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'AK-Scheduler/1.0',
  }

  // 透传 credential/token 头
  const cred = request.headers.get('cred')
  if (cred) headers['cred'] = cred
  const ts = request.headers.get('Timestamp')
  if (ts) headers['Timestamp'] = ts
  const sign = request.headers.get('Sign')
  if (sign) headers['Sign'] = sign

  try {
    const resp = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: body || undefined,
    })

    const data = await resp.text()
    return new Response(data, {
      status: resp.status,
      headers: corsHeaders(origin),
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 502,
      headers: corsHeaders(origin),
    })
  }
}

function corsHeaders(origin) {
  const allowOrigin = ALLOW_ORIGINS.includes(origin) ? origin : ALLOW_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, cred, Timestamp, Sign, dId, platform',
    'Access-Control-Max-Age': '86400',
  }
}

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})
