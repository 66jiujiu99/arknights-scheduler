/**
 * 罗德岛智能排班系统 — 登录 CORS 代理（Cloudflare Worker 版）
 *
 * 用途：明日方舟官网 / 森空岛的 as.hypergryph.com 接口不带 CORS 头，
 *       账号密码 / 手机验证码登录需要经过本代理转发。
 *
 * 部署：Cloudflare Dashboard → Workers & Pages → 创建 Worker，
 *       把本文件内容粘贴进去部署，然后把 Worker 地址填入应用的
 *       「CORS 代理配置」输入框（格式 https://你的worker名.workers.dev/）。
 *
 * 路由（与应用内约定一致）：
 *   /api/sw/* -> https://zonai.skland.com/web/*
 *   /api/sk/* -> https://zonai.skland.com/api/*
 *   /api/ah/* -> https://as.hypergryph.com/*
 *
 * 安全：仅允许 *.pages.dev / *.github.io / localhost 来源的浏览器调用，
 *       避免被第三方站点当作开放 CORS 代理滥用。
 */
const ALLOWED_ORIGIN_RE = [
  /^https:\/\/[a-z0-9-]+\.pages\.dev$/i,
  /^https:\/\/[a-z0-9-]+\.github\.io$/i,
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i,
];

function originAllowed(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return true; // 非浏览器请求（服务器/脚本直连）不限制
  return ALLOWED_ORIGIN_RE.some((re) => re.test(origin));
}

export default {
  async fetch(request) {
    if (!originAllowed(request)) {
      return new Response(JSON.stringify({ error: 'origin not allowed' }), { status: 403 });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace('/api/', '');
    const queryStr = url.search;

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, cred, sign, platform, timestamp, dId, vName',
          'Access-Control-Max-Age': '86400',
        },
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
      return new Response(data, {
        status: resp.status,
        headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, cred' },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 502,
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }
  },
};
