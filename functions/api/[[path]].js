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
  } else if (path.startsWith('skland/')) {
    targetUrl = 'https://zonai.skland.com/api/v1/' + path.replace('skland/', '') + queryStr;
  } else {
    return new Response('Not Found', { status: 404 });
  }
  
  const headers = { 'Content-Type': 'application/json', 'User-Agent': 'AK-Scheduler/1.0' };
  const cred = request.headers.get('cred');
  if (cred) headers['cred'] = cred;
  const ts = request.headers.get('Timestamp');
  if (ts) headers['Timestamp'] = ts;
  const sign = request.headers.get('Sign');
  if (sign) headers['Sign'] = sign;
  
  try {
    const body = request.method === 'GET' ? undefined : await request.text();
    const resp = await fetch(targetUrl, { method: request.method, headers, body: body || undefined });
    const data = await resp.text();
    return new Response(data, { status: resp.status, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 502, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
}
