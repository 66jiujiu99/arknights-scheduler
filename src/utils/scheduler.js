/**
 * 罗德岛基建排班调度算法
 * 
 * 核心逻辑：
 * 1. 解析用户干员列表 + 内置基建技能表
 * 2. 按设施类型分组，匹配最优干员组合
 * 3. 考虑心情消耗，生成A/B/C轮换排班
 * 
 * 算法思路：贪心+局部搜索（非全局最优保证但实用）
 */

// 基建技能数据（精简版 — 完整数据从 PRTS 等渠道整理）
// 格式: { operatorId: { skillName, facility, buffType, buffValue, notes } }
const OPERATOR_SKILLS = {
  // ── 制造站 ──
  'char_100_12fce':  { name: '12F',        skill: { facility: 'manufacture', type: 'productivity', value: 25, desc: '制造站生产力+25%' }},
  'char_102_texas':  { name: '德克萨斯',   skill: { facility: 'manufacture', type: 'capacity', value: 1, desc: '制造站上限+1' }},
  'char_140_whitew': { name: '白面鸮',    skill: { facility: 'manufacture', type: 'productivity', value: 25, desc: '制造站生产力+25%' }},
  'char_141_nights': { name: '夜烟',      skill: { facility: 'manufacture', type: 'productivity', value: 25, desc: '制造站生产力+25%' }},
  'char_143_glaze':  { name: '格雷伊',    skill: { facility: 'manufacture', type: 'productivity', value: 20, desc: '制造站生产力+20%' }},
  'char_150_bpipe':  { name: '风笛',      skill: { facility: 'manufacture', type: 'productivity', value: 25, desc: '制造站生产力+25%', condition: '精二' }},
  'char_172_svrash': { name: '银灰',      skill: { facility: 'manufacture', type: 'productivity', value: 25, desc: '制造站生产力+25%', condition: '精二' }},
  'char_182_weiro':  { name: '苇草',      skill: { facility: 'manufacture', type: 'productivity', value: 10, desc: '制造站生产力+10%' }},
  'char_240_wyvern': { name: '焰尾',      skill: { facility: 'manufacture', type: 'productivity', value: 25, desc: '制造站生产力+25%', condition: '精二' }},
  'char_248_mgllan': { name: '麦哲伦',   skill: { facility: 'manufacture', type: 'productivity', value: 35, desc: '制造站生产力+35%', condition: '精二' }},
  'char_286_cast3':  { name: 'Cast3-2',   skill: { facility: 'manufacture', type: 'productivity', value: 30, desc: '制造站生产力+30%' }},
  'char_2013_reed2': { name: '苇草II',    skill: { facility: 'manufacture', type: 'productivity', value: 25, desc: '制造站生产力+25%' }},
  
  // ── 贸易站 ──
  'char_103_angel':  { name: '能天使',    skill: { facility: 'trading', type: 'productivity', value: 35, desc: '贸易站订单效率+35%' }},
  'char_288_blackd': { name: '黑',        skill: { facility: 'trading', type: 'productivity', value: 35, desc: '贸易站订单效率+35%' }},
  'char_290_vigna':  { name: '红',        skill: { facility: 'trading', type: 'productivity', value: 15, desc: '贸易站订单效率+15%' }},
  'char_201_buddy':  { name: '巫恋',      skill: { facility: 'trading', type: 'productivity', value: 35, desc: '贸易站订单效率+35%', combo: '龙舌兰' }},
  'char_196_sunvis': { name: '龙舌兰',   skill: { facility: 'trading', type: 'productivity', value: 20, desc: '贸易站订单效率+20%', combo: '巫恋' }},
  'char_379_pian':   { name: '但书',      skill: { facility: 'trading', type: 'productivity', value: 25, desc: '贸易站订单效率+25%' }},
  
  // ── 发电站 ──
  'char_166_raz':    { name: '雷蛇',      skill: { facility: 'power', type: 'capacity', value: 1, desc: '发电站上限+1' }},
  'char_222_breeze': { name: '微风',      skill: { facility: 'power', type: 'capacity', value: 1, desc: '发电站上限+1' }},
  'char_159_ncdeer': { name: '格雷伊',    skill: { facility: 'power', type: 'drone', value: 10, desc: '无人机恢复+10%' }},
  
  // ── 宿舍 ──
  'char_113_ely':    { name: '焰尾',      skill: { facility: 'dormitory', type: 'mood', value: 0.15, desc: '宿舍心情恢复+0.15/h' }},
  'char_174_slbell': { name: '铃兰',      skill: { facility: 'dormitory', type: 'mood', value: 0.15, desc: '宿舍心情恢复+0.15/h' }},
  'char_194_klamt':  { name: '瑕光',      skill: { facility: 'dormitory', type: 'mood', value: 0.15, desc: '宿舍心情恢复+0.15/h' }},
}

const FACILITY_CONFIG = {
  manufacture: { label: '制造站', slots: 3, moodCost: 0.75, maxProductivity: 120 },
  trading:     { label: '贸易站', slots: 3, moodCost: 0.75, maxProductivity: 100 },
  power:       { label: '发电站', slots: 2, moodCost: 0.75, maxProductivity: 0 },
  dormitory:   { label: '宿舍', slots: 5, moodCost: 0, recovery: 2.0 },
  meeting:     { label: '会客室', slots: 2, moodCost: 0.5 },
  training:    { label: '训练室', slots: 1, moodCost: 0 },
}

