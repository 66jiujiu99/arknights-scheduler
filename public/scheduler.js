// ===== 排班算法 v2 =====
const FACILITY_CFG = {
  manufacture: { label:'制造站', slots:3, moodCost:0.75 },
  trading:     { label:'贸易站', slots:3, moodCost:0.75 },
  power:       { label:'发电站', slots:2, moodCost:0.75 },
  meeting:     { label:'会客室', slots:2, moodCost:0.5 },
  training:    { label:'训练室', slots:1, moodCost:0.3 },
  control:     { label:'控制中心', slots:4, moodCost:0.5 },
  dormitory:   { label:'宿舍', slots:5, moodCost:0 },
}

// 制造产物分类
function classifyMF(desc) {
  if (!desc) return '通用'
  if (desc.includes('源石')) return '源石碎片'
  if (desc.includes('贵金属')||desc.includes('赤金')) return '赤金'
  if (desc.includes('作战记录')) return '作战记录'
  if (desc.includes('技巧概要')) return '技巧概要'
  if (desc.includes('仓库')||desc.includes('容量')) return '仓库'
  return '通用'
}

let baseSkillsCache = null
async function loadBaseSkills() {
  if (baseSkillsCache) return baseSkillsCache
  const r = await fetch('/data/baseSkills.json')
  baseSkillsCache = await r.json()
  return baseSkillsCache
}

function analyzeSkills(chars, skills) {
  // 为每个干员提取详细的设施技能信息
  return (chars||[]).map(c => {
    const sd = skills[c.charId]
    if (!sd) return { ...c, baseSkills: {}, mfCat: null, moods: [], combos: [] }
    const fac = {}, moods = [], combos = []
    let mfCat = null
    for (const [f, info] of Object.entries(sd)) {
      if (['name','rarity'].includes(f)) continue
      const desc = info.desc || ''
      fac[f] = { type: info.type||'', value: info.value||0, desc }
      // 心情消耗
      if (desc.includes('心情每小时消耗')) {
        const m = desc.match(/心情每小时消耗([+-])([\d.]+)/)
        if (m) moods.push({ facility: f, cost: parseFloat(m[1]+m[2]) })
      }
      // 联动
      if (desc.includes('若') || desc.includes('当') || desc.includes('如果')) {
        combos.push({ facility: f, desc: desc.slice(0,60) })
      }
      // 制造分类
      if (f === 'manufacture') mfCat = classifyMF(desc)
    }
    return { ...c, rarity: sd.rarity||c.rarity||1, baseSkills: fac, mfCat, moods, combos }
  })
}

// 为指定产物类型选择最优制造干员
function pickMF(facType, pool, count, cat) {
  // 筛选匹配产物类型的干员
  const skilled = pool.filter(o => o.baseSkills && o.baseSkills[facType] && o.mfCat === cat)
    .sort((a,b) => (b.baseSkills[facType]?.value||0) - (a.baseSkills[facType]?.value||0))
  // 备选（通用型或其他分类）
  const fallback = pool.filter(o => o.baseSkills && o.baseSkills[facType] && o.mfCat !== cat)
    .sort((a,b) => (b.baseSkills[facType]?.value||0) - (a.baseSkills[facType]?.value||0))
  
  const used = new Set(), assigned = []
  let eff = 0
  for (const list of [skilled, fallback]) {
    for (const op of list) {
      if (assigned.length >= count) break
      if (used.has(op.charId)) continue
      used.add(op.charId)
      const s = op.baseSkills[facType]
      assigned.push({ name: op.name||op.charId, rarity: op.rarity, skill: s, moodCost: op.moods?.find(m=>m.facility===facType) })
      eff += s?.value||0
    }
  }
  // 补通用/空位
  for (const op of pool) {
    if (assigned.length >= count) break
    if (used.has(op.charId)) continue
    used.add(op.charId)
    assigned.push({ name: op.name||op.charId, rarity: op.rarity, skill: { type:'general', value:0, desc:'通用' }, moodCost: null })
  }
  while (assigned.length < count) assigned.push({ name:'空位', rarity:1, skill:{ type:'empty', value:0, desc:'待分配' }, moodCost: null })
  return { assigned, efficiency: eff }
}

