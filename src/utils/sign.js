/**
 * JS 签名工具 — 纯内联实现，无外部依赖
 * HMAC-SHA256 + MD5 (配合 zonai.skland.com API)
 */

// ===== MD5 =====
const MD5 = (() => {
  const hex = '0123456789abcdef'
  function F(x,y,z) { return (x & y) | (~x & z) }
  function G(x,y,z) { return (x & z) | (y & ~z) }
  function H(x,y,z) { return x ^ y ^ z }
  function I(x,y,z) { return y ^ (x | ~z) }
  function rol(v, n) { return (v << n) | (v >>> (32 - n)) }
  const T = [], S=[7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21]
  for(let i=1;i<=64;i++) T[i]=Math.floor(Math.abs(Math.sin(i))*4294967296)

  return function md5(s) {
    let a=1732584193,b=4023233417,c=2562383102,d=271733878
    const l=s.length, n=(((l+8)>>6)+1)*16, w=new Array(n).fill(0)
    for(let i=0;i<l;i++) w[i>>2]|=(s.charCodeAt(i)&255)<<((i%4)*8)
    w[l>>2]|=128<<((l%4)*8)
    w[n-2]=l*8
    for(let i=0;i<n;i+=16){
      let A=a,B=b,C=c,D=d
      for(let j=0;j<16;j++){let t=a+F(b,c,d)+w[i+j]+T[j+1];a=d;d=c;c=b;b=b+rol(t,S[j])}
      for(let j=16;j<32;j++){let g=(5*j+1)%16,t=a+G(b,c,d)+w[i+g]+T[j+1];a=d;d=c;c=b;b=b+rol(t,S[j])}
      for(let j=32;j<48;j++){let g=(3*j+5)%16,t=a+H(b,c,d)+w[i+g]+T[j+1];a=d;d=c;c=b;b=b+rol(t,S[j])}
      for(let j=48;j<64;j++){let g=(7*j)%16,t=a+I(b,c,d)+w[i+g]+T[j+1];a=d;d=c;c=b;b=b+rol(t,S[j])}
      a=a+A>>>0;b=b+B>>>0;c=c+C>>>0;d=d+D>>>0
    }
    let r=''
    for(let n of[a,b,c,d]) r+=hex[n>>4&15]+hex[n&15]+hex[n>>12&15]+hex[n>>8&15]+hex[n>>20&15]+hex[n>>16&15]+hex[n>>28&15]+hex[n>>24&15]
    return r
  }
})()

// ===== HMAC-SHA256 =====
function hmacSHA256(key, data) {
  const k = key.length > 64 ? sha256(key) : key.split('').map(c=>c.charCodeAt(0))
  const kPad = new Array(64).fill(0)
  for(let i=0;i<k.length&&i<64;i++) kPad[i]=k[i]
  
  const inner = sha256(kPad.map(b=>b^0x36).concat(strToBytes(data)))
  return sha256(kPad.map(b=>b^0x5c).concat(inner))
}

function strToBytes(s) {
  const b = []
  for(let i=0;i<s.length;i++) {
    const c = s.charCodeAt(i)
    if(c<128) b.push(c)
    else if(c<2048) b.push(192|c>>6,128|c&63)
    else b.push(224|c>>12,128|c>>6&63,128|c&63)
  }
  return b
}

// ===== SHA-256 =====
function sha256(msg) {
  const w = new Uint32Array(64)
  const H = [1779033703,3144134277,1013904242,2773480762,1359893119,2600822924,528734635,1541459225]
  const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]
  
  const raw = typeof msg === 'string' ? new TextEncoder().encode(msg) : new Uint8Array(msg)
  const bits = raw.length * 8, ml = bits.toString(16)
  const padded = new Uint8Array(Math.ceil((raw.length + 9) / 64) * 64)
  padded.set(raw); padded[raw.length] = 0x80
  
  const dv = new DataView(padded.buffer)
  dv.setUint32(padded.length - 8, 0, false)
  dv.setUint32(padded.length - 4, parseInt(ml.slice(-8).padStart(8,'0'), 16) || 0, false)
  dv.setUint32(padded.length - 8, parseInt(ml.slice(0,-8).padStart(8,'0'), 16) || 0, false)
  
  function rr(a,b){return(a>>>b)|(a<<(32-b))}
  
  for(let i=0;i<padded.length;i+=64){
    for(let j=0;j<16;j++) w[j]=dv.getUint32(i+j*4,false)
    for(let j=16;j<64;j++){
      const s0=rr(w[j-15],7)^rr(w[j-15],18)^(w[j-15]>>>3)
      const s1=rr(w[j-2],17)^rr(w[j-2],19)^(w[j-2]>>>10)
      w[j]=(w[j-16]+s0+w[j-7]+s1)|0
    }
    let a=H[0],b=H[1],c=H[2],d=H[3],e=H[4],f=H[5],g=H[6],h=H[7]
    for(let j=0;j<64;j++){
      const S1=rr(e,6)^rr(e,11)^rr(e,25), ch=(e&f)^(~e&g)
      const t1=(h+S1+ch+K[j]+w[j])|0
      const S0=rr(a,2)^rr(a,13)^rr(a,22), maj=(a&b)^(a&c)^(b&c)
      h=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+S0+maj)|0
    }
    H[0]=(H[0]+a)|0;H[1]=(H[1]+b)|0;H[2]=(H[2]+c)|0;H[3]=(H[3]+d)|0
    H[4]=(H[4]+e)|0;H[5]=(H[5]+f)|0;H[6]=(H[6]+g)|0;H[7]=(H[7]+h)|0
  }
  
  const result = []
  for(let i=0;i<8;i++) for(let j=3;j>=0;j--) result.push((H[i]>>>(j*8))&255)
  return result
}

/**
 * 生成 zonai.skland.com 签名（与一图流完全一致）
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
  const hmacHex = hmacSHA256(token, text).map(b=>b.toString(16).padStart(2,'0')).join('')
  const sign = MD5(hmacHex)
  return { timestamp, sign, headers }
}
