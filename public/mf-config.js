/* 制造站产物配置UI */
const MF_CATS = ['赤金', '作战记录', '源石碎片', '技巧概要', '仓库', '通用']
function initMfConfig() {
  const row = document.getElementById('mfConfigRow')
  if (!row) return
  let cfg = JSON.parse(localStorage.getItem('ak_mf_config') || 'null') || ['赤金', '作战记录', '源石碎片', '通用', '赤金']
  renderMfConfig(cfg)
}
function renderMfConfig(cfg) {
  const row = document.getElementById('mfConfigRow')
  let h = ''
  for (let i = 0; i < cfg.length; i++) {
    h += `<div class="mf-chip" data-idx="${i}" onclick="cycleMfCat(${i})" style="cursor:pointer;padding:3px 8px;border-radius:4px;font-size:11px;background:rgba(15,22,41,.6);border:1px solid rgba(42,58,94,.3);color:#d4a843;letter-spacing:.5px">🏭${i+1} ${cfg[i]}</div>`
  }
  row.innerHTML = h
}
function cycleMfCat(idx) {
  let cfg = JSON.parse(localStorage.getItem('ak_mf_config') || 'null') || ['赤金', '作战记录', '源石碎片', '通用', '赤金']
  const ci = MF_CATS.indexOf(cfg[idx])
  cfg[idx] = MF_CATS[(ci + 1) % MF_CATS.length]
  localStorage.setItem('ak_mf_config', JSON.stringify(cfg))
  renderMfConfig(cfg)
}
// 在登录后根据实际制造站数量刷新配置
function refreshMfConfig(count) {
  let cfg = JSON.parse(localStorage.getItem('ak_mf_config') || 'null')
  if (!cfg || cfg.length !== count) {
    cfg = []
    const def = ['赤金', '作战记录', '源石碎片', '通用', '赤金']
    for (let i = 0; i < count; i++) cfg.push(def[i % def.length] || '通用')
    localStorage.setItem('ak_mf_config', JSON.stringify(cfg))
  }
  renderMfConfig(cfg)
}
