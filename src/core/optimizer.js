import { bestSkillsByRoom, skillValue, skillsOf } from './data.js'

const ROOM_LABEL = {
  CONTROL: '控制中枢', MANUFACTURE: '制造站', TRADING: '贸易站', POWER: '发电站',
  DORMITORY: '宿舍', MEETING: '会客室', HIRE: '办公室', TRAINING: '训练室',
  WORKSHOP: '加工站', RECYCLE: '回收站',
}

const MF_RATE = {
  '赤金': 1 / 1.2,
  '作战记录': 1 / 3,
  '源石碎片': 1,
}
const MF_LABEL = { '赤金': '赤金', '作战记录': '作战记录', '源石碎片': '源石碎片' }

// 游戏数据：源石碎片配方 13 = 固源岩×2 + 1600 龙门币；配方 14 = 装置×1 + 1000 龙门币。
// 1-7 数据来自一图流（2026-10-20）：每理智 1.09 合成玉，搓 1 抽消耗 9.54 万龙门币。
const SHARD_RECIPES = {
  '固源岩': { key: '固源岩', materialName: '固源岩', perShard: 2, lmd: 1600, apPerShard: 10 / 1.09 },
  '装置': { key: '装置', materialName: '装置', perShard: 1, lmd: 1000, apPerShard: null },
}
const ORUNDUM_1_7 = { orundumPerAp: 1.09, lmdPerPull: 95400, stage: '1-7', source: '一图流 2026-10-20' }

function makeBalance(label, supply, demand) {
  const s = Math.max(0, Number(supply) || 0)
  const d = Math.max(0, Number(demand) || 0)
  const ratio = d > 0 ? Math.min(1, s / d) : 1
  const mfEffective = s > 0 ? Math.min(1, d / s) : 0
  const trEffective = d > 0 ? Math.min(1, s / d) : 0
  let limiting = '平衡'
  if (s <= 0 && d > 0) limiting = '制造不足'
  else if (d <= 0 && s > 0) limiting = '无贸易需求'
  else if (s < d) limiting = '制造'
  else if (s > d) limiting = '贸易'
  return { label, supply: s, demand: d, ratio, mfEffective, trEffective, limiting }
}
// Daily output scales: LMD ~ 30k, EXP ~ 24k, Orundum ~ 800, Trust ~ 2500.
// Normalising keeps the user's 0-100 weights comparable across resources.
const SCORE_SCALE = { lmd: 30000, exp: 24000, orundum: 800, trust: 4000 }

const defaultOptions = {
  mode: 'oneclick',
  weights: { lmd: 40, exp: 30, orundum: 20, trust: 10 },
  operationsPerDay: 3,
  drones: true,
  suggestions: true,
  startHour: 8,
}

function normalizeOptions(options) {
  const o = { ...defaultOptions, ...(options || {}) }
  const q = Math.min(4, Math.max(1, Number(o.operationsPerDay || 3)))
  o.queueCount = o.mode === 'oneclick' ? Math.min(3, q) : q
  o.hours = 24 / o.queueCount
  const w = o.weights || {}
  const total = Number(w.lmd || 0) + Number(w.exp || 0) + Number(w.orundum || 0) + Number(w.trust || 0)
  o.weights = {
    lmd: Number(w.lmd || 0) / (total || 1),
    exp: Number(w.exp || 0) / (total || 1),
    orundum: Number(w.orundum || 0) / (total || 1),
    trust: Number(w.trust || 0) / (total || 1),
  }
  return o
}

function slotsFor(data, room, level) {
  const info = data.facilities.rooms[room]
  if (!info) return 1
  const phase = (info.levels || []).find((l) => Number(l.level) === Number(level))
  return Math.max(1, Number(phase?.slots || 1))
}

function preparePool(player, data) {
  return player.chars.map((c) => {
    const all = skillsOf(c, data)
    const byRoom = bestSkillsByRoom(c, data)
    let bestValue = 0
    let bestRoom = ''
    for (const [room, skill] of Object.entries(byRoom)) {
      const v = skillValue(skill, room)
      if (v > bestValue) { bestValue = v; bestRoom = room }
    }
    return { char: c, all, byRoom, bestValue, bestRoom }
  })
}

function matchingSkill(person, room, product) {
  let best = null
  let bestScore = -1
  for (const skill of person.all) {
    if (skill.room !== room) continue
    let score = skillValue(skill, room)
    if (room === 'MANUFACTURE') {
      if (product === '赤金' && skill.subcategory === '贵金属') score = skillValue(skill, room)
      else if (product === '作战记录' && skill.subcategory === '作战记录') score = skillValue(skill, room)
      else if (product === '源石碎片' && skill.subcategory === '源石') score = skillValue(skill, room)
      else if (skill.subcategory === '通用') score = skillValue(skill, room) * 0.3
      else score = 0
    }
    if (score <= 0) continue
    if (score > bestScore) { bestScore = score; best = skill }
  }
  return best
}

function controlScore(person) {
  let score = 0
  for (const skill of person.all) {
    if (skill.room !== 'CONTROL') continue
    if (skill.subcategory === '制造加成' || skill.subcategory === '贸易加成') score += skillValue(skill, 'CONTROL')
    else if (skill.subcategory === '心情') score += skillValue(skill, 'CONTROL') * 0.5
    else score += skillValue(skill, 'CONTROL') * 0.2
    const effects = skill.effects || []
    const hasRecovery = effects.some((e) => e.type === 'moodRecovery')
    const hasCost = effects.some((e) => e.type === 'moodCost')
    if (hasRecovery) {
      const recovery = effects.filter((e) => e.type === 'moodRecovery').reduce((sum, e) => sum + Number(e.value || 0), 0)
      score += recovery * 20
    }
    if (hasCost) {
      const cost = effects.filter((e) => e.type === 'moodCost').reduce((sum, e) => sum + Number(e.value || 0), 0)
      score -= cost * 6
    }
    if (!hasRecovery && !hasCost && skill.subcategory === '心情') score -= Math.max(0, Number(skill.mood || 0)) * 6
  }
  return score
}

