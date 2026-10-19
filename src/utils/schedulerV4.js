/**
 * 罗德岛基建排班 v4（自定义基建配置 + 全设施 + 控制中枢加成）
 *
 * 从单文件版 index.html 的 v4 算法移植，改为纯函数，供 Vue 组件复用。
 * 与 v3 的区别：
 *  - 按用户实际基建配置（九宫格 / 设施等级 / 宿舍 / 副手）生成站点
 *  - 覆盖控制中枢、制造站、贸易站、发电站、会客室、办公室、训练室、加工站、宿舍、副手
 *  - 制造站按产物、贸易站按策略匹配
 *  - 贸易站搭档联动
 *  - 控制中枢的全设施加成参与效率计算
 */

export const ROOM_TYPES = {
  MANUFACTURE: { name: '制造站', maxCount: 5, maxLevel: 3, slotsByLevel: { 1: 1, 2: 2, 3: 3 }, mood: 0.75, color: '#5ddf5d' },
  TRADING: { name: '贸易站', maxCount: 5, maxLevel: 3, slotsByLevel: { 1: 1, 2: 2, 3: 3 }, mood: 0.75, color: '#6bb5ff' },
  POWER: { name: '发电站', maxCount: 3, maxLevel: 3, slotsByLevel: { 1: 1, 2: 1, 3: 1 }, mood: 0.75, color: '#d4a843' },
}

export const FIXED_ROOMS = {
  CONTROL: { name: '控制中枢', maxLevel: 5, slotsByLevel: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 }, mood: 0.5 },
  DORMITORY: { name: '宿舍', maxLevel: 5, slots: 5, mood: 0 },
  MEETING: { name: '会客室', maxLevel: 3, slotsByLevel: { 1: 1, 2: 2, 3: 2 }, mood: 0.5 },
  HIRE: { name: '办公室', maxLevel: 3, slotsByLevel: { 1: 1, 2: 2, 3: 2 }, mood: 0.5 },
  TRAINING: { name: '训练室', maxLevel: 3, slots: 2, mood: 0.3 },
  WORKSHOP: { name: '加工站', maxLevel: 3, slots: 1, mood: 0 },
}

export const DEFAULT_CONFIG = {
  controlLevel: 5,
  grid: ['MANUFACTURE', 'MANUFACTURE', 'MANUFACTURE', 'TRADING', 'TRADING', 'TRADING', 'POWER', 'POWER', 'POWER'],
  levels: { MANUFACTURE: 3, TRADING: 3, POWER: 3, DORMITORY: 5, MEETING: 1, HIRE: 1, TRAINING: 1, WORKSHOP: 1 },
  dorms: 4,
  useAssistant: true,
}

export const MF_CATS = ['赤金', '作战记录', '源石碎片', '技巧概要', '仓库', '通用']
export const TRADE_STRATEGIES = ['龙门商法', '开采协力']
export const SHIFT_LABELS = ['A 班', 'B 班']
export const SHIFT_HOURS = 8

const FIXED_LEVEL_KEYS = ['MANUFACTURE', 'TRADING', 'POWER', 'DORMITORY', 'MEETING', 'HIRE', 'TRAINING', 'WORKSHOP']

const DATA_BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || '/'

let baseSkillsCache = null
let ctrlSkillsCache = null

export function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

export function normalizeConfig(saved) {
  const config = Object.assign(clone(DEFAULT_CONFIG), saved || {})
  config.grid = Array.isArray(config.grid) ? config.grid.slice(0, 9) : clone(DEFAULT_CONFIG.grid)
  while (config.grid.length < 9) config.grid.push('MANUFACTURE')
  config.grid = config.grid.map((type) => (ROOM_TYPES[type] ? type : 'MANUFACTURE'))
  config.levels = Object.assign(clone(DEFAULT_CONFIG.levels), config.levels || {})
  config.controlLevel = Math.min(5, Math.max(1, Number(config.controlLevel) || 5))
  config.dorms = Math.min(4, Math.max(1, Number(config.dorms) || 4))
  config.useAssistant = config.useAssistant !== false
  return config
}

