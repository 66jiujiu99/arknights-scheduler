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
  if (path.startsWith('sw/')) {
    targetUrl = 'https://zonai.skland.com/web/' + path.slice(3) + queryStr;
  } else if (path.startsWith('sk/')) {
    targetUrl = 'https://zonai.skland.com/api/' + path.slice(3) + queryStr;
  } else if (path.startsWith('ah/')) {
    targetUrl = 'https://as.hypergryph.com/' + path.slice(3) + queryStr;
  } else {
    return new Response('Not Found', { status: 404 });
  }
  
  const fwd = ['cred', 'sign', 'platform', 'timestamp', 'dId', 'vName'];
  const headers = { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' };
  for (const h of fwd) {
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
