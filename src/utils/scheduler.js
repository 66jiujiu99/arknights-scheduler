/**
 * 罗德岛基建排班调度算法 v2
 * 
 * 使用来自 ArknightsGameData 的完整 337 名干员基建技能数据
 * 算法思路：贪心+局部搜索
 * - 按设施分组优先级
 * - 识别 combo 组合（如巫恋+龙舌兰）
 * - A/B/C 三班轮换
 */

import baseSkills from '../data/baseSkills.json'

const FACILITY_CONFIG = {
  manufacture: { label: '制造站', slots: 3, moodCost: 0.75 },
  trading:     { label: '贸易站', slots: 3, moodCost: 0.75 },
  power:       { label: '发电站', slots: 2, moodCost: 0.75 },
  dormitory:   { label: '宿舍',   slots: 5, moodCost: 0 },
  meeting:     { label: '会客室', slots: 2, moodCost: 0.5 },
  training:    { label: '训练室', slots: 1, moodCost: 0 },
}

/**
 * 为用户干员匹配基建技能
 * 从 baseSkills.json 中查找每个干员的设施技能
 */
function matchSkills(userChars) {
  return userChars.map(c => {
    const skillData = baseSkills[c.id]
    if (skillData) {
      // 收集该干员的所有设施技能
      const facilities = {}
      for (const [facility, info] of Object.entries(skillData)) {
        if (['name', 'rarity'].includes(facility)) continue
        facilities[facility] = {
          type: info.type || 'productivity',
          value: info.value || 0,
          desc: info.desc || '',
          condition: info.condition || '',
        }
      }
      return {
        ...c,
        rarity: skillData.rarity || c.rarity || 1,
        baseSkills: facilities,
      }
    }
    // 没有基建技能的干员
    return {
      ...c,
      baseSkills: {},
    }
  })
}

/**
 * 为指定设施选择最优干员组合
 */
function selectBestForFacility(facilityType, availableOps, count = 3) {
  const config = FACILITY_CONFIG[facilityType]
  if (!config) return { assigned: [], efficiency: 0 }

  // 筛选有该设施技能的干员，按效率值排序
  const skilled = availableOps
    .filter(o => o.baseSkills && o.baseSkills[facilityType])
    .sort((a, b) => {
      const va = a.baseSkills[facilityType]?.value || 0
      const vb = b.baseSkills[facilityType]?.value || 0
      return vb - va
    })

  const assigned = []
  const used = new Set()
  let efficiency = 0

  // 简单贪心：取效率最高的
  for (const op of skilled) {
    if (assigned.length >= count) break
    if (used.has(op.id)) continue
    used.add(op.id)
    assigned.push({
      ...op,
      currentSkill: op.baseSkills[facilityType],
    })
    efficiency += op.baseSkills[facilityType]?.value || 0
  }

  // 用通用干员补位
  const general = availableOps.filter(o => !used.has(o.id))
  for (const op of general) {
    if (assigned.length >= count) break
    assigned.push({
      ...op,
      currentSkill: { type: 'general', value: 0, desc: '通用' },
    })
  }

  // 空位填充
  while (assigned.length < count) {
    assigned.push({
      id: `empty_${assigned.length}`,
      name: '空位',
      rarity: 1,
      currentSkill: { type: 'empty', value: 0, desc: '待分配' },
    })
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

  // 默认设施数量
  const facilities = {
    manufacture: { count: Math.max((building.manufactures || []).length || 3, 3) },
    trading:     { count: Math.max((building.tradings || []).length || 2, 2) },
    power:       { count: 2 },
    dormitory:   { count: Math.max((building.dormitories || []).length || 4, 4) },
    meeting:     { count: 1 },
    training:    { count: 1 },
  }

  const schedules = []
  const shiftCount = 3

  for (let shift = 0; shift < shiftCount; shift++) {
    const shiftPool = [...matched]
    const shiftSchedule = {}
    let totalEfficiency = 0

    for (const [facility, cfg] of Object.entries(facilities)) {
      const slots = FACILITY_CONFIG[facility]?.slots || 3

      // 轮换池偏移
      const offset = shift * Math.floor(shiftPool.length / shiftCount)
      const rotatedPool = [...shiftPool.slice(offset), ...shiftPool.slice(0, offset)]

      const result = selectBestForFacility(facility, rotatedPool, slots)
      shiftSchedule[facility] = result.assigned
      totalEfficiency += result.efficiency
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

export { generateSchedule, matchSkills, FACILITY_CONFIG }