export function slotsOf(config, type) {
  if (type === 'CONTROL') return config.controlLevel
  const info = ROOM_TYPES[type] || FIXED_ROOMS[type]
  if (!info) return 1
  if (info.slotsByLevel) return info.slotsByLevel[config.levels[type] || 1] || 1
  return info.slots || 1
}

export function gridCounts(config) {
  const counts = { MANUFACTURE: 0, TRADING: 0, POWER: 0 }
  for (const type of config.grid) counts[type] = (counts[type] || 0) + 1
  return counts
}

export function assistantCount(config) {
  const level = config.controlLevel
  return 1 + (level >= 3 ? 1 : 0) + (level >= 4 ? 1 : 0) + (level >= 5 ? 1 : 0)
}

export function validateConfig(config) {
  const issues = []
  const counts = gridCounts(config)
  for (const type of ['MANUFACTURE', 'TRADING', 'POWER']) {
    if (counts[type] > ROOM_TYPES[type].maxCount) {
      issues.push(`${ROOM_TYPES[type].name} ${counts[type]} 个，超过上限 ${ROOM_TYPES[type].maxCount} 个`)
    }
  }
  if (config.grid.length !== 9) issues.push('左侧房间必须是 9 格')
  if (config.dorms < 1 || config.dorms > 4) issues.push('宿舍数量应为 1-4')
  for (const type of FIXED_LEVEL_KEYS) {
    const info = ROOM_TYPES[type] || FIXED_ROOMS[type]
    const level = config.levels[type]
    if (level < 1 || level > info.maxLevel) issues.push(`${info.name}等级 ${level} 无效（1-${info.maxLevel}）`)
    else if (level > config.controlLevel) issues.push(`${info.name}等级 ${level} 不能超过控制中枢等级 ${config.controlLevel}`)
  }
  return issues
}

export function controlUpgradeHint(config) {
  const need = { 2: [1, 5], 3: [1, 6], 4: [2, 8], 5: [3, 10] }[config.controlLevel]
  if (!need) return ''
  const counts = gridCounts(config)
  const levels = []
  for (const type of ['MANUFACTURE', 'TRADING', 'POWER']) {
    for (let i = 0; i < counts[type]; i++) levels.push(config.levels[type])
  }
  for (let i = 0; i < config.dorms; i++) levels.push(config.levels.DORMITORY)
  for (const type of ['MEETING', 'HIRE', 'TRAINING', 'WORKSHOP']) levels.push(config.levels[type])
  const have = levels.filter((level) => level >= need[0]).length
  return have >= need[1]
    ? ''
    : `中枢升级提示：Lv.${config.controlLevel} 需 ${need[1]} 个 Lv.${need[0]} 设施（当前 ${have} 个）`
}

export function configSummary(config) {
  const counts = gridCounts(config)
  const parts = [
    `制造站 ×${counts.MANUFACTURE}（${counts.MANUFACTURE * slotsOf(config, 'MANUFACTURE')}人）`,
    `贸易站 ×${counts.TRADING}（${counts.TRADING * slotsOf(config, 'TRADING')}人）`,
    `发电站 ×${counts.POWER}（${counts.POWER * slotsOf(config, 'POWER')}人）`,
    `中枢 ${slotsOf(config, 'CONTROL')}人`,
    `会客室 ${slotsOf(config, 'MEETING')}人`,
    `办公室 ${slotsOf(config, 'HIRE')}人`,
    `训练室 ${slotsOf(config, 'TRAINING')}人`,
    `加工站 ${slotsOf(config, 'WORKSHOP')}人`,
    `宿舍 ×${config.dorms}（${config.dorms * 5}人）`,
  ]
  if (config.useAssistant) parts.push(`副手 ${assistantCount(config)}人`)
  const hint = controlUpgradeHint(config)
  return `📐 总进驻位：${parts.join('，')}${hint ? `　${hint}` : ''}`
}

