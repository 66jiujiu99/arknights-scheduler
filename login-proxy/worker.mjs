/**
 * 鹰角登录代理 Worker (ES Module 格式)
 * 部署到 Cloudflare Workers
 */
const ALLOW_ORIGINS = [
  'https://66jiujiu99.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
];

const HYPERGRYPH_API = 'https://as.hypergryph.com';
const SKYLAND_API = 'https://www.skland.com/api/v1';

function corsHeaders(origin) {
  const allow = ALLOW_ORIGINS.includes(origin) ? origin : ALLOW_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, cred, Timestamp, Sign, dId, platform',
    'Access-Control-Max-Age': '86400',
  };
}

async function handleRequest(request) {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin') || '';

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(origin) });
  }

  if (!url.pathname.startsWith('/api/')) {
    return new Response('Not Found', { status: 404 });
  }

  const targetPath = url.pathname.replace('/api/', '');
  const queryStr = url.search;
  let targetUrl;

  if (targetPath.startsWith('auth/')) {
    targetUrl = `${HYPERGRYPH_API}/${targetPath}`;
  } else if (targetPath.startsWith('skland/')) {
    targetUrl = `${SKYLAND_API}/${targetPath.replace('skland/', '')}${queryStr}`;
  } else {
    return new Response('Invalid path', { status: 400 });
  }

  const body = request.method === 'GET' ? undefined : await request.text();
  const headers = { 'Content-Type': 'application/json', 'User-Agent': 'AK-Scheduler/1.0' };

  const cred = request.headers.get('cred');
  if (cred) headers['cred'] = cred;
  const ts = request.headers.get('Timestamp');
  if (ts) headers['Timestamp'] = ts;
  const sign = request.headers.get('Sign');
  if (sign) headers['Sign'] = sign;

  try {
    const resp = await fetch(targetUrl, { method: request.method, headers, body: body || undefined });
    const data = await resp.text();
    return new Response(data, { status: resp.status, headers: corsHeaders(origin) });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 502, headers: corsHeaders(origin) });
  }
}

export default { fetch: handleRequest };
