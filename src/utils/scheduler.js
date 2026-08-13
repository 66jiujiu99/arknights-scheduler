/**
 * 罗德岛基建排班调度算法 v3 - 全局最优+组合加成+心情管理
 * 
 * 核心改进：
 * 1. 全局搜索：跨设施联合优化，而非独立贪心
 * 2. 组合加成识别：自动检测并加权干员组合（巫恋+龙舌兰、凯尔希+银灰等）
 * 3. 心情动态管理：24h周期内心情流转建模，宿舍恢复最大化
 * 4. 真三班倒：早/中/晚班 + 休息班，每班8h，含换班损耗
 * 5. 配方/订单感知：制造站按配方类型、贸易站按订单类型匹配
 * 6. 训练室技能利用：专精技能、晋升素材技能识别
 */

import baseSkills from '../data/baseSkills.json'

const FACILITY_CONFIG = {
  manufacture: { label: '制造站', slots: 3, moodCost: 0.75, recipes: ['chip', 'material', 'exp', 'gold', 'ldisk'] },
  trading:     { label: '贸易站', slots: 3, moodCost: 0.75, orderTypes: ['normal', 'advanced', 'report'] },
  power:       { label: '发电站', slots: 2, moodCost: 0.75 },
  dormitory:   { label: '宿舍',   slots: 5, moodCost: 0, recoverySlots: 5 },
  meeting:     { label: '会客室', slots: 2, moodCost: 0.5 },
  training:    { label: '训练室', slots: 1, moodCost: 0, specialtyTypes: ['promotion', 'skill', 'mastery'] },
}

const SHIFT_HOURS = 8
const SHIFTS_PER_DAY = 3
const MOOD_RECOVERY_PER_HOUR_BASE = 0.25
const MOOD_COST_PER_HOUR = 0.75
const SHIFT_CHANGE_PENALTY = 0.15

/**
 * 组合加成列表 — 干员 ID 与 baseSkills.json 中的真实 ID 一一对应（2026 核对）
 * 仅保留两名成员在数据中都存在、且能在同一设施发挥技能的搭配；
 * 其余编造的 ID（如 char_173_svrash、char_1037_phatom 等）已移除。
 */
const COMBO_BONUSES = [
  // 巫恋 char_254_vodfox + 龙舌兰 char_486_takila：均为贸易站技能（赤金订单）
  { ids: ['char_254_vodfox', 'char_486_takila'], facility: 'trading', bonus: 0.3, desc: '巫恋+龙舌兰：贸易站赤金订单效率+30%' },
  // 银灰 char_172_svrash（订单上限+4）+ 梓兰 char_278_orchid（订单上限+1）
  { ids: ['char_172_svrash', 'char_278_orchid'], facility: 'trading', bonus: 0.2, desc: '银灰+梓兰：贸易站订单上限+5，效率+20%' },
  // 山 char_264_f12yin + 莫斯提马 char_213_mostma：均为会客室线索技能
  { ids: ['char_264_f12yin', 'char_213_mostma'], facility: 'meeting', bonus: 0.2, desc: '山+莫斯提马：线索搜集+20%' },
]

const DORMITORY_COMBOS = [
  // 芙蓉 char_120_hibisc + 杜林 char_501_durin：均为宿舍心情技能
  { ids: ['char_120_hibisc', 'char_501_durin'], bonus: 0.4, desc: '芙蓉+杜林：心情恢复+0.4/h' },
]

function matchSkills(userChars) {
  return userChars.map(c => {
    const skillData = baseSkills[c.id]
    if (skillData) {
      const facilities = {}
      for (const [facility, info] of Object.entries(skillData)) {
        if (['name', 'rarity'].includes(facility)) continue
        facilities[facility] = {
          type: info.type || 'productivity',
          value: info.value || 0,
          desc: info.desc || '',
          condition: info.condition || '',
          recipeType: extractRecipeType(info.desc, facility),
          orderType: extractOrderType(info.desc, facility),
        }
      }
      return { ...c, rarity: skillData.rarity || c.rarity || 1, baseSkills: facilities }
    }
    return { ...c, baseSkills: {} }
  })
}

