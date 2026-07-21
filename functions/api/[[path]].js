export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/', '');
  const queryStr = url.search;
  
  if (request.method === 'OPTIONS') {
    return new Response(null, { 
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': '*', 'Access-Control-Max-Age': '86400' }
    });
  }
  
  let targetUrl;
  if (path.startsWith('auth/')) {
    targetUrl = 'https://as.hypergryph.com/' + path;
  } else if (path.startsWith('skland-web/')) {
    targetUrl = 'https://zonai.skland.com/web/' + path.replace('skland-web/', '') + queryStr;
  } else if (path.startsWith('skland/')) {
    targetUrl = 'https://zonai.skland.com/api/v1/' + path.replace('skland/', '') + queryStr;
  } else {
    return new Response('Not Found', { status: 404 });
  }
  
  // 透传前端发来的所有header（以cred/sign/platform/timestamp/dId/vName为主）
  const fwdHeaders = ['cred', 'sign', 'platform', 'timestamp', 'dId', 'vName'];
  const headers = { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; AK-Scheduler/1.0)' };
  for (const h of fwdHeaders) {
    const val = request.headers.get(h);
    if (val) headers[h] = val;
  }
  
  try {
    const body = request.method === 'GET' ? undefined : await request.text();
    const resp = await fetch(targetUrl, { method: request.method, headers, body: body || undefined });
    const data = await resp.text();
    return new Response(data, { status: resp.status, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 502, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
}