function takeOperators(pool, usedInQueue, usedCount, maxShifts, count, scorer, preferred) {
  const picks = []
  const canUse = (p) => {
    const used = usedCount.get(p.char.charId) || 0
    if (used >= maxShifts) return false
    // Operators with a high mood cost should not work two shifts in the same day.
    if (used >= 1 && (p.all || []).some((skill) => Number(skill.mood || 0) >= 1)) return false
    return !usedInQueue.has(p.char.charId)
  }
  if (preferred && preferred.length) {
    for (const id of preferred) {
      if (picks.length >= count) break
      const p = pool.find((x) => x.char.charId === id)
      if (p && canUse(p)) {
        picks.push(p)
        usedInQueue.add(id)
      }
    }
  }
  const sorted = pool
    .filter((p) => canUse(p) && !usedInQueue.has(p.char.charId))
    .map((p) => ({ p, score: scorer(p) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.p.bestValue - a.p.bestValue)
  for (const item of sorted) {
    if (picks.length >= count) break
    picks.push(item.p)
    usedInQueue.add(item.p.char.charId)
  }
  // Fill remaining slots even without a matching skill: every working operator
  // still gives the facility's +1% base efficiency.
  if (picks.length < count) {
    const rest = pool
      .filter((p) => canUse(p) && !usedInQueue.has(p.char.charId))
      .sort((a, b) => a.bestValue - b.bestValue)
    for (const p of rest) {
      if (picks.length >= count) break
      picks.push(p)
      usedInQueue.add(p.char.charId)
    }
  }
  return picks
}

function buildControlOps(pool, usedInQueue, usedCount, maxShifts, slots, data) {
  const preferred = []
  for (const combo of data.combos || []) {
    if (combo.facility !== 'CONTROL') continue
    if (combo.members.length <= slots) preferred.push(...combo.members)
  }
  const picked = takeOperators(pool, usedInQueue, usedCount, maxShifts, slots, controlScore, preferred)
  return picked.map((p) => {
    const skills = p.all.filter((s) => s.room === 'CONTROL')
    return { ...p, skills }
  })
}

function controlBonuses(controlOps) {
  // Same buff (same buffId base) does not stack: take the highest.
  const groups = new Map()
  for (const op of controlOps) {
    for (const skill of op.skills) {
      const key = String(skill.buffId || skill.name || '').replace(/\[\d+\]$/, '')
      const prev = groups.get(key)
      if (!prev || Number(skill.value || 0) > Number(prev.value || 0)) {
        groups.set(key, { subcategory: skill.subcategory, value: Number(skill.value || 0) })
      }
    }
  }
  let mfg = 0
  let trade = 0
  let mood = 0
  let moodRecovery = 0
  let moodCost = 0
  for (const op of controlOps || []) {
    for (const skill of op.skills || []) {
      const effects = skill.effects || []
      for (const effect of effects) {
        if (effect.target === 'otherFacilities' || effect.target === 'dormitory') continue
        if (effect.type === 'moodRecovery') {
          const count = effect.per === 'factionMember'
            ? (controlOps || []).filter((x) => x.char?.group === effect.factionId).length
            : 1
          moodRecovery += Number(effect.value || 0) * count
        }
        if (effect.type === 'moodCost') moodCost += Number(effect.value || 0)
      }
      if (!effects.length && skill.subcategory === '心情') {
        if (/恢复/.test(skill.text || '')) moodRecovery += Number(skill.mood || 0)
        else if (/消耗/.test(skill.text || '')) moodCost += Number(skill.mood || 0)
      }
    }
  }
  for (const item of groups.values()) {
    if (item.subcategory === '制造加成') mfg += item.value
    if (item.subcategory === '贸易加成') trade += item.value
  }
  return {
    manufacture: Math.min(25, mfg),
    trading: Math.min(25, trade),
    mood,
    moodRecovery,
    moodCost,
  }
}

function comboBonus(assigned, roomType, data) {
  let bonus = 0
  const used = []
  for (const combo of data.combos || []) {
    if (combo.facility !== roomType) continue
    const ids = (assigned[roomType] || []).map((a) => a.charId)
    if (combo.members.every((m) => ids.includes(m))) {
      const effect = combo.effect || {}
      bonus += Number(effect.tradeEfficiency || effect.manufactureEfficiency || effect.controlEfficiency || 0) * 100
      used.push(combo.id)
    }
  }
  return { bonus, used }
}

function assignQueue(pool, base, data, mix, usedCount, opts) {
  const maxShifts = opts.maxShifts != null ? Number(opts.maxShifts) : (opts.mode === 'manual' ? 2 : 1)
  const usedInQueue = new Set()
  const assigned = {
    CONTROL: [], MANUFACTURE: [], TRADING: [], POWER: [], MEETING: [], HIRE: [],
    TRAINING: [], WORKSHOP: [], RECYCLE: [],
  }
  const increment = (picks) => {
    for (const p of picks) usedCount.set(p.char.charId, (usedCount.get(p.char.charId) || 0) + 1)
  }

  const controlOps = buildControlOps(pool, usedInQueue, usedCount, maxShifts, base.controlLevel, data)
  assigned.CONTROL = controlOps.map((p) => ({
    charId: p.char.charId,
    name: p.char.name,
    rarity: p.char.rarity,
    profession: p.char.profession,
    skills: p.skills,
  }))
  increment(controlOps)
  const control = controlBonuses(controlOps)
  const controlCombo = comboBonus({ CONTROL: assigned.CONTROL }, 'CONTROL', data)
  control.manufacture += controlCombo.bonus
  control.trading += controlCombo.bonus

  const mfRooms = base.outputs.filter((o) => o.type === 'MANUFACTURE')
  const trRooms = base.outputs.filter((o) => o.type === 'TRADING')
  const pwRooms = base.outputs.filter((o) => o.type === 'POWER')

  mfRooms.forEach((room, index) => {
    const product = mix.mfProducts[index] || '作战记录'
    const slots = slotsFor(data, 'MANUFACTURE', room.level)
    const scorer = (p) => {
      const skill = matchingSkill(p, 'MANUFACTURE', product)
      if (!skill) return 0
      return skillValue(skill, 'MANUFACTURE') - Math.max(0, Number(skill.mood || 0)) * 4
    }
    const preferred = []
    for (const combo of data.combos || []) {
      if (combo.facility !== 'MANUFACTURE') continue
      if (combo.members.length <= slots) preferred.push(...combo.members)
    }
    const picks = takeOperators(pool, usedInQueue, usedCount, maxShifts, slots, scorer, preferred)
    assigned.MANUFACTURE.push({
      roomId: room.id,
      level: room.level,
      product,
      recipe: product === '源石碎片' ? (mix.shardRecipes?.[index] || '固源岩') : null,
      ops: picks.map((p) => {
        const skill = matchingSkill(p, 'MANUFACTURE', product)
        return { charId: p.char.charId, name: p.char.name, rarity: p.char.rarity, skill }
      }),
    })
    increment(picks)
  })

  trRooms.forEach((room, index) => {
    const strategy = mix.trStrategies[index] || '龙门商法'
    const slots = slotsFor(data, 'TRADING', room.level)
    const scorer = (p) => {
      const skill = p.byRoom.TRADING
      if (!skill) return 0
      let s = skillValue(skill, 'TRADING')
      if (skill.orderLimit) s += skill.orderLimit * 2
      s -= Math.max(0, Number(skill.mood || 0)) * 4
      return s
    }
    const preferred = []
    for (const combo of data.combos || []) {
      if (combo.facility !== 'TRADING') continue
      if (combo.members.length <= slots) preferred.push(...combo.members)
    }
    const picks = takeOperators(pool, usedInQueue, usedCount, maxShifts, slots, scorer, preferred)
    assigned.TRADING.push({
      roomId: room.id,
      level: room.level,
      strategy,
      ops: picks.map((p) => {
        const skill = p.byRoom.TRADING || matchingSkill(p, 'TRADING', '')
        return { charId: p.char.charId, name: p.char.name, rarity: p.char.rarity, skill }
      }),
    })
    increment(picks)
  })

  pwRooms.forEach((room) => {
    const slots = slotsFor(data, 'POWER', room.level)
    const scorer = (p) => {
      const skill = p.byRoom.POWER
      return skill ? skillValue(skill, 'POWER') : 0
    }
    const picks = takeOperators(pool, usedInQueue, usedCount, maxShifts, slots, scorer)
    assigned.POWER.push({
      roomId: room.id, level: room.level,
      ops: picks.map((p) => ({ charId: p.char.charId, name: p.char.name, rarity: p.char.rarity, skill: p.byRoom.POWER || null })),
    })
    increment(picks)
  })

  const fixed = [
    ['MEETING', 'MEETING', base.meetingLevel, 2],
    ['HIRE', 'HIRE', base.hireLevel, 1],
    ['TRAINING', 'TRAINING', base.trainingLevel, 2],
    ['WORKSHOP', 'WORKSHOP', base.workshopLevel, 1],
    ['RECYCLE', 'RECYCLE', base.recycleLevel, base.recycleLevel ? slotsFor(data, 'RECYCLE', base.recycleLevel) : 0],
  ]
  for (const [key, roomType, level, slots] of fixed) {
    if (!slots || slots <= 0) { assigned[key] = []; continue }
    const scorer = (p) => {
      const skill = p.byRoom[roomType]
      if (!skill) return 0
      const mood = Math.max(0, Number(skill.mood || 0))
      if (opts.hours >= 10 && mood >= 1.2) return -9999
      const value = roomType === 'TRAINING' ? skillValue(skill, roomType) * 0.8 : skillValue(skill, roomType)
      return value - mood * 6
    }
    const picks = takeOperators(pool, usedInQueue, usedCount, maxShifts, slots, scorer)
    assigned[key] = picks.map((p) => ({ charId: p.char.charId, name: p.char.name, rarity: p.char.rarity, skill: p.byRoom[roomType] || null }))
    increment(picks)
  }

  return { assigned, control, controlCombo: controlCombo.used, usedInQueue }
}

function skillSum(ops, room, product) {
  let sum = 0
  for (const op of ops || []) {
    const skill = op.skill || (op.skills || []).find((s) => s.room === room)
    if (!skill) continue
    if (room === 'MANUFACTURE') {
      if (product === '赤金' && skill.subcategory !== '贵金属') continue
      if (product === '作战记录' && skill.subcategory !== '作战记录') continue
      if (product === '源石碎片' && skill.subcategory !== '源石') continue
      if (skill.subcategory === '仓库') continue
    }
    sum += skillValue(skill, room)
  }
  return sum
}

function rateForManufacture(product, ops, control, combo, level) {
  const base = 1 + 0.01 * (ops || []).length + skillSum(ops, 'MANUFACTURE', product) / 100 + control.manufacture / 100 + combo / 100
  if (product === '作战记录') {
    const expPerRecord = level >= 3 ? 1000 : level >= 2 ? 400 : 200
    const hoursPerRecord = level >= 3 ? 3 : level >= 2 ? (80 / 60) : 0.75
    return { rate: 0, exp: (expPerRecord / hoursPerRecord) * base, efficiency: base }
  }
  return { rate: (MF_RATE[product] || 0) * base, efficiency: base }
}
function rateForTrading(strategy, ops, control, combo, data, level) {
  const order = (data.facilities.formulas.orders || []).find((o) => o.strategy === strategy && o.level === Number(level)) || (data.facilities.formulas.orders || []).find((o) => o.strategy === strategy) || {}
  const efficiency = 1 + 0.01 * (ops || []).length + skillSum(ops, 'TRADING', '') / 100 + control.trading / 100 + combo / 100
  if (strategy === '开采协力') {
    const orundum = (order.orundum || 20) / (order.seconds || 7200) * 3600
    return { rate: orundum * efficiency, efficiency, demand: (order.shard || 2) / (order.seconds || 7200) * 3600 * efficiency }
  }
  const lmd = (order.lmd || 2000) / (order.seconds || 16560) * 3600
  return { rate: lmd * efficiency, efficiency, demand: (order.gold || 4) / (order.seconds || 16560) * 3600 * efficiency }
}

function scoreQueues(queues, base, data, opts, mix) {
  let lmd = 0
  let exp = 0
  let orundum = 0
  let goldSupplyDay = 0
  let goldDemandDay = 0
  let shardSupplyDay = 0
  let shardDemandDay = 0
  let shardProduced = 0
  let shardConsumed = 0
  let shardGuiyan = 0
  let shardDevice = 0
  let shardLmdCost = 0
  let shardApCost = 0
  const shardByRecipe = { '固源岩': 0, '装置': 0 }
  const moodMap = new Map()
  const dormRate = base.dorms && base.dorms.length
    ? base.dorms.reduce((sum, d) => sum + 1.5 + 0.1 * Number(d.level || 1) + 0.0004 * Number(d.comfort || 0), 0) / base.dorms.length
    : 2.4
  const warnings = []
  let comboUsed = new Set()

  for (const q of queues) {
    const a = q.assigned
    const control = q.control || { manufacture: 0, trading: 0 }
    for (const id of q.controlCombo || []) comboUsed.add(id)
    let goldSupply = 0
    let goldDemand = 0
    let shardSupply = 0
    let shardDemand = 0
    let lmdRate = 0
    let orundumRate = 0

    for (const room of a.MANUFACTURE || []) {
      const combo = comboBonus({ MANUFACTURE: room.ops }, 'MANUFACTURE', data)
      combo.used.forEach((id) => comboUsed.add(id))
      const r = rateForManufacture(room.product, room.ops, control, combo.bonus, room.level)
      room.efficiency = r.efficiency
      room.rate = r.rate
      if (room.product === '赤金') {
        goldSupply += r.rate
        goldSupplyDay += r.rate * q.hours
      } else if (room.product === '源石碎片') {
        shardSupply += r.rate
        shardSupplyDay += r.rate * q.hours
        const recipe = SHARD_RECIPES[room.recipe] || SHARD_RECIPES['固源岩']
        const recipeLmd = recipe.key === '固源岩'
          ? Number(opts.shardCosts?.guiyanLmd ?? recipe.lmd)
          : Number(opts.shardCosts?.deviceLmd ?? recipe.lmd)
        const shards = r.rate * q.hours
        shardProduced += shards
        shardByRecipe[recipe.key] += shards
        if (recipe.key === '固源岩') shardGuiyan += shards * recipe.perShard
        else shardDevice += shards * recipe.perShard
        shardLmdCost += shards * recipeLmd
        shardApCost += shards * (recipe.apPerShard || 0)
        room.shardRecipe = recipe.key
        room.materialPerHour = r.rate * recipe.perShard
        room.lmdCostPerHour = r.rate * recipeLmd
        room.apPerHour = r.rate * (recipe.apPerShard || 0)
      } else {
        exp += (r.exp || 0) * q.hours
      }
    }
    for (const room of a.TRADING || []) {
      const combo = comboBonus({ TRADING: room.ops }, 'TRADING', data)
      combo.used.forEach((id) => comboUsed.add(id))
      const r = rateForTrading(room.strategy, room.ops, control, combo.bonus, data, room.level)
      room.efficiency = r.efficiency
      room.rate = r.rate
      if (room.strategy === '开采协力') { orundumRate += r.rate; shardDemand += r.demand }
      else { lmdRate += r.rate; goldDemand += r.demand }
    }
    const goldRatio = goldDemand > 0 ? Math.min(1, goldSupply / goldDemand) : 1
    const shardRatio = shardDemand > 0 ? Math.min(1, shardSupply / shardDemand) : 1
    lmd += lmdRate * goldRatio * q.hours
    orundum += orundumRate * shardRatio * q.hours
    goldDemandDay += goldDemand * q.hours
    shardDemandDay += shardDemand * q.hours
    shardConsumed += Math.min(shardSupply, shardDemand) * q.hours

    // Mood / efficiency per facility, also used by the plan UI.
    const controlOpsCount = (a.CONTROL || []).length
    const globalReduction = 0.05 * controlOpsCount
    const perOp = []
    const statFor = (key, ops, options = {}) => {
      const list = ops || []
      const baseRate = Math.max(0.05, Number(options.baseRate != null ? options.baseRate : (1 - globalReduction)))
      const rates = list.map((op) => {
        const skill = (op.skills || []).find((x) => x.room === key) || op.skill
        const moodMod = Number(skill?.mood || 0)
        return { charId: op.charId, rate: Math.min(2.5, Math.max(0, baseRate + moodMod)) }
      })
      perOp.push(...rates.map((r) => ({ ...r, key })))
      const stat = {
        count: list.length,
        moodPerOp: rates.length ? rates.reduce((sum, r) => sum + r.rate, 0) / rates.length : 0,
        moodTotal: rates.reduce((sum, r) => sum + r.rate, 0),
      }
      if (options.efficiency != null) stat.efficiency = options.efficiency
      return stat
    }

    q.stats = {}
    // Control center: its own mood reduction + global buffs.
    q.stats.CONTROL = statFor('CONTROL', a.CONTROL || [], {
      baseRate: 1 - 0.05 * controlOpsCount - Number(control.moodRecovery || 0) + Number(control.moodCost || 0),
      efficiency: null,
    })
    q.stats.CONTROL.manufacture = control.manufacture
    q.stats.CONTROL.trading = control.trading

    for (const room of a.MANUFACTURE || []) {
      const ops = room.ops || []
      const stat = statFor('MANUFACTURE', ops, {
        baseRate: 1 - (ops.length >= 3 ? 0.1 : ops.length >= 2 ? 0.05 : 0) - globalReduction,
        efficiency: room.efficiency,
      })
      room.moodPerOp = stat.moodPerOp
      room.moodTotal = stat.moodTotal
    }
    for (const room of a.TRADING || []) {
      const ops = room.ops || []
      const stat = statFor('TRADING', ops, {
        baseRate: 1 - (ops.length >= 3 ? 0.1 : ops.length >= 2 ? 0.05 : 0) - globalReduction,
        efficiency: room.efficiency,
      })
      room.moodPerOp = stat.moodPerOp
      room.moodTotal = stat.moodTotal
    }
    for (const room of a.POWER || []) {
      const ops = room.ops || []
      const eff = 1 + 0.05 * ops.length + skillSum(ops, 'POWER', '') / 100
      room.efficiency = eff
      const stat = statFor('POWER', ops, { baseRate: 1 - globalReduction, efficiency: eff })
      room.moodPerOp = stat.moodPerOp
      room.moodTotal = stat.moodTotal
    }
    q.stats.MEETING = statFor('MEETING', a.MEETING || [], {
      baseRate: 0.95 - globalReduction,
      efficiency: 1 + 0.05 * (a.MEETING || []).length + skillSum(a.MEETING || [], 'MEETING', '') / 100,
    })
    q.stats.HIRE = statFor('HIRE', a.HIRE || [], {
      baseRate: 1 - globalReduction,
      efficiency: 1 + 0.05 * (a.HIRE || []).length + skillSum(a.HIRE || [], 'HIRE', '') / 100,
    })
    q.stats.TRAINING = statFor('TRAINING', a.TRAINING || [], {
      baseRate: 1 - globalReduction,
      efficiency: 1 + 0.05 * (a.TRAINING || []).length + skillSum(a.TRAINING || [], 'TRAINING', '') / 100,
    })
    q.stats.WORKSHOP = statFor('WORKSHOP', a.WORKSHOP || [], {
      baseRate: 0,
      efficiency: skillSum(a.WORKSHOP || [], 'WORKSHOP', ''),
    })
    q.stats.WORKSHOP.moodPerOp = 0
    q.stats.WORKSHOP.moodTotal = 0
    q.stats.RECYCLE = statFor('RECYCLE', a.RECYCLE || [], {
      baseRate: 1 - globalReduction,
      efficiency: 1 + 0.01 * (a.RECYCLE || []).length + skillSum(a.RECYCLE || [], 'RECYCLE', '') / 100,
    })
    q.moodRate = perOp
  }

  // Sequential mood simulation (start at 24 for every operator).
  const mood = new Map()
  let minMood = 24
  for (const q of queues) {
    const working = new Map()
    for (const item of q.moodRate || []) {
      if (!mood.has(item.charId)) mood.set(item.charId, 24)
      working.set(item.charId, item.rate)
    }
    for (const [charId, value] of mood) {
      if (working.has(charId)) {
        const rate = working.get(charId)
        const next = value - rate * q.hours
        mood.set(charId, next)
        minMood = Math.min(minMood, next)
      } else if (value < 24) {
        mood.set(charId, Math.min(24, value + dormRate * q.hours))
      }
    }
  }
  if (minMood < 4) warnings.push('有干员心情低于 4，可能进入注意力涣散；建议减少班次或增加宿舍休整。')
  if (minMood < 0) warnings.push('有干员会进入注意力涣散，方案不可直接执行。')

  // 5 assistants: 中枢 500 + 4 floors ×125 = 1000 per settlement, twice daily = 2000.
  // Activity rooms: 125 per room per settlement, twice daily.
  const trust = Math.min(2000, (base.assistants || 0) * 400) + (base.privateCount || 0) * 250
  const droneFactor = opts.drones ? 1.05 : 1
  const finalLmd = lmd * droneFactor
  const finalExp = exp * droneFactor
  const finalOrundum = orundum * droneFactor
  const finalLmdCost = shardLmdCost * droneFactor
  const netLmd = finalLmd - finalLmdCost
  const finalShardProduced = shardProduced * droneFactor
  const finalShardConsumed = Math.min(finalShardProduced, shardDemandDay)
  const goldBalance = makeBalance('赤金', goldSupplyDay * droneFactor, goldDemandDay)
  const shardBalance = makeBalance('源石碎片', shardSupplyDay * droneFactor, shardDemandDay)
  if (goldBalance.limiting === '制造' && goldBalance.trEffective < 0.95) {
    warnings.push('赤金贸易开工不足：制造供应低于贸易需求，龙门币收益按制造侧计算。')
  }
  if (shardBalance.limiting === '制造' && shardBalance.trEffective < 0.95) {
    warnings.push('开采协力开工不足：源石碎片供应低于贸易需求，合成玉收益按制造侧计算。')
  }
  if (shardBalance.limiting === '贸易' && shardBalance.mfEffective < 0.95) {
    warnings.push('源石碎片有富余：贸易站吃不下全部碎片，多余部分只入库、不计收益。')
  }
  for (const q of queues) {
    for (const room of q.assigned.MANUFACTURE || []) {
      const balance = room.product === '赤金' ? goldBalance : room.product === '源石碎片' ? shardBalance : null
      room.utilization = balance ? balance.mfEffective : 1
      room.effectiveEfficiency = room.efficiency * room.utilization
    }
    for (const room of q.assigned.TRADING || []) {
      const balance = room.strategy === '开采协力' ? shardBalance : goldBalance
      room.utilization = balance ? balance.trEffective : 0
      room.effectiveEfficiency = room.efficiency * room.utilization
    }
  }
  const w = opts.weights
  const rawTotal = (netLmd / SCORE_SCALE.lmd) * w.lmd + (finalExp / SCORE_SCALE.exp) * w.exp + (finalOrundum / SCORE_SCALE.orundum) * w.orundum + (trust / SCORE_SCALE.trust) * w.trust
  const moodFactor = minMood < 0 ? 0.35 : minMood < 4 ? 0.8 : 1
  const total = rawTotal * moodFactor * 100
  return {
    lmd: finalLmd, netLmd, lmdCost: finalLmdCost, exp: finalExp, orundum: finalOrundum, trust,
    balance: { gold: goldBalance, shard: shardBalance },
    shard: {
      produced: finalShardProduced,
      consumed: finalShardConsumed,
      surplus: Math.max(0, finalShardProduced - finalShardConsumed),
      guiyan: shardGuiyan * droneFactor,
      device: shardDevice * droneFactor,
      lmdCost: finalLmdCost,
      apCost: shardApCost * droneFactor,
      byRecipe: { '固源岩': shardByRecipe['固源岩'] * droneFactor, '装置': shardByRecipe['装置'] * droneFactor },
      source: ORUNDUM_1_7,
    },
    minMood, total, rawTotal, moodFactor, warnings: [...warnings], combos: [...comboUsed],
  }
}

function quickScore(mix, base, opts) {
  const mf = base.counts.MANUFACTURE
  const tr = base.counts.TRADING
  const goldSupply = mix.goldMF * (1 / 1.2)
  const goldDemand = mix.lmdTR * (4 / 4.6)
  const lmd = (mix.lmdTR * (2000 / 4.6)) * (goldDemand ? Math.min(1, goldSupply / goldDemand) : 1) * 24
  const exp = mix.expMF * (1 / 3) * 1000 * 24
  const shardSupply = mix.shardMF * 1
  const shardDemand = mix.jadeTR * 1
  const orundum = (mix.jadeTR * 10) * (shardDemand ? Math.min(1, shardSupply / shardDemand) : 1) * 24
  const w = opts.weights
  return (lmd / SCORE_SCALE.lmd) * w.lmd + (exp / SCORE_SCALE.exp) * w.exp + (orundum / SCORE_SCALE.orundum) * w.orundum
}

function enumerateMixes(base, opts) {
  const mf = base.counts.MANUFACTURE
  const tr = base.counts.TRADING
  const mfRooms = (base.outputs || []).filter((o) => o.type === 'MANUFACTURE')
  const trRooms = (base.outputs || []).filter((o) => o.type === 'TRADING')
  const mfUnlocked = hasRecipeUnlock(mfRooms)
  const trUnlocked = hasRecipeUnlock(trRooms)
  const list = []
  for (let goldMF = 0; goldMF <= Math.min(mf, tr); goldMF += 1) {
    for (let jadeTR = 0; jadeTR <= (trUnlocked ? tr : 0); jadeTR += 1) {
      for (let shardMF = 0; shardMF <= (mfUnlocked ? mf - goldMF : 0); shardMF += 1) {
        const expMF = mf - goldMF - shardMF
        const lmdTR = tr - jadeTR
        // Recipes are level-gated: 源石碎片 / 开采协力 require Lv3.
        const mfProducts = new Array(mfRooms.length).fill('作战记录')
        let placed = 0
        for (let i = 0; i < mfRooms.length && placed < goldMF; i += 1) {
          mfProducts[i] = '赤金'
          placed += 1
        }
        placed = 0
        for (let i = 0; i < mfRooms.length && placed < shardMF; i += 1) {
          if (mfProducts[i] === '赤金') continue
          mfProducts[i] = '源石碎片'
          placed += 1
        }
        const trStrategies = new Array(trRooms.length).fill('龙门商法')
        placed = 0
        for (let i = 0; i < trRooms.length && placed < jadeTR; i += 1) {
          if (trStrategies[i] === '开采协力') continue
          trStrategies[i] = '开采协力'
          placed += 1
        }
        const key = goldMF + ':' + shardMF + ':' + expMF + ':' + jadeTR + ':' + lmdTR
        let label = '均衡'
        const hasLmd = goldMF > 0 && lmdTR > 0
        const hasExp = expMF > 0
        const hasJade = jadeTR > 0 && shardMF > 0
        if (hasJade && hasExp) label = '合成玉+经验'
        else if (hasJade) label = '合成玉'
        else if (hasLmd && hasExp) label = '龙门币+经验'
        else if (hasLmd) label = '龙门币'
        else if (hasExp) label = '经验'
        list.push({
          key, label, goldMF, shardMF, expMF, jadeTR, lmdTR, mfProducts, trStrategies,
          quick: quickScore({ goldMF, shardMF, expMF, jadeTR, lmdTR }, base, opts),
        })
      }
    }
  }
  list.sort((a, b) => b.quick - a.quick)
  const seen = new Set()
  const out = []
  for (const mix of list) {
    const dedupe = mix.label + ':' + mix.key
    if (seen.has(dedupe)) continue
    seen.add(dedupe)
    out.push(mix)
    if (out.length >= 8) break
  }
  return out
}

function makeQueuePlan(pool, base, data, mix, opts) {
  const usedCount = new Map()
  const queues = []
  for (let i = 0; i < opts.queueCount; i += 1) {
    const q = assignQueue(pool, base, data, mix, usedCount, opts)
    const startHour = (Number(opts.startHour || 8) + i * opts.hours) % 24
    queues.push({ index: i, startHour, hours: opts.hours, assigned: q.assigned, control: q.control, controlCombo: q.controlCombo || [] })
  }
  return queues
}

function buildTimeline(queues, base, opts) {
  const out = []
  for (const q of queues) {
    const h = Math.floor(q.startHour)
    const label = String(h).padStart(2, '0') + ':' + '00'
    out.push({ time: label, label: '切换到队列 ' + (q.index + 1), kind: 'queue' })
  }
  out.push({ time: '20:00', label: '会客室线索检查 / 领取线索交流', kind: 'meeting' })
  out.push({ time: '每日 4:00 / 16:00', label: '副手信赖、活动室信赖结算', kind: 'trust' })
  if (base.recycleLevel >= 3) out.push({ time: '每 48h', label: '回收站收取产物；可投入 T3 材料提速', kind: 'recycle' })
  if (base.trainingLevel) out.push({ time: '按专精计划', label: '训练室：训练位锁定，协助位可换', kind: 'training' })
  if (base.workshopLevel) out.push({ time: '按需', label: '加工站：加工前安排副产物干员', kind: 'workshop' })
  return out
}

function isLmdOrOrundumSkill(skill) {
  if (skill.room === 'MANUFACTURE') return skill.subcategory === '贵金属' || skill.subcategory === '源石'
  if (skill.room === 'TRADING') return ['订单效率', '订单上限', '订单质量', '特殊订单'].includes(skill.subcategory)
  if (skill.room === 'CONTROL') return skill.subcategory === '制造加成' || skill.subcategory === '贸易加成'
  if (skill.room === 'POWER') return skill.subcategory === '充能'
  // 加工站副产物、会客室线索、办公室刷新、训练室、宿舍不再作为练度建议
  return false
}

function recommendationCategory(skill, context) {
  const target = context?.target
  const balance = context?.balance
  if (target === 'lmd' && skill.subcategory === '源石') return null
  if (target === 'orundum' && skill.subcategory === '贵金属') return null
  if (!balance) {
    if (skill.room === 'MANUFACTURE') return 'general-mfg'
    if (skill.room === 'TRADING') return 'general-trade'
    if (skill.room === 'CONTROL' || skill.room === 'POWER') return 'support'
    return null
  }
  const gold = balance.gold
  const shard = balance.shard
  const goldMfgShort = gold.demand > 0 && gold.supply < gold.demand
  const goldTradeShort = gold.supply > gold.demand
  const shardMfgShort = shard.demand > 0 && shard.supply < shard.demand
  const shardTradeShort = shard.supply > shard.demand
  if (skill.room === 'MANUFACTURE') {
    if (skill.subcategory === '贵金属') return target !== 'orundum' && goldMfgShort ? 'gold-mfg' : null
    if (skill.subcategory === '源石') return target !== 'lmd' && shardMfgShort ? 'shard-mfg' : null
  }
  if (skill.room === 'TRADING') {
    const goldAllowed = target !== 'orundum' && goldTradeShort
    const shardAllowed = target !== 'lmd' && shardTradeShort
    if (goldAllowed && shardAllowed) return 'trade-both'
    if (goldAllowed) return 'gold-trade'
    if (shardAllowed) return 'shard-trade'
    return null
  }
  if (skill.room === 'CONTROL' || skill.room === 'POWER') return 'support'
  return null
}

function recommendationResource(skill, category) {
  if (category === 'gold-mfg') return '龙门币'
  if (category === 'shard-mfg') return '合成玉'
  if (category === 'gold-trade') return '龙门币贸易'
  if (category === 'shard-trade') return '合成玉贸易'
  if (category === 'trade-both') return '龙门币 / 合成玉贸易'
  if (skill.room === 'CONTROL') return '制造 / 贸易'
  if (skill.room === 'POWER') return '无人机加速'
  return '龙门币 / 合成玉'
}

function recommendationHint(balance, target) {
  if (!balance) return ''
  const gold = balance.gold
  const shard = balance.shard
  const includeGold = target !== 'orundum'
  const includeShard = target !== 'lmd'
  const points = []
  const advice = []
  if (includeGold && gold.demand > 0 && gold.supply < gold.demand) {
    points.push('赤金制造不足')
    advice.push('赤金制造')
  }
  if (includeShard && shard.demand > 0 && shard.supply < shard.demand) {
    points.push('源石碎片制造不足')
    advice.push('源石碎片制造')
  }
  if (includeGold && gold.supply > gold.demand) {
    points.push('龙门币贸易产能不足（赤金有富余）')
    advice.push('龙门币贸易')
  }
  if (includeShard && shard.supply > shard.demand) {
    points.push('合成玉贸易产能不足（源石碎片有富余）')
    advice.push('合成玉贸易')
  }
  if (!points.length) return ''
  const targetText = target === 'lmd' ? '（主攻龙门币）' : target === 'orundum' ? '（主攻合成玉）' : '（均衡）'
  return '当前瓶颈' + targetText + '：' + points.join('、') + '。建议优先补 ' + advice.join('、') + '；中枢/发电对两侧都有帮助。'
}

const PROMOTION_LMD = {
  1: [0, 10000], 2: [0, 10000], 3: [0, 10000],
  4: [0, 15000, 60000], 5: [0, 20000, 120000], 6: [0, 30000, 180000],
}

function recommendationCost(entry, char, skill) {
  const rarity = Number(entry.rarity || char.rarity || 1)
  const currentPhase = Number(char.elite || 0)
  const targetPhase = Number(skill.phase || 0)
  let materials = 0
  let lmd = 0
  for (let phase = currentPhase + 1; phase <= targetPhase; phase += 1) {
    const costs = entry.evolveCosts?.[phase] || []
    for (const cost of costs) {
      if (cost.type === 'GOLD') lmd += Number(cost.count || 0)
      else materials += Number(cost.count || 0)
    }
    lmd += PROMOTION_LMD[rarity]?.[phase] || 0
  }
  if (!entry.evolveCosts && targetPhase > currentPhase) {
    materials += (targetPhase - currentPhase) * rarity * 2
  }
  const levelBase = targetPhase > currentPhase ? 1 : Number(char.level || 1)
  const levelGap = Math.max(0, Number(skill.level || 1) - levelBase)
  const levelPenalty = levelGap * rarity * 0.2
  const cost = materials + lmd / 1000 + levelPenalty
  const parts = []
  if (targetPhase > currentPhase) {
    parts.push('精' + targetPhase + ' 材料' + materials + (lmd ? ' + ' + Math.round(lmd / 1000) + 'k LMD' : ''))
  }
  if (levelGap > 0) parts.push('Lv' + skill.level + '（差' + levelGap + '级）')
  return {
    cost,
    costText: parts.join(' / ') || '已满足',
    promotionLmd: lmd,
    promotionMaterials: materials,
    levelGap,
  }
}

function buildRecommendations(player, data, context = {}) {
  const list = []
  for (const char of player.chars) {
    const entry = data.characters[char.charId]
    if (!entry) continue
    const current = bestSkillsByRoom(char, data)
    for (const skill of entry.skills || []) {
      if (!isLmdOrOrundumSkill(skill)) continue
      const category = recommendationCategory(skill, context)
      if (!category) continue
      if (Number(skill.phase || 0) <= Number(char.elite || 0) && Number(char.level || 1) >= Number(skill.level || 1)) continue
      const now = current[skill.room] ? skillValue(current[skill.room], skill.room) : 0
      const potential = skillValue(skill, skill.room)
      const gain = potential - now
      if (gain <= 0.5) continue
      const costInfo = recommendationCost(entry, char, skill)
      list.push({
        charId: char.charId,
        name: char.name,
        rarity: entry.rarity || char.rarity,
        room: skill.room,
        roomName: ROOM_LABEL[skill.room] || skill.room,
        category,
        resource: recommendationResource(skill, category),
        skill: skill.name,
        phase: skill.phase,
        level: skill.level,
        gain: Number(gain.toFixed(1)),
        cost: Number(costInfo.cost.toFixed(2)),
        costText: costInfo.costText,
        efficiency: Number((gain / Math.max(0.5, costInfo.cost)).toFixed(2)),
      })
    }
  }
  const seen = new Set()
  const deduped = list
    .sort((a, b) => b.efficiency - a.efficiency || b.gain - a.gain)
    .filter((item) => {
      const key = item.charId + ':' + item.room
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  if (!context.balance) return deduped.slice(0, 6)
  const order = ['gold-mfg', 'shard-mfg', 'gold-trade', 'shard-trade', 'trade-both', 'support']
  const picked = []
  const used = new Set()
  const add = (item) => {
    const key = item.charId + ':' + item.room
    if (used.has(key) || picked.length >= 6) return
    used.add(key)
    picked.push(item)
  }
  for (const category of order) {
    const items = deduped.filter((item) => item.category === category)
    const limit = category === 'support' ? 1 : 2
    items.slice(0, limit).forEach(add)
  }
  deduped.forEach(add)
  return picked.slice(0, 6)
}

function buildLayoutTips(base, data) {
  const tips = []
  for (const layout of data.facilities.layouts || []) {
    if (layout.manufacture === base.counts.MANUFACTURE && layout.trading === base.counts.TRADING) continue
    tips.push({ id: layout.id, name: layout.name, note: layout.note })
  }
  return tips.slice(0, 2)
}

function hasRecipeUnlock(rooms) {
  return rooms.some((room) => Number(room.level) >= 3 || ['13', '14'].includes(String(room.formulaId || '')) || room.strategy === 'O_DIAMOND')
}

function buildFixedMix(base, opts) {
  const mfRooms = (base.outputs || []).filter((o) => o.type === 'MANUFACTURE')
  const trRooms = (base.outputs || []).filter((o) => o.type === 'TRADING')
  const mfUnlocked = hasRecipeUnlock(mfRooms)
  const trUnlocked = hasRecipeUnlock(trRooms)
  const mfProducts = mfRooms.map((room, i) => {
    const value = opts.products ? opts.products[i] : null
    if (value === '源石碎片' && !mfUnlocked) return '作战记录'
    return ['赤金', '作战记录', '源石碎片'].includes(value) ? value : '赤金'
  })
  const trStrategies = trRooms.map((room, i) => {
    const value = opts.strategies ? opts.strategies[i] : null
    if (value === '开采协力' && !trUnlocked) return '龙门商法'
    return ['龙门商法', '开采协力'].includes(value) ? value : '龙门商法'
  })
  const goldMF = mfProducts.filter((p) => p === '赤金').length
  const shardMF = mfProducts.filter((p) => p === '源石碎片').length
  const expMF = mfProducts.filter((p) => p === '作战记录').length
  const jadeTR = trStrategies.filter((p) => p === '开采协力').length
  const lmdTR = trStrategies.filter((p) => p === '龙门商法').length
  const shardRecipes = mfProducts.map((product, i) => {
    if (product !== '源石碎片') return null
    return SHARD_RECIPES[opts.recipes?.[i]] ? opts.recipes[i] : '固源岩'
  })
  return {
    key: 'fixed', label: '自定义', mfProducts, trStrategies, shardRecipes,
    goldMF, shardMF, expMF, jadeTR, lmdTR,
  }
}

function buildVariants(opts) {
  const maxQ = opts.mode === 'oneclick' ? 3 : 4
  const baseQ = Math.min(maxQ, Math.max(1, Number(opts.queueCount || 3)))
  const specs = [
    { profile: '推荐', queueCount: baseQ, maxShifts: opts.mode === 'manual' ? 2 : 1 },
    { profile: '省心', queueCount: Math.max(2, baseQ - 1), maxShifts: 1 },
    { profile: '极限', queueCount: Math.min(maxQ, baseQ + 1), maxShifts: 2 },
  ]
  const out = []
  const seen = new Set()
  const push = (spec) => {
    const key = spec.queueCount + ':' + spec.maxShifts
    if (seen.has(key) || out.length >= 3) return
    seen.add(key)
    out.push(spec)
  }
  specs.forEach(push)
  const fillers = [
    { profile: '均衡', queueCount: Math.min(maxQ, baseQ + 1), maxShifts: 1 },
    { profile: '均衡', queueCount: baseQ, maxShifts: 2 },
    { profile: '均衡', queueCount: Math.max(2, baseQ - 1), maxShifts: 2 },
    { profile: '均衡', queueCount: Math.max(2, baseQ - 1), maxShifts: 1 },
  ]
  fillers.forEach(push)
  return out
}

function makeFixedCandidates(pool, base, data, opts, fixed) {
  const candidates = []
  for (const variant of buildVariants(opts)) {
    const vopts = {
      ...opts,
      queueCount: variant.queueCount,
      hours: 24 / variant.queueCount,
      maxShifts: variant.maxShifts,
    }
    const queues = makeQueuePlan(pool, base, data, fixed, vopts)
    const score = scoreQueues(queues, base, data, vopts, fixed)
    candidates.push({
      id: 'fixed-' + variant.profile + '-' + variant.queueCount + '-' + variant.maxShifts,
      label: variant.queueCount + ' 次/天',
      profile: variant.profile,
      maxShifts: variant.maxShifts,
      mix: { goldMF: fixed.goldMF, shardMF: fixed.shardMF, expMF: fixed.expMF, jadeTR: fixed.jadeTR, lmdTR: fixed.lmdTR, mfProducts: fixed.mfProducts, trStrategies: fixed.trStrategies },
      queues,
      score,
      operationsPerDay: variant.queueCount,
      shiftHours: vopts.hours,
      timeline: buildTimeline(queues, base, vopts),
      layoutTips: opts.suggestions ? buildLayoutTips(base, data) : [],
    })
  }
  return candidates
}

function targetRaw(candidate, target) {
  if (target === 'lmd') return candidate.score.netLmd
  if (target === 'orundum') return candidate.score.orundum
  return candidate.score.netLmd / SCORE_SCALE.lmd + candidate.score.orundum / SCORE_SCALE.orundum
}

function attachTargetScores(candidates, target) {
  if (!candidates.length) return
  const raws = candidates.map((c) => targetRaw(c, target))
  const best = Math.max(...raws)
  const worst = Math.min(...raws)
  candidates.forEach((c, index) => {
    c.score.targetScore = best === worst ? 100 : (100 * (raws[index] - worst) / (best - worst))
  })
}

export function generatePlans(player, base, data, options) {
  const opts = normalizeOptions(options)
  const pool = preparePool(player, data)
  const fixedMode = Array.isArray(opts.products) && opts.products.length > 0
  let picked = []
  if (fixedMode) {
    const fixed = buildFixedMix(base, opts)
    picked = makeFixedCandidates(pool, base, data, opts, fixed)
  } else {
    const mixes = enumerateMixes(base, opts)
    const candidates = []
    for (const mix of mixes) {
      const queues = makeQueuePlan(pool, base, data, mix, opts)
      const score = scoreQueues(queues, base, data, opts, mix)
      candidates.push({
        id: mix.key,
        label: mix.label,
        profile: mix.label,
        mix: { goldMF: mix.goldMF, shardMF: mix.shardMF, expMF: mix.expMF, jadeTR: mix.jadeTR, lmdTR: mix.lmdTR },
        queues,
        score,
        operationsPerDay: opts.queueCount,
        shiftHours: opts.hours,
        timeline: buildTimeline(queues, base, opts),
        layoutTips: opts.suggestions ? buildLayoutTips(base, data) : [],
      })
    }
    candidates.sort((a, b) => b.score.total - a.score.total)
    const labels = new Set()
    for (const c of candidates) {
      if (picked.length >= 3) break
      if (labels.has(c.label)) continue
      picked.push(c)
      labels.add(c.label)
    }
    for (const c of candidates) {
      if (picked.length >= 3) break
      if (!picked.includes(c)) picked.push(c)
    }
  }
  const target = opts.target || 'balanced'
  if (opts.target) {
    attachTargetScores(picked, target)
    picked.sort((a, b) => b.score.targetScore - a.score.targetScore)
  }
  const primary = picked[0]
  const recommendationContext = opts.target
    ? { target: opts.target, balance: primary?.score?.balance }
    : {}
  return {
    candidates: picked,
    meta: {
      mode: opts.mode,
      target,
      operationsPerDay: opts.queueCount,
      fixedMode,
      products: opts.products || [],
      strategies: opts.strategies || [],
      warnings: base.issues || [],
      recommendationHint: recommendationHint(primary?.score?.balance, target),
      recommendations: buildRecommendations(player, data, recommendationContext),
      dataVersion: data.meta?.version || '',
      comboCount: (data.combos || []).length,
    },
  }
}

export { ROOM_LABEL, normalizeOptions, SCORE_SCALE }
