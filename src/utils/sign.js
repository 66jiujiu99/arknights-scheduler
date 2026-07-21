/**
 * 纯 JavaScript MD5 实现
 * 用于 zonai.skland.com 签名
 */
function md5(str) {
  const hexChars = '0123456789abcdef'
  
  function s(x, n) { return (x >>> n) | (x << (32 - n)) }
  
  function F(x, y, z) { return (x & y) | (~x & z) }
  function G(x, y, z) { return (x & z) | (y & ~z) }
  function H(x, y, z) { return x ^ y ^ z }
  function I(x, y, z) { return y ^ (x | ~z) }
  
  function FF(a, b, c, d, x, s, ac) { a = F(b, c, d) + a + x + ac; return s(a, s) + b }
  function GG(a, b, c, d, x, s, ac) { a = G(b, c, d) + a + x + ac; return s(a, s) + b }
  function HH(a, b, c, d, x, s, ac) { a = H(b, c, d) + a + x + ac; return s(a, s) + b }
  function II(a, b, c, d, x, s, ac) { a = I(b, c, d) + a + x + ac; return s(a, s) + b }
  
  function toWordArray(s) {
    const l = s.length
    const n = (((l + 8) >> 6) + 1) * 16
    const wa = new Array(n)
    for (let i = 0; i < n; i++) wa[i] = 0
    for (let i = 0; i < l; i++) wa[i >> 2] |= (s.charCodeAt(i) & 0xFF) << ((i % 4) * 8)
    wa[l >> 2] |= 0x80 << ((l % 4) * 8)
    wa[n - 2] = l * 8
    return wa
  }
  
  function wordsToHex(wa) {
    let hex = ''
    for (let i = 0; i < wa.length; i++) {
      hex += hexChars.charAt((wa[i] >> 4) & 0x0F) + hexChars.charAt(wa[i] & 0x0F) +
             hexChars.charAt((wa[i] >> 12) & 0x0F) + hexChars.charAt((wa[i] >> 8) & 0x0F) +
             hexChars.charAt((wa[i] >> 20) & 0x0F) + hexChars.charAt((wa[i] >> 16) & 0x0F) +
             hexChars.charAt((wa[i] >> 28) & 0x0F) + hexChars.charAt((wa[i] >> 24) & 0x0F)
    }
    return hex
  }
  
  // MD5 constants
  const S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
            5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
            4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
            6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21]
  const T = []
  for (let i = 1; i <= 64; i++) T[i] = Math.floor(Math.abs(Math.sin(i)) * 0x100000000)
  
  const x = toWordArray(str)
  let a = 0x67452301, b = 0xEFCDAB89, c = 0x98BADCFE, d = 0x10325476
  
  for (let i = 0; i < x.length; i += 16) {
    const A = a, B = b, C = c, D = d
    
    // Round 1
    for (let j = 0; j < 16; j++) {
      const t = a + F(b, c, d) + x[i + j] + T[j + 1]
      a = d; d = c; c = b; b = b + s(t, S[j])
    }
    // Round 2
    for (let j = 16; j < 32; j++) {
      const g = (j * 5 + 1) % 16
      const t = a + G(b, c, d) + x[i + g] + T[j + 1]
      a = d; d = c; c = b; b = b + s(t, S[j])
    }
    // Round 3
    for (let j = 32; j < 48; j++) {
      const g = (j * 3 + 5) % 16
      const t = a + H(b, c, d) + x[i + g] + T[j + 1]
      a = d; d = c; c = b; b = b + s(t, S[j])
    }
    // Round 4
    for (let j = 48; j < 64; j++) {
      const g = (j * 7) % 16
      const t = a + I(b, c, d) + x[i + g] + T[j + 1]
      a = d; d = c; c = b; b = b + s(t, S[j])
    }
    
    a = (a + A) >>> 0
    b = (b + B) >>> 0
    c = (c + C) >>> 0
    d = (d + D) >>> 0
  }
  
  return wordsToHex([a, b, c, d])
}

/**
 * 生成 zonai.skland.com API 签名
 * @param {string} token - 签名用的 token（不是 cred）
 * @param {string} path - API 路径，如 /api/v1/game/player/binding
 * @param {string} bodyOrQuery - GET: query string, POST: JSON body
 * @returns {{sign: string, headerCA: object}}
 */
export async function generateSklandSign(token, path, bodyOrQuery) {
  const ts = Math.floor(Date.now() / 1000) - 2  // 减2秒防止时间偏差
  const headerCA = {
    platform: 'web',
    timestamp: String(ts),
    dId: 'web',
    vName: ''
  }
  const headerCAStr = JSON.stringify(headerCA, Object.keys(headerCA).sort())
  
  // 拼接: path + bodyOrQuery + timestamp + headerCAJson
  const signStr = path + bodyOrQuery + String(ts) + headerCAStr
  
  // HMAC-SHA256 (key=token)
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(token),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  )
  const hmacResult = await crypto.subtle.sign('HMAC', key, encoder.encode(signStr))
  const hmacHex = Array.from(new Uint8Array(hmacResult))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  
  // MD5 of HMAC result
  const sign = md5(hmacHex)
  
  return { sign, headerCA, ts }
}