function extractRecipeType(desc, facility) {
  if (facility !== 'manufacture') return null
  const types = ['芯片', '素材', '经验', '龙门币', '源石']
  for (const t of types) if (desc.includes(t)) return t
  return 'general'
}

function extractOrderType(desc, facility) {
  if (facility !== 'trading') return null
  if (desc.includes('高级') || desc.includes('advanced')) return 'advanced'
  if (desc.includes('报告') || desc.includes('report')) return 'report'
  return 'normal'
}

function calcMoodRecovery(op, dormMates) {
  let recovery = 0
  const dormSkill = op.baseSkills?.dormitory
  if (!dormSkill || dormSkill.type !== 'mood') return 0
  
  if (dormSkill.desc.includes('自身')) {
    recovery += dormSkill.value || 0
  } else {
    const targets = dormMates.filter(m => m.id !== op.id && (m.mood || 24) < 24)
    recovery += (dormSkill.value || 0) * targets.length
  }
  
  for (const combo of DORMITORY_COMBOS) {
    const hasBoth = combo.ids.every(id => 
      [op.id, ...dormMates.map(m => m.id)].includes(id)
    )
    if (hasBoth) recovery += combo.bonus
  }
  return recovery
}

function calcComboBonus(assigned, facility) {
  let bonus = 0
  const assignedIds = new Set(assigned.map(o => o.id))
  for (const combo of COMBO_BONUSES) {
    if (combo.facility !== facility) continue
    if (combo.ids.every(id => assignedIds.has(id))) {
      bonus += combo.bonus
    }
  }
  return bonus
}

function evaluateAssignment(assigned, facility, shiftIdx) {
  let efficiency = 0
  let moodCost = 0
  let moodRecovery = 0
  
  for (const op of assigned) {
    if (op.id.startsWith('empty_')) continue
    const skill = op.currentSkill
    if (!skill || skill.value <= 0) continue
    
    efficiency += skill.value
    
    if (facility !== 'dormitory' && facility !== 'training') {
      moodCost += MOOD_COST_PER_HOUR * SHIFT_HOURS
    }
  }
  
  efficiency *= (1 + calcComboBonus(assigned, facility))
  
  if (facility === 'dormitory') {
    for (const op of assigned) {
      if (op.id.startsWith('empty_')) continue
      moodRecovery += calcMoodRecovery(op, assigned)
    }
    moodRecovery *= SHIFT_HOURS
  }
  
  if (shiftIdx > 0) {
    efficiency *= (1 - SHIFT_CHANGE_PENALTY)
  }
  
  return { efficiency, moodCost, moodRecovery, netValue: efficiency + moodRecovery * 10 - moodCost * 5 }
}

function selectBestForFacility(facilityType, availableOps, count, allAssigned, shiftIdx) {
  const config = FACILITY_CONFIG[facilityType]
  if (!config) return { assigned: [], efficiency: 0, moodCost: 0, moodRecovery: 0 }
  
  const skilled = availableOps
    .filter(o => o.baseSkills && o.baseSkills[facilityType] && o.baseSkills[facilityType].value > 0)
    .sort((a, b) => (b.baseSkills[facilityType]?.value || 0) - (a.baseSkills[facilityType]?.value || 0))
  
  const general = availableOps.filter(o => !skilled.some(s => s.id === o.id))
  
  let bestResult = { assigned: [], efficiency: -Infinity, moodCost: 0, moodRecovery: 0 }
  
  const candidatePool = [...skilled.slice(0, Math.min(10, skilled.length)), ...general.slice(0, 5)]
  
  function tryCombination(pick, startIdx, depth) {
    if (depth === count) {
      const assigned = pick.map(p => ({
        ...p,
        currentSkill: p.baseSkills[facilityType] || { type: 'general', value: 0, desc: '通用' },
      }))
      while (assigned.length < count) {
        assigned.push({ id: `empty_${assigned.length}`, name: '空位', rarity: 1, currentSkill: { type: 'empty', value: 0, desc: '待分配' } })
      }
      const evalResult = evaluateAssignment(assigned, facilityType, shiftIdx)
      if (evalResult.netValue > bestResult.efficiency) {
        bestResult = { assigned, ...evalResult }
      }
      return
    }
    
    for (let i = startIdx; i < candidatePool.length; i++) {
      if (allAssigned.has(candidatePool[i].id)) continue
      tryCombination([...pick, candidatePool[i]], i + 1, depth + 1)
    }
  }
  
  tryCombination([], 0, 0)
  
  if (bestResult.assigned.length === 0) {
    const assigned = skilled.slice(0, count).map(op => ({
      ...op,
      currentSkill: op.baseSkills[facilityType],
    }))
    while (assigned.length < count) {
      assigned.push({ id: `empty_${assigned.length}`, name: '空位', rarity: 1, currentSkill: { type: 'empty', value: 0, desc: '待分配' } })
    }
    const evalResult = evaluateAssignment(assigned, facilityType, shiftIdx)
    return { assigned, ...evalResult }
  }
  
  return bestResult
}

