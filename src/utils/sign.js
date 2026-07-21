/**
 * zonai.skland.com 签名 — HMAC-SHA256 + MD5（纯内联，无外部依赖）
 */

// ===== SHA-256 =====
function sha256(msg) {
  const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]
  const H0 = [1779033703,3144134277,1013904242,2773480762,1359893119,2600822924,528734635,1541459225]
  const enc = new TextEncoder()
  const raw = typeof msg === 'string' ? enc.encode(msg) : msg
  const bits = raw.length * 8
  const padLen = ((raw.length + 9 + 63) & ~63)
  const padded = new Uint8Array(padLen)
  padded.set(raw)
  padded[raw.length] = 0x80
  const dv = new DataView(padded.buffer)
  dv.setBigUint64(padLen - 8, BigInt(bits), false)
  
  const w = new Uint32Array(64)
  let H = H0.slice()
  const rr = (a, n) => (a >>> n) | (a << (32 - n))
  
  for (let block = 0; block < padLen; block += 64) {
    for (let j = 0; j < 16; j++) w[j] = dv.getUint32(block + j * 4, false)
    for (let j = 16; j < 64; j++) {
      const s0 = rr(w[j-15], 7) ^ rr(w[j-15], 18) ^ (w[j-15] >>> 3)
      const s1 = rr(w[j-2], 17) ^ rr(w[j-2], 19) ^ (w[j-2] >>> 10)
      w[j] = (w[j-16] + s0 + w[j-7] + s1) | 0
    }
    let [a,b,c,d,e,f,g,h] = H
    for (let j = 0; j < 64; j++) {
      const S1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)
      const ch = (e & f) ^ (~e & g)
      const t1 = (h + S1 + ch + K[j] + w[j]) | 0
      const S0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      h = g; g = f; f = e; e = (d + t1) | 0
      d = c; c = b; b = a; a = (t1 + S0 + maj) | 0
    }
    H = H.map((v, i) => (v + [a,b,c,d,e,f,g,h][i]) | 0)
  }
  
  const out = []
  for (let i = 0; i < 8; i++) for (let j = 3; j >= 0; j--) out.push((H[i] >>> (j * 8)) & 255)
  return out
}

function hmacSHA256(key, data) {
  const enc = new TextEncoder()
  const kBytes = typeof key === 'string' ? [...enc.encode(key)] : [...key]
  const keyArr = kBytes.length > 64 ? sha256(kBytes) : kBytes
  const kPad = new Array(64).fill(0)
  for (let i = 0; i < keyArr.length && i < 64; i++) kPad[i] = keyArr[i]
  
  const inner = sha256(kPad.map(b => b ^ 0x36).concat([...enc.encode(data)]))
  return sha256(kPad.map(b => b ^ 0x5c).concat(inner))
}

// ===== MD5 =====
function md5(s) {
  const hex = '0123456789abcdef'
  const F = (x,y,z) => (x & y) | (~x & z)
  const G = (x,y,z) => (x & z) | (y & ~z)
  const H = (x,y,z) => x ^ y ^ z
  const I = (x,y,z) => y ^ (x | ~z)
  const rol = (v, n) => (v << n) | (v >>> (32 - n))
  const T = [0xd76aa478,0xe8c7b756,0x242070db,0xc1bdceee,0xf57c0faf,0x4787c62a,0xa8304613,0xfd469501,0x698098d8,0x8b44f7af,0xffff5bb1,0x895cd7be,0x6b901122,0xfd987193,0xa679438e,0x49b40821,0xf61e2562,0xc040b340,0x265e5a51,0xe9b6c7aa,0xd62f105d,0x02441453,0xd8a1e681,0xe7d3fbc8,0x21e1cde6,0xc33707d6,0xf4d50d87,0x455a14ed,0xa9e3e905,0xfcefa3f8,0x676f02d9,0x8d2a4c8a,0xfffa3942,0x8771f681,0x6d9d6122,0xfde5380c,0xa4beea44,0x4bdecfa9,0xf6bb4b60,0xbebfbc70,0x289b7ec6,0xeaa127fa,0xd4ef3085,0x04881d05,0xd9d4d039,0xe6db99e5,0x1fa27cf8,0xc4ac5665,0xf4292244,0x432aff97,0xab9423a7,0xfc93a039,0x655b59c3,0x8f0ccc92,0xffeff47d,0x85845dd1,0x6fa87e4f,0xfe2ce6e0,0xa3014314,0x4e0811a1,0xf7537e82,0xbd3af235,0x2ad7d2bb,0xeb86d391]
  const S = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21]
  const enc = new TextEncoder()
  const bytes = enc.encode(s)
  const l = bytes.length, n = (((l + 8) >> 6) + 1) * 16
  const w = new Array(n).fill(0)
  for (let i = 0; i < l; i++) w[i >> 2] |= (bytes[i] & 255) << ((i % 4) * 8)
  w[l >> 2] |= 0x80 << ((l % 4) * 8)
  
  const ml = l * 8
  w[n - 2] = ml & 0xffffffff
  w[n - 1] = Math.floor(ml / 0x100000000)
  
  let [a,b,c,d] = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476]
  
  for (let i = 0; i < n; i += 16) {
    let [A,B,C,D] = [a,b,c,d]
    for (let j = 0; j < 64; j++) {
      let round, func, g
      if (j < 16) { round = F; g = j }
      else if (j < 32) { round = G; g = (5 * j + 1) % 16 }
      else if (j < 48) { round = H; g = (3 * j + 5) % 16 }
      else { round = I; g = (7 * j) % 16 }
      const temp = d
      d = c
      c = b
      b = b + rol((a + round(b,c,d) + w[i + g] + T[j]) | 0, S[j])
      a = temp
    }
    a = (a + A) >>> 0
    b = (b + B) >>> 0
    c = (c + C) >>> 0
    d = (d + D) >>> 0
  }
  
  let r = ''
  for (const n of [a,b,c,d]) {
    for (let i = 0; i < 4; i++) {
      const byte = (n >>> (i * 8)) & 255
      r += hex[(byte >> 4) & 15] + hex[byte & 15]
    }
  }
  return r
}

/**
 * 生成 zonai.skland.com 签名
 */
export function generateSklandSign(path, params, token) {
  const timestamp = String(Math.floor((Date.now() - 300) / 1000))
  const headers = {
    platform: '3',
    timestamp,
    dId: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/118.0',
    vName: '1.2.0'
  }
  const text = path + (params || '') + timestamp + JSON.stringify(headers)
  const hmacBytes = hmacSHA256(token, text)
  const hmacHex = hmacBytes.map(b => b.toString(16).padStart(2, '0')).join('')
  const sign = md5(hmacHex)
  return { timestamp, sign, headers }
}