export function seedConfigFromBuilding(building) {
  const b = building || {}
  const lvOf = (arr) => {
    const levels = (arr || []).map((item) => (item && item.level) || 1)
    return levels.length ? Math.max(...levels) : null
  }
  const mf = Math.min(5, (b.manufactures || []).length)
  const tr = Math.min(5, (b.tradings || []).length)
  const pw = Math.min(3, (b.powers || []).length)
  const grid = []
  for (let i = 0; i < mf; i++) grid.push('MANUFACTURE')
  for (let i = 0; i < tr; i++) grid.push('TRADING')
  for (let i = 0; i < pw; i++) grid.push('POWER')
  while (grid.length < 9) {
    const counts = gridCounts({ grid })
    if (counts.POWER < 3) grid.push('POWER')
    else if (counts.TRADING < 5) grid.push('TRADING')
    else grid.push('MANUFACTURE')
  }
  grid.length = 9
  const config = normalizeConfig({
    controlLevel: (b.control && b.control.level) || 5,
    grid,
    levels: {
      MANUFACTURE: lvOf(b.manufactures) || 3,
      TRADING: lvOf(b.tradings) || 3,
      POWER: lvOf(b.powers) || 1,
      DORMITORY: lvOf(b.dormitories) || 5,
      MEETING: (b.meeting && b.meeting.level) || 1,
      HIRE: (b.hire && b.hire.level) || 1,
      TRAINING: (b.training && b.training.level) || 1,
      WORKSHOP: 1,
    },
    dorms: Math.max(1, Math.min(4, (b.dormitories || []).length || 4)),
  })
  return config
}

export function syncProductionConfig(config, mfCats, tradeStrategies) {
  const counts = gridCounts(config)
  const nextMf = []
  const defaults = ['赤金', '作战记录', '源石碎片', '通用', '赤金']
  for (let i = 0; i < counts.MANUFACTURE; i++) nextMf.push((mfCats && mfCats[i]) || defaults[i % defaults.length])
  const nextTrade = []
  for (let i = 0; i < counts.TRADING; i++) nextTrade.push((tradeStrategies && tradeStrategies[i]) || '龙门商法')
  return { mfCats: nextMf, tradeStrategies: nextTrade }
}

export async function loadBaseSkills() {
  if (baseSkillsCache) return baseSkillsCache
  const response = await fetch(`${DATA_BASE}data/baseSkills.json`)
  if (!response.ok) throw new Error(`加载干员基建技能失败：HTTP ${response.status}`)
  baseSkillsCache = await response.json()
  return baseSkillsCache
}

export async function loadCtrlSkills() {
  if (ctrlSkillsCache) return ctrlSkillsCache
  const response = await fetch(`${DATA_BASE}data/ctrl_skills.json`)
  if (!response.ok) throw new Error(`加载控制中枢技能失败：HTTP ${response.status}`)
  ctrlSkillsCache = await response.json()
  return ctrlSkillsCache
}

export function classifyMF(desc) {
  if (!desc) return '通用'
  if (desc.includes('源石')) return '源石碎片'
  if (desc.includes('贵金属') || desc.includes('赤金')) return '赤金'
  if (desc.includes('作战记录')) return '作战记录'
  if (desc.includes('技巧概要')) return '技巧概要'
  return '通用'
}