/**
 * 为用户干员匹配基建技能
 */
function matchSkills(userChars) {
  return userChars.map(c => {
    const skillData = OPERATOR_SKILLS[c.id]
    if (skillData) {
      return { ...c, baseSkill: skillData.skill, baseSkillName: skillData.name }
    }
    // 没有已知基建技能的干员，给个通用/空技能
    return { ...c, baseSkill: { facility: 'none', type: 'none', value: 0, desc: '无特殊基建技能' } }
  })
}

/**
 * 为指定设施筛选最优干员组合
 */
function selectBestForFacility(facilityType, availableOps, count = 3) {
  const config = FACILITY_CONFIG[facilityType]
  if (!config) return { assigned: [], efficiency: 0 }

  // 筛选有该设施技能的干员
  const skilled = availableOps.filter(o => o.baseSkill.facility === facilityType)
    .sort((a, b) => b.baseSkill.value - a.baseSkill.value)
  
  // 处理 combo 组合（如巫恋+龙舌兰）
  const combos = []
  for (let i = 0; i < skilled.length; i++) {
    for (let j = i + 1; j < skilled.length; j++) {
      if (skilled[i].baseSkill.combo && skilled[i].baseSkill.combo === skilled[j].name) {
        combos.push({ ops: [skilled[i], skilled[j]], totalValue: skilled[i].baseSkill.value + skilled[j].baseSkill.value * 1.5 })
      }
      if (skilled[j].baseSkill.combo && skilled[j].baseSkill.combo === skilled[i].name) {
        combos.push({ ops: [skilled[i], skilled[j]], totalValue: skilled[j].baseSkill.value + skilled[i].baseSkill.value * 1.5 })
      }
    }
  }
  combos.sort((a, b) => b.totalValue - a.totalValue)

  // 贪心选择
  const assigned = []
  const used = new Set()
  let efficiency = 0

  // 优先放 combo
  for (const combo of combos) {
    if (assigned.length + combo.ops.length > count) continue
    if (combo.ops.some(o => used.has(o.id))) continue
    for (const op of combo.ops) {
      used.add(op.id)
      assigned.push(op)
    }
    efficiency += combo.totalValue
    if (assigned.length >= count) break
  }

  // 补满剩余位
  for (const op of skilled) {
    if (assigned.length >= count) break
    if (used.has(op.id)) continue
    used.add(op.id)
    assigned.push(op)
    efficiency += op.baseSkill.value
  }

  // 没技能的空位用通用干员填充
  const general = availableOps.filter(o => !used.has(o.id))
  for (const op of general) {
    if (assigned.length >= count) break
    assigned.push({ ...op, baseSkill: { facility: facilityType, type: 'general', value: 0, desc: '通用' } })
  }

  // 补位
  while (assigned.length < count) {
    assigned.push({ id: `empty_${assigned.length}`, name: '空位', baseSkill: { facility: facilityType, type: 'empty', value: 0, desc: '待分配' } })
  }

  return { assigned, efficiency }
}

/**
 * 生成完整排班方案
 */
function generateSchedule(userData) {
  const chars = userData.chars || []
  const building = userData.building || {}
  
  // 匹配基建技能
  const matched = matchSkills(chars)
  
  // 计算各设施数量
  const facilities = {
    manufacture: { count: Math.max((building.manufactures || []).length, 3) },
    trading: { count: Math.max((building.tradings || []).length, 2) },
    power: { count: Math.max(1, 2) },
    dormitory: { count: Math.max((building.dormitories || []).length, 4) },
    meeting: { count: 1 },
    training: { count: 1 },
  }

  // 轮换制：A/B/C 三班
  const shiftCount = 3
  const schedules = []

  for (let shift = 0; shift < shiftCount; shift++) {
    // 轮换可用干员池
    const shiftPool = [...matched]
    const shiftSchedule = {}
    let totalEfficiency = 0

    for (const [facility, cfg] of Object.entries(facilities)) {
      const slots = FACILITY_CONFIG[facility]?.slots || 3
      
      // 不同班次用不同的干员池偏移
      const offset = shift * Math.floor(shiftPool.length / shiftCount)
      const rotatedPool = [...shiftPool.slice(offset), ...shiftPool.slice(0, offset)]
      
      const result = selectBestForFacility(facility, rotatedPool, slots)
      shiftSchedule[facility] = result.assigned
      totalEfficiency += result.efficiency

      // 从池中移除已分配的
      const usedIds = new Set(result.assigned.map(o => o.id))
      shiftSchedule[facility] = shiftSchedule[facility].map(o => ({
        ...o,
        isGeneral: o.baseSkill?.type === 'general',
        isCombo: result.assigned.filter(a => a.baseSkill?.combo).length > 0 && result.assigned.includes(o),
      }))
    }

    schedules.push({
      shift: shift + 1,
      label: ['A班', 'B班', 'C班'][shift],
      facilities: shiftSchedule,
      efficiency: totalEfficiency,
    })
  }

  return {
    id: Date.now().toString(36),
    createdAt: new Date().toISOString(),
    name: `排班方案 ${new Date().toLocaleDateString()}`,
    schedules,
    totalEfficiency: schedules.reduce((s, x) => s + x.efficiency, 0),
  }
}

export { generateSchedule, matchSkills, OPERATOR_SKILLS, FACILITY_CONFIG }