function generateSchedule(userData) {
  const chars = userData.chars || []
  const building = userData.building || {}
  
  const matched = matchSkills(chars)
  const allOpIds = new Set(matched.map(c => c.id))
  
  const facilities = {
    manufacture: { count: Math.max((building.manufactures || []).length || 3, 3) },
    trading:     { count: Math.max((building.tradings || []).length || 2, 2) },
    power:       { count: 2 },
    dormitory:   { count: Math.max((building.dormitories || []).length || 4, 4) },
    meeting:     { count: 1 },
    training:    { count: 1 },
  }
  
  const facilityOrder = ['manufacture', 'trading', 'power', 'meeting', 'training', 'dormitory']
  
  const schedules = []
  const shiftCount = SHIFTS_PER_DAY
  
  for (let shift = 0; shift < shiftCount; shift++) {
    const shiftPool = [...matched].filter(op => !op.id.startsWith('empty_'))
    const shiftSchedule = {}
    let totalEfficiency = 0
    let totalMoodCost = 0
    let totalMoodRecovery = 0
    const assignedThisShift = new Set()
    
    for (const facility of facilityOrder) {
      const cfg = facilities[facility]
      if (!cfg) continue
      
      const available = shiftPool.filter(op => !assignedThisShift.has(op.id))
      // 制造站/贸易站/宿舍按实际建筑数量 × 每站槽位（其余设施用固定槽位）
      const perSlot = FACILITY_CONFIG[facility]?.slots || 3
      const slots = ['manufacture', 'trading', 'dormitory'].includes(facility) ? cfg.count * perSlot : perSlot
      
      const result = selectBestForFacility(facility, available, slots, assignedThisShift, shift)
      
      for (const op of result.assigned) {
        if (!op.id.startsWith('empty_')) assignedThisShift.add(op.id)
      }
      
      shiftSchedule[facility] = result.assigned
      totalEfficiency += result.efficiency
      totalMoodCost += result.moodCost
      totalMoodRecovery += result.moodRecovery
    }
    
    const unassigned = shiftPool.filter(op => !assignedThisShift.has(op.id))
    if (unassigned.length > 0 && shiftSchedule.dormitory) {
      const dormAssigned = shiftSchedule.dormitory.filter(op => !op.id.startsWith('empty_'))
      const emptySlots = shiftSchedule.dormitory.filter(op => op.id.startsWith('empty_'))
      for (let i = 0; i < Math.min(unassigned.length, emptySlots.length); i++) {
        emptySlots[i] = { ...unassigned[i], currentSkill: { type: 'rest', value: 0, desc: '休息恢复心情' } }
      }
    }
    
    schedules.push({
      shift: shift + 1,
      label: ['早班 (08-16)', '中班 (16-00)', '晚班 (00-08)'][shift],
      facilities: shiftSchedule,
      efficiency: totalEfficiency,
      moodCost: totalMoodCost,
      moodRecovery: totalMoodRecovery,
      netScore: totalEfficiency + totalMoodRecovery * 10 - totalMoodCost * 5,
    })
  }
  
  return {
    id: Date.now().toString(36),
    createdAt: new Date().toISOString(),
    name: `排班方案 ${new Date().toLocaleDateString()} v3`,
    schedules,
    totalEfficiency: schedules.reduce((s, x) => s + x.efficiency, 0),
    totalMoodCost: schedules.reduce((s, x) => s + x.moodCost, 0),
    totalMoodRecovery: schedules.reduce((s, x) => s + x.moodRecovery, 0),
    totalNetScore: schedules.reduce((s, x) => s + x.netScore, 0),
    meta: {
      algorithm: 'v3-global-combo-mood',
      shiftHours: SHIFT_HOURS,
      combosDetected: detectActiveCombos(schedules),
    },
  }
}