/** 把游戏 chars 与 baseSkills 合成排班需要的干员对象。 */
export function analyzeSkills(chars, skills) {
  return (chars || []).map((char) => {
    const charId = char.charId || char.id
    const skillData = skills[charId]
    if (!skillData) return { ...char, charId, id: char.id || charId, baseSkills: {}, mfCat: null, moods: [], partners: [] }
    const facilities = {}
    const moods = []
    const partners = []
    let mfCat = null
    for (const [facility, info] of Object.entries(skillData)) {
      if (facility === 'name' || facility === 'rarity') continue
      const desc = info.desc || ''
      facilities[facility] = { type: info.type || '', value: info.value || 0, desc }
      const moodMatch = desc.match(/心情每小时消耗([+-])([\d.]+)/)
      if (moodMatch) moods.push({ facility, cost: Number(`${moodMatch[1]}${moodMatch[2]}`) })
      if (facility === 'manufacture') mfCat = classifyMF(desc)
      if (facility !== 'dormitory' && /若|当|如果|同个|额外/.test(desc)) {
        const matches = desc.matchAll(/([^\s<]+)(?:进驻|在|与|和|入驻)/g)
        for (const match of matches) if (match[1].length > 1) partners.push(match[1])
      }
    }
    return {
      ...char,
      id: char.id || charId,
      charId,
      rarity: skillData.rarity || char.rarity || 1,
      baseSkills: facilities,
      mfCat,
      moods,
      partners: [...new Set(partners)],
    }
  })
}

function pickWithFallback(type, pool, count, used, skillPicker, general = false) {
  const selected = []
  const candidates = skillPicker ? skillPicker(pool.filter((op) => !used.has(op.charId))) : []
  let efficiency = 0
  let moodCost = 0
  const push = (op, forceGeneral) => {
    used.add(op.charId)
    const skill = forceGeneral ? { type: 'general', value: 0, desc: '通用' } : (op.baseSkills[type] || { type: 'general', value: 0, desc: '通用' })
    const mood = (op.moods || []).find((entry) => entry.facility === type) || null
    selected.push({
      charId: op.charId,
      name: op.name,
      displayName: op.displayName,
      rarity: op.rarity,
      skill,
      moodCost: mood,
      partners: op.partners || [],
    })
    efficiency += skill.value || 0
    if (mood) moodCost += mood.cost
  }
  for (const op of candidates) {
    if (selected.length >= count) break
    if (used.has(op.charId)) continue
    push(op, general)
  }
  for (const op of pool) {
    if (selected.length >= count) break
    if (used.has(op.charId)) continue
    push(op, true)
  }
  while (selected.length < count) {
    selected.push({ charId: `empty_${selected.length}`, name: '空位', rarity: 1, skill: { type: 'empty', value: 0, desc: '待分配' }, moodCost: null, partners: [] })
  }
  return { assigned: selected, efficiency, moodCost }
}

function pickMF(pool, count, category, used) {
  const matching = pool
    .filter((op) => op.baseSkills?.manufacture && op.mfCat === category && !used.has(op.charId))
    .sort((a, b) => (b.baseSkills.manufacture?.value || 0) - (a.baseSkills.manufacture?.value || 0))
  const others = pool
    .filter((op) => op.baseSkills?.manufacture && op.mfCat !== category && !used.has(op.charId))
    .sort((a, b) => (b.baseSkills.manufacture?.value || 0) - (a.baseSkills.manufacture?.value || 0))
  const ordered = [...matching, ...others]
  return pickWithFallback('manufacture', ordered, count, used, (remaining) => remaining.filter((op) => ordered.some((o) => o.charId === op.charId)))
}

function pickFacility(type, pool, count, used, ctrlOps) {
  if (type === 'control') {
    const sorted = [...pool].sort((a, b) => {
      const scoreA = ctrlOps[a.charId]?.score || 0
      const scoreB = ctrlOps[b.charId]?.score || 0
      if (scoreA !== scoreB) return scoreB - scoreA
      return (b.rarity || 1) - (a.rarity || 1)
    })
    return pickWithFallback('control', sorted, count, used, (remaining) => remaining, true)
  }
  const skilled = pool
    .filter((op) => op.baseSkills?.[type] && !used.has(op.charId))
    .sort((a, b) => (b.baseSkills[type]?.value || 0) - (a.baseSkills[type]?.value || 0))
  const ordered = [...skilled, ...pool.filter((op) => !skilled.includes(op))]
  return pickWithFallback(type, ordered, count, used, (remaining) => remaining.filter((op) => ordered.some((o) => o.charId === op.charId)))
}