// 选择最优设施干员（非制造）
function pickForFacility(type, pool, count) {
  const skilled = pool.filter(o => o.baseSkills && o.baseSkills[type])
    .sort((a,b) => (b.baseSkills[type]?.value||0) - (a.baseSkills[type]?.value||0))
  const used = new Set(), assigned = []
  let eff = 0
  for (const op of skilled) {
    if (assigned.length >= count) break
    if (used.has(op.charId)) continue
    used.add(op.charId)
    assigned.push({ name: op.name||op.charId, rarity: op.rarity, skill: op.baseSkills[type], moodCost: op.moods?.find(m=>m.facility===type) })
    eff += op.baseSkills[type]?.value||0
  }
  for (const op of pool) {
    if (assigned.length >= count) break
    if (used.has(op.charId)) continue
    used.add(op.charId)
    assigned.push({ name: op.name||op.charId, rarity: op.rarity, skill: { type:'general', value:0, desc:'通用' }, moodCost: null })
  }
  while (assigned.length < count) assigned.push({ name:'空位', rarity:1, skill:{ type:'empty', value:0, desc:'待分配' }, moodCost: null })
  return { assigned, efficiency: eff }
}

function pickControl(pool, count) {
  // 控制中心选最高稀有度+有特殊技能的干员
  const sorted = [...pool].sort((a, b) => {
    // 优先有联动/特殊技能的
    const aCombo = a.combos?.length||0
    const bCombo = b.combos?.length||0
    if (aCombo !== bCombo) return bCombo - aCombo
    return b.rarity - a.rarity
  })
  return pickForFacility('control', sorted, count)
}

function generateSchedule(userData, skills) {
  const chars = analyzeSkills(userData.chars||[], skills)
  const bld = userData.building||{}
  
  // 实际设施数量
  const mfCount = Math.max((bld.manufactures||[]).length, 2)
  const trCount = Math.max((bld.tradings||[]).length, 1)
  const pwCount = 2 // 发电站通常2个
  const mtCount = 1
  const dormCount = Math.max((bld.dormitories?.length||0), 4)
  
  // 制造站产物分配（按用户干员技能自动分配）
  const mfCats = ['赤金', '作战记录', '源石碎片', '技巧概要', '通用']
  
  const schedules = []
  for (let s = 0; s < 2; s++) { // A/B两班
    const pool = [...chars]
    const offset = Math.floor(pool.length / 2) * s
    const rotated = [...pool.slice(offset), ...pool.slice(0, offset)]
    
    const facs = {}
    let totalEff = 0
    
    // 1. 控制中心（用全体pool，不轮换）
    facs.control = pickControl(pool, 4)
    
    // 2. 制造站（按产物分类）
    facs.manufacture = []
    for (let m = 0; m < mfCount; m++) {
      const cat = mfCats[m % mfCats.length]
      const r = pickMF('manufacture', rotated, 3, cat)
      facs.manufacture.push({ ...r, label: `制造站${m+1}(${cat})` })
      totalEff += r.efficiency
    }
    
    // 3. 贸易站
    facs.trading = []
    for (let t = 0; t < trCount; t++) {
      const r = pickForFacility('trading', rotated, 3)
      facs.trading.push({ ...r, label: `贸易站${t+1}` })
      totalEff += r.efficiency
    }
    
    // 4. 发电站
    facs.power = []
    for (let p = 0; p < pwCount; p++) {
      const r = pickForFacility('power', rotated, 2)
      facs.power.push({ ...r, label: `发电站${p+1}` })
      totalEff += r.efficiency
    }
    
    // 5. 会客室
    facs.meeting = pickForFacility('meeting', rotated, 2)
    
    // 6. 训练室
    facs.training = pickForFacility('training', rotated, 1)
    
    // 计算总心情消耗
    let totalMood = 0
    for (const [fac, data] of Object.entries(facs)) {
      const items = data.assigned || (Array.isArray(data) ? data.flatMap(d => d.assigned) : [data]) || []
      const list = Array.isArray(data) ? data : [data]
      for (const item of list) {
        const ops = item.assigned || [item]
        for (const op of ops) {
          if (op.moodCost) totalMood += op.moodCost.cost
        }
      }
    }
    
    schedules.push({
      shift: s+1,
      label: ['A班','B班'][s],
      facilities: facs,
      efficiency: totalEff,
      moodCost: totalMood,
    })
  }
  return { schedules, totalEfficiency: schedules.reduce((s,x)=>s+x.efficiency,0) }
}