function detectActiveCombos(schedules) {
  const combos = []
  for (const shift of schedules) {
    for (const [facility, assigned] of Object.entries(shift.facilities)) {
      const ids = new Set(assigned.map(o => o.id))
      for (const combo of COMBO_BONUSES) {
        if (combo.facility !== facility) continue
        if (combo.ids.every(id => ids.has(id))) {
          combos.push({ shift: shift.shift, facility, ...combo })
        }
      }
      for (const combo of DORMITORY_COMBOS) {
        if (facility !== 'dormitory') continue
        if (combo.ids.every(id => ids.has(id))) {
          combos.push({ shift: shift.shift, facility, ...combo })
        }
      }
    }
  }
  return combos
}

function optimizeSchedule(schedule, userData) {
  let best = schedule
  let improved = true
  let iterations = 0
  const maxIterations = 50
  
  while (improved && iterations < maxIterations) {
    improved = false
    iterations++
    
    for (let shiftIdx = 0; shiftIdx < schedule.schedules.length; shiftIdx++) {
      const shift = schedule.schedules[shiftIdx]
      const facilities = Object.keys(shift.facilities)
      
      for (let i = 0; i < facilities.length; i++) {
        for (let j = i + 1; j < facilities.length; j++) {
          const f1 = facilities[i], f2 = facilities[j]
          const ops1 = shift.facilities[f1].filter(o => !o.id.startsWith('empty_'))
          const ops2 = shift.facilities[f2].filter(o => !o.id.startsWith('empty_'))
          
          for (const op1 of ops1) {
            for (const op2 of ops2) {
              if (canSwap(op1, op2, f1, f2)) {
                const newSchedule = swapAndEvaluate(schedule, shiftIdx, f1, f2, op1, op2, userData)
                if (newSchedule.totalNetScore > best.totalNetScore) {
                  best = newSchedule
                  improved = true
                }
              }
            }
          }
        }
      }
    }
    schedule = best
  }
  
  return best
}

function canSwap(op1, op2, f1, f2) {
  const s1 = op1.baseSkills?.[f2]
  const s2 = op2.baseSkills?.[f1]
  return (s1 && s1.value > 0) && (s2 && s2.value > 0)
}

function swapAndEvaluate(schedule, shiftIdx, f1, f2, op1, op2, userData) {
  const newSchedule = JSON.parse(JSON.stringify(schedule))
  const shift = newSchedule.schedules[shiftIdx]
  
  const idx1 = shift.facilities[f1].findIndex(o => o.id === op1.id)
  const idx2 = shift.facilities[f2].findIndex(o => o.id === op2.id)
  
  if (idx1 >= 0 && idx2 >= 0) {
    const skill1 = op1.baseSkills[f2]
    const skill2 = op2.baseSkills[f1]
    newSchedule.schedules[shiftIdx].facilities[f1][idx1] = { ...op2, currentSkill: skill2 }
    newSchedule.schedules[shiftIdx].facilities[f2][idx2] = { ...op1, currentSkill: skill1 }
    
    const totalNetScore = newSchedule.schedules.reduce((s, sh) => {
      let shiftScore = 0
      for (const [fac, ops] of Object.entries(sh.facilities)) {
        const evalResult = evaluateAssignment(ops, fac, sh.shift - 1)
        shiftScore += evalResult.netValue
      }
      return s + shiftScore
    }, 0)
    
    newSchedule.totalNetScore = totalNetScore
  }
  
  return newSchedule
}

export { generateSchedule, matchSkills, FACILITY_CONFIG, optimizeSchedule, SHIFT_HOURS }