export function buildStations(config, mfCats, tradeStrategies) {
  const stations = [{ id: 'CONTROL', name: '控制中枢', type: 'control', slots: slotsOf(config, 'CONTROL'), mood: FIXED_ROOMS.CONTROL.mood }]
  let mfIndex = 0
  let tradeIndex = 0
  let powerIndex = 0
  for (const type of config.grid) {
    if (type === 'MANUFACTURE') {
      const category = (mfCats && mfCats[mfIndex]) || '通用'
      stations.push({ id: `MF${mfIndex + 1}`, name: `制造站${mfIndex + 1}（${category}）`, type: 'manufacture', slots: slotsOf(config, 'MANUFACTURE'), category, mood: ROOM_TYPES.MANUFACTURE.mood })
      mfIndex += 1
    } else if (type === 'TRADING') {
      const strategy = (tradeStrategies && tradeStrategies[tradeIndex]) || '龙门商法'
      stations.push({ id: `TR${tradeIndex + 1}`, name: `贸易站${tradeIndex + 1}（${strategy}）`, type: 'trading', slots: slotsOf(config, 'TRADING'), strategy, mood: ROOM_TYPES.TRADING.mood })
      tradeIndex += 1
    } else {
      stations.push({ id: `PW${powerIndex + 1}`, name: `发电站${powerIndex + 1}`, type: 'power', slots: slotsOf(config, 'POWER'), mood: ROOM_TYPES.POWER.mood })
      powerIndex += 1
    }
  }
  stations.push({ id: 'MEETING', name: '会客室', type: 'meeting', slots: slotsOf(config, 'MEETING'), mood: FIXED_ROOMS.MEETING.mood })
  stations.push({ id: 'HIRE', name: '办公室', type: 'hire', slots: slotsOf(config, 'HIRE'), mood: FIXED_ROOMS.HIRE.mood })
  stations.push({ id: 'TRAINING', name: '训练室', type: 'training', slots: slotsOf(config, 'TRAINING'), mood: FIXED_ROOMS.TRAINING.mood })
  stations.push({ id: 'WORKSHOP', name: '加工站', type: 'workshop', slots: slotsOf(config, 'WORKSHOP'), mood: FIXED_ROOMS.WORKSHOP.mood })
  for (let index = 1; index <= config.dorms; index++) {
    stations.push({ id: `DORM${index}`, name: `宿舍${index}`, type: 'dormitory', slots: 5, mood: 0 })
  }
  if (config.useAssistant) stations.push({ id: 'ASSIST', name: '基建副手', type: 'assistant', slots: assistantCount(config), mood: 0 })
  return stations
}

/** 贸易站搭档联动：把有搭档关系的干员换到同一贸易站。 */
function pairTradingPartners(tradings) {
  if (tradings.length < 2) return
  for (let a = 0; a < tradings.length; a++) {
    for (let b = a + 1; b < tradings.length; b++) {
      for (const first of tradings[a].ops) {
        for (const second of tradings[b].ops) {
          const firstPartners = first.partners || []
          const secondPartners = second.partners || []
          if (!firstPartners.includes(second.name) && !secondPartners.includes(first.name)) continue
          const targetIndex = tradings[a].ops.findIndex((op) => op.skill?.type === 'general' || op.skill?.type === 'empty')
          const sourceIndex = tradings[b].ops.indexOf(second)
          if (targetIndex < 0 || sourceIndex < 0) continue
          const temp = tradings[a].ops[targetIndex]
          tradings[a].ops[targetIndex] = tradings[b].ops[sourceIndex]
          tradings[b].ops[sourceIndex] = temp
        }
      }
    }
  }
}

function controlBonus(controlStation, ctrlOps) {
  let bonus = 0
  for (const op of controlStation?.ops || []) {
    const entry = ctrlOps[op.charId]
    if (!entry) continue
    for (const buff of entry.buffs || []) {
      const desc = buff.desc || ''
      if (desc.includes('所有制造站生产力') || desc.includes('所有贸易站订单效率')) {
        const match = desc.match(/[\d.]+(?=%)/)
        if (match) bonus += Number(match[0])
      }
    }
  }
  return bonus
}