async function runSchedule() {
  const btn = document.getElementById('scheduleBtn')
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>计算中...'
  try {
    const raw = localStorage.getItem('ak_user_data')
    if (!raw) { alert('请先获取干员数据'); return }
    const userData = JSON.parse(raw)
    const skills = await loadBaseSkills()
    const result = generateSchedule(userData, skills)
    
    let html = '<div class="shift-tabs">'
    for (const sch of result.schedules) {
      html += `<div class="shift-tab active" onclick="showShift(this,'shift${sch.shift}')">${sch.label}</div>`
    }
    html += '</div>'
    
    for (const sch of result.schedules) {
      html += `<div id="shift${sch.shift}" style="display:${sch.shift===1?'block':'none'}">`
      
      // 控制中心
      html += `<div class="facility-card"><h4>🏛️ 控制中心</h4>`
      for (const op of (sch.facilities.control?.assigned||[])) {
        const cl = op.skill.value > 0 ? 'eff-good' : 'eff'
        html += `<div class="slot"><span class="name">${op.name}</span><span class="${cl}">${op.skill.desc||''}</span></div>`
      }
      html += '</div>'
      
      // 制造站
      for (const mf of (sch.facilities.manufacture||[])) {
        html += `<div class="facility-card"><h4>🏭 ${mf.label}</h4>`
        for (const op of (mf.assigned||[])) {
          const cl = op.skill.value > 0 ? 'eff-good' : 'eff'
          const mood = op.moodCost ? ` 💚${op.moodCost.cost>0?'+':''}${op.moodCost.cost}` : ''
          html += `<div class="slot"><span class="name">${op.name}</span><span class="${cl}">${op.skill.desc||''}${mood}</span></div>`
        }
        html += `<div class="eff-total" style="padding:4px;font-size:11px">效率: ${mf.efficiency.toFixed(1)}</div>`
        html += '</div>'
      }
      
      // 贸易站
      for (const tr of (sch.facilities.trading||[])) {
        html += `<div class="facility-card"><h4>🏪 ${tr.label}</h4>`
        for (const op of (tr.assigned||[])) {
          const cl = op.skill.value > 0 ? 'eff-good' : 'eff'
          html += `<div class="slot"><span class="name">${op.name}</span><span class="${cl}">${op.skill.desc||''}</span></div>`
        }
        html += `<div class="eff-total" style="padding:4px;font-size:11px">效率: ${tr.efficiency.toFixed(1)}</div>`
        html += '</div>'
      }
      
      // 发电站
      for (const pw of (sch.facilities.power||[])) {
        html += `<div class="facility-card"><h4>⚡ ${pw.label}</h4>`
        for (const op of (pw.assigned||[])) {
          const cl = op.skill.value > 0 ? 'eff-good' : 'eff'
          html += `<div class="slot"><span class="name">${op.name}</span><span class="${cl}">${op.skill.desc||''}</span></div>`
        }
        html += `<div class="eff-total" style="padding:4px;font-size:11px">效率: ${pw.efficiency.toFixed(1)}</div>`
        html += '</div>'
      }
      
      // 会客室
      if (sch.facilities.meeting?.assigned) {
        html += `<div class="facility-card"><h4>🤝 会客室</h4>`
        for (const op of sch.facilities.meeting.assigned) {
          const cl = op.skill.value > 0 ? 'eff-good' : 'eff'
          html += `<div class="slot"><span class="name">${op.name}</span><span class="${cl}">${op.skill.desc||''}</span></div>`
        }
        html += '</div>'
      }
      
      // 训练室
      if (sch.facilities.training?.assigned) {
        html += `<div class="facility-card"><h4>🎯 训练室</h4>`
        for (const op of sch.facilities.training.assigned) {
          const cl = op.skill.value > 0 ? 'eff-good' : 'eff'
          html += `<div class="slot"><span class="name">${op.name}</span><span class="${cl}">${op.skill.desc||''}</span></div>`
        }
        html += '</div>'
      }
      
      html += `<div class="eff-total">生产效率: ${sch.efficiency.toFixed(1)} | 心情消耗: ${sch.moodCost.toFixed(2)}/h</div>`
      html += '</div>'
    }
    html += `<div class="eff-total" style="margin-top:4px">两班总效率: ${result.totalEfficiency.toFixed(1)}</div>`
    document.getElementById('scheduleResult').innerHTML = html
    document.getElementById('scheduleCard').classList.add('show')
  } catch(e) {
    alert('排班失败: '+e.message)
    console.error(e)
  } finally {
    btn.disabled = false; btn.innerHTML = '⚡ 生成排班表'
  }
}

function showShift(el, id) {
  document.querySelectorAll('.shift-tab').forEach(t=>t.classList.remove('active'))
  el.classList.add('active')
  document.querySelectorAll('[id^="shift"]').forEach(d=>d.style.display='none')
  document.getElementById(id).style.display = 'block'
}