export function generateSchedule(userData, skills, ctrlOps, config, mfCats, tradeStrategies) {
  const issues = validateConfig(config)
  if (issues.length) throw new Error(`基建配置有误：${issues.join('；')}`)
  const chars = analyzeSkills(userData.chars || [], skills)
  const stations = buildStations(config, mfCats, tradeStrategies)
  const schedules = []
  for (let shift = 0; shift < 2; shift++) {
    const offset = Math.floor(chars.length / 2) * shift
    const rotated = [...chars.slice(offset), ...chars.slice(0, offset)]
    const used = new Set()
    const shiftStations = []
    for (const station of stations) {
      let result
      if (station.type === 'dormitory') {
        const unassigned = rotated.filter((op) => !used.has(op.charId))
        const ops = []
        for (let index = 0; index < station.slots && unassigned.length; index++) {
          const op = unassigned.shift()
          used.add(op.charId)
          ops.push({ charId: op.charId, name: op.name, displayName: op.displayName, rarity: op.rarity, skill: { type: 'rest', value: 0, desc: '休息恢复心情' }, moodCost: null })
        }
        while (ops.length < station.slots) ops.push({ charId: `empty_${ops.length}`, name: '空位', rarity: 1, skill: { type: 'empty', value: 0, desc: '待分配' }, moodCost: null })
        result = { assigned: ops, efficiency: 0, moodCost: 0 }
      } else if (station.type === 'assistant') {
        result = pickFacility('assistant', rotated.filter((op) => !used.has(op.charId)), station.slots, used, ctrlOps)
      } else if (station.type === 'manufacture') {
        result = pickMF(rotated.filter((op) => !used.has(op.charId)), station.slots, station.category, used)
      } else if (station.type === 'control') {
        result = pickFacility('control', chars, station.slots, used, ctrlOps)
      } else {
        result = pickFacility(station.type, rotated.filter((op) => !used.has(op.charId)), station.slots, used, ctrlOps)
      }
      shiftStations.push({ ...station, ops: result.assigned, eff: result.efficiency, skillMoodCost: result.moodCost || 0 })
    }
    const controlStation = shiftStations.find((station) => station.type === 'control')
    const bonus = controlBonus(controlStation, ctrlOps)
    pairTradingPartners(shiftStations.filter((station) => station.type === 'trading'))
    let totalMoodCost = 0
    let totalEfficiency = 0
    for (const station of shiftStations) {
      station.controlBonus = (station.type === 'manufacture' || station.type === 'trading') ? bonus : 0
      if (station.type === 'manufacture' || station.type === 'trading') {
        station.eff = station.eff * (1 + bonus / 100)
      }
      totalEfficiency += station.eff || 0
      if (station.type !== 'dormitory' && station.type !== 'training' && station.type !== 'workshop') {
        const occupied = (station.ops || []).filter((op) => !op.charId.startsWith('empty_')).length
        totalMoodCost += occupied * (station.mood || 0) + (station.skillMoodCost || 0)
      }
    }
    schedules.push({
      shift: shift + 1,
      label: SHIFT_LABELS[shift] || `班次${shift + 1}`,
      stations: shiftStations,
      efficiency: totalEfficiency,
      controlBonus: bonus,
      moodCost: totalMoodCost,
    })
  }
  return {
    id: Date.now().toString(36),
    createdAt: new Date().toISOString(),
    name: `排班方案 ${new Date().toLocaleDateString()} v4`,
    schedules,
    totalEfficiency: schedules.reduce((sum, shift) => sum + shift.efficiency, 0),
    totalMoodCost: schedules.reduce((sum, shift) => sum + shift.moodCost, 0),
    meta: { algorithm: 'v4-config-stations', shiftHours: SHIFT_HOURS },
  }
}
