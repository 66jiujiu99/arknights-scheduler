import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildBase, DEFAULT_MANUAL } from '../src/core/base.js'
import { generatePlans, companionEfficiency } from '../src/core/optimizer.js'
import { skillValue } from '../src/core/data.js'

const facilities = JSON.parse(readFileSync(new URL('../public/data/v5/facilities.json', import.meta.url), 'utf8'))
const BASE = {
  controlLevel: 5,
  outputs: [
    ...Array.from({ length: 3 }, (_, i) => ({ id: 'mf' + i, type: 'MANUFACTURE', level: 3 })),
    ...Array.from({ length: 3 }, (_, i) => ({ id: 'tr' + i, type: 'TRADING', level: 3 })),
    ...Array.from({ length: 3 }, (_, i) => ({ id: 'pw' + i, type: 'POWER', level: 3 })),
  ],
  counts: { MANUFACTURE: 3, TRADING: 3, POWER: 3 },
  dorms: Array.from({ length: 4 }, (_, i) => ({ id: 'd' + i, level: 5, comfort: 5000 })),
  meetingLevel: 3, hireLevel: 3, trainingLevel: 3, workshopLevel: 3,
  recycleLevel: 3, privateCount: 8, privateLevels: [], assistants: 5,
  power: { supply: 810, demand: 810, balance: 0, detail: {} },
  issues: [],
}

function mkData(characters = {}, combos = []) {
  return { meta: { version: 'test' }, characters, facilities, combos, allCombos: combos }
}
function mkSkill(room, subcategory, value, extra = {}) {
  return {
    buffId: 'test_' + room + '_' + subcategory, room, name: '测试技能', desc: '', text: '',
    category: 'OUTPUT', subcategory, phase: 0, level: 1,
    percent: value, percents: [value], flats: [], flat: 0, flatNegative: 0,
    value, mood: 0, orderLimit: 0, capacity: 0, stacking: 'stack', conditional: false,
    ...extra,
  }
}
function mkPlayer(specs) {
  return {
    chars: specs.map((s) => ({
      charId: s.id, name: s.id, rarity: 6, profession: '近卫',
      level: s.level || 60, elite: s.elite ?? 2, potential: 0, mainSkillLvl: 7, skills: [], equip: [], favor: 100,
    })),
  }
}
function pool(n, prefix = 'op') {
  return Array.from({ length: n }, (_, i) => ({ id: prefix + i, name: prefix + i }))
}
function generate(player, data, options) {
  return generatePlans(player, BASE, data, {
    mode: 'oneclick',
    operationsPerDay: 2,
    weights: { lmd: 40, exp: 30, orundum: 20, trust: 10 },
    drones: false,
    suggestions: false,
    ...options,
  })
}
function top(result) { return result.candidates[0] }

test('power: 3-3-3 full base is exactly 810', () => {
  const player = {
    building: {
      control: { level: 5 },
      outputs: BASE.outputs,
      dorms: BASE.dorms,
      meeting: { level: 3 },
      hire: { level: 3 },
      training: { level: 3 },
    },
  }
  const base = buildBase(player, { ...DEFAULT_MANUAL, workshopLevel: 3 }, mkData())
  assert.equal(base.power.supply, 810)
  assert.equal(base.power.demand, 810)
  assert.deepEqual(base.issues, [])
  assert.equal(base.assistants, 5)
})

test('power: 5 MF + 5 TR is flagged as over budget', () => {
  const outputs = [
    ...Array.from({ length: 5 }, (_, i) => ({ type: 'MANUFACTURE', level: 3 })),
    ...Array.from({ length: 5 }, (_, i) => ({ type: 'TRADING', level: 3 })),
    ...Array.from({ length: 3 }, (_, i) => ({ type: 'POWER', level: 3 })),
  ]
  const player = {
    building: {
      control: { level: 5 }, outputs,
      dorms: BASE.dorms, meeting: { level: 3 }, hire: { level: 3 }, training: { level: 3 },
    },
  }
  const base = buildBase(player, { ...DEFAULT_MANUAL, workshopLevel: 3 }, mkData())
  assert.equal(base.power.supply, 810)
  assert.equal(base.power.demand, 1050)
  assert.ok(base.issues.some((x) => x.includes('电力不足')))
})

test('LMD weights pick the gold/龙门商法 mix and match hand calculation', () => {
  const data = mkData()
  const player = mkPlayer(pool(60))
  const result = generate(player, data, { weights: { lmd: 100, exp: 0, orundum: 0, trust: 0 }, drones: false })
  const c = top(result)
  assert.equal(c.mix.goldMF, 3)
  assert.equal(c.mix.lmdTR, 3)
  // No skills: each room has 3 ops -> 3% base. Control has no buffs.
  const mfRate = 3 * (1 / 1.2) * 1.03
  const trDemand = 3 * (4 / 4.6) * 1.03
  const trRate = 3 * (2000 / 4.6) * 1.03
  const ratio = Math.min(1, mfRate / trDemand)
  const expected = trRate * ratio * 24
  assert.ok(Math.abs(c.score.lmd - expected) < 0.01, 'expected ' + expected + ' got ' + c.score.lmd)
  assert.equal(c.score.exp, 0)
  assert.equal(c.score.orundum, 0)
})

test('EXP weights pick the record mix and match hand calculation', () => {
  const data = mkData()
  const player = mkPlayer(pool(60))
  const result = generate(player, data, { weights: { lmd: 0, exp: 100, orundum: 0, trust: 0 }, drones: false })
  const c = top(result)
  assert.equal(c.mix.expMF, 3)
  const expected = 3 * (1000 / 3) * 1.03 * 24
  assert.ok(Math.abs(c.score.exp - expected) < 0.01, 'expected ' + expected + ' got ' + c.score.exp)
  assert.equal(c.score.lmd, 0)
})

test('Orundum weights pick the shard/开采协力 mix and match hand calculation', () => {
  const data = mkData()
  const player = mkPlayer(pool(60))
  const result = generate(player, data, { weights: { lmd: 0, exp: 0, orundum: 100, trust: 0 }, drones: false })
  const c = top(result)
  assert.equal(c.mix.shardMF, 3)
  assert.equal(c.mix.jadeTR, 3)
  const expected = 3 * 10 * 1.03 * 24
  assert.ok(Math.abs(c.score.orundum - expected) < 0.01, 'expected ' + expected + ' got ' + c.score.orundum)
  assert.equal(c.score.lmd, 0)
})

test('drones toggle adds exactly 5% to the same plan', () => {
  const data = mkData()
  const player = mkPlayer(pool(60))
  const off = top(generate(player, data, { weights: { lmd: 100, exp: 0, orundum: 0, trust: 0 }, drones: false }))
  const on = top(generate(player, data, { weights: { lmd: 100, exp: 0, orundum: 0, trust: 0 }, drones: true }))
  assert.ok(Math.abs(on.score.lmd / off.score.lmd - 1.05) < 0.001)
})

test('mood: 3-operator room with control 5 costs 0.65/h; power room leaves 15 after 12h', () => {
  const data = mkData()
  const player = mkPlayer(pool(60))
  const result = generate(player, data, { weights: { lmd: 100, exp: 0, orundum: 0, trust: 0 }, drones: false })
  const c = top(result)
  assert.ok(Math.abs(c.score.minMood - 15) < 0.05, 'minMood ' + c.score.minMood)
})

test('manual mode is not worse than one-click on the same weights', () => {
  const data = mkData()
  const player = mkPlayer(pool(80))
  const one = top(generate(player, data, { mode: 'oneclick', operationsPerDay: 2, weights: { lmd: 40, exp: 30, orundum: 20, trust: 10 } }))
  const manual = top(generate(player, data, { mode: 'manual', operationsPerDay: 3, weights: { lmd: 40, exp: 30, orundum: 20, trust: 10 } }))
  assert.ok(manual.score.total >= one.score.total * 0.99, 'manual ' + manual.score.total + ' < oneclick ' + one.score.total)
})

test('plan structure: slots, ownership, uniqueness, unlocked skills', () => {
  const characters = {}
  const specs = pool(60)
  // Add a few skilled operators.
  characters['sk_mf'] = { id: 'sk_mf', name: 'sk_mf', rarity: 6, profession: '近卫', skills: [mkSkill('MANUFACTURE', '贵金属', 30)] }
  characters['sk_tr'] = { id: 'sk_tr', name: 'sk_tr', rarity: 6, profession: '先锋', skills: [mkSkill('TRADING', '订单效率', 35)] }
  characters['sk_ctrl'] = { id: 'sk_ctrl', name: 'sk_ctrl', rarity: 6, profession: '辅助', skills: [mkSkill('CONTROL', '制造加成', 10)] }
  specs.push({ id: 'sk_mf' }, { id: 'sk_tr' }, { id: 'sk_ctrl' })
  const data = mkData(characters)
  const player = mkPlayer(specs)
  const result = generate(player, data, { weights: { lmd: 50, exp: 50, orundum: 0, trust: 0 } })
  const owned = new Set(player.chars.map((c) => c.charId))
  for (const cand of result.candidates) {
    for (const q of cand.queues) {
      const seen = new Set()
      const all = []
      all.push(...q.assigned.CONTROL)
      for (const r of q.assigned.MANUFACTURE) all.push(...r.ops)
      for (const r of q.assigned.TRADING) all.push(...r.ops)
      for (const r of q.assigned.POWER) all.push(...r.ops)
      for (const key of ['MEETING', 'HIRE', 'TRAINING', 'WORKSHOP', 'RECYCLE']) all.push(...(q.assigned[key] || []))
      for (const op of all) {
        assert.ok(owned.has(op.charId), 'not owned ' + op.charId)
        assert.ok(!seen.has(op.charId), 'duplicate in queue ' + op.charId)
        seen.add(op.charId)
        if (op.skill) {
          const char = player.chars.find((c) => c.charId === op.charId)
          assert.ok(op.skill.phase <= char.elite, 'locked phase ' + op.skill.phase)
          assert.ok(op.skill.level <= char.level, 'locked level ' + op.skill.level)
        }
      }
      assert.equal(q.assigned.CONTROL.length, 5)
      assert.equal(q.assigned.MANUFACTURE.length, 3)
      assert.equal(q.assigned.TRADING.length, 3)
      assert.equal(q.assigned.POWER.length, 3)
      assert.ok(q.assigned.MANUFACTURE.every((r) => r.ops.length <= 3))
      assert.ok(q.assigned.TRADING.every((r) => r.ops.length <= 3))
      assert.ok(q.assigned.POWER.every((r) => r.ops.length <= 1))
      assert.ok((q.assigned.MEETING || []).length <= 2)
      assert.ok((q.assigned.HIRE || []).length <= 1)
      assert.ok((q.assigned.TRAINING || []).length <= 2)
      assert.ok((q.assigned.WORKSHOP || []).length <= 1)
      assert.ok((q.assigned.RECYCLE || []).length <= 2)
    }
  }
})

test('combo is placed together and increases the score', () => {
  const characters = {
    texas: { id: 'texas', name: '德克萨斯', rarity: 5, profession: '先锋', skills: [mkSkill('TRADING', '订单效率', 35)] },
    lapp: { id: 'lapp', name: '拉普兰德', rarity: 5, profession: '近卫', skills: [mkSkill('TRADING', '订单效率', 30)] },
  }
  const combo = { id: 'test_pair', name: '测试组合', facility: 'TRADING', members: ['texas', 'lapp'], effect: { tradeEfficiency: 0.65 }, verified: true }
  const specs = [...pool(30), { id: 'texas' }, { id: 'lapp' }]
  const player = mkPlayer(specs)
  const withCombo = generate(player, mkData(characters, [combo]), { weights: { lmd: 100, exp: 0, orundum: 0, trust: 0 } })
  const without = generate(player, mkData(characters, []), { weights: { lmd: 100, exp: 0, orundum: 0, trust: 0 } })
  const c = top(withCombo)
  assert.ok(c.score.combos.includes('test_pair'), 'combo not used: ' + c.score.combos)
  assert.ok(c.score.lmd > top(without).score.lmd, 'combo should increase LMD')
  const tr = c.queues[0].assigned.TRADING
  assert.ok(tr.some((r) => r.ops.some((o) => o.charId === 'texas') && r.ops.some((o) => o.charId === 'lapp')))
})

test('组合条件只在同房间成立于计入，且不与 combos 重复计数', () => {
  const condEff = (value, condition) => ({ type: 'orderEfficiency', room: 'TRADING', unit: 'percent', value, condition })
  const texas = {
    charId: 'texas', name: '德克萨斯',
    skill: { room: 'TRADING', effects: [condEff(65, { type: 'withCharInRoom', char: '拉普兰德', room: 'TRADING' })] },
  }
  const lapp = { charId: 'lapp', name: '拉普兰德', skill: { room: 'TRADING', effects: [] } }
  const other = { charId: 'other', name: '路人', skill: { room: 'TRADING', effects: [] } }
  // 单独进驻：条件不成立，+65% 不能计入
  assert.equal(companionEfficiency([texas], 'TRADING', ''), 0)
  // 与拉普兰德同房间：只计一次 +65%（组合条目 appliedByEffects，不再额外加）
  assert.equal(companionEfficiency([texas, lapp], 'TRADING', ''), 65)
  // 同房间但不是指定干员：不计
  assert.equal(companionEfficiency([texas, other], 'TRADING', ''), 0)

  // 阵营条件：同房间有该阵营干员才计
  const factionEff = { type: 'productivity', room: 'MANUFACTURE', unit: 'percent', value: 10, condition: { type: 'factionInRoom', factionId: 'lgd' } }
  const worker = { charId: 'w', name: '工人', skill: { room: 'MANUFACTURE', effects: [factionEff] } }
  const chen = { charId: 'chen', name: '陈', factions: ['lgd'], skill: { room: 'MANUFACTURE', effects: [] } }
  const x = { charId: 'x', name: '路人乙', factions: ['rh'], skill: { room: 'MANUFACTURE', effects: [] } }
  assert.equal(companionEfficiency([worker, chen], 'MANUFACTURE', ''), 10)
  assert.equal(companionEfficiency([worker, x], 'MANUFACTURE', ''), 0)
})

test('recommendations only include owned operators with locked skills', () => {
  const characters = {
    locked: { id: 'locked', name: '未练干员', rarity: 6, profession: '近卫', skills: [mkSkill('MANUFACTURE', '贵金属', 30, { phase: 2, level: 1 })] },
    unowned: { id: 'unowned', name: '未拥有', rarity: 6, profession: '近卫', skills: [mkSkill('MANUFACTURE', '贵金属', 30, { phase: 2 })] },
  }
  const player = mkPlayer([{ id: 'locked', elite: 0, level: 1 }, ...pool(20)])
  const result = generate(player, mkData(characters), { weights: { lmd: 100, exp: 0, orundum: 0, trust: 0 } })
  const rec = result.meta.recommendations
  assert.ok(rec.some((r) => r.charId === 'locked'), 'owned locked skill should be recommended')
  assert.ok(!rec.some((r) => r.charId === 'unowned'), 'unowned must not be recommended')
})


test('skills + control bonus match hand calculation', () => {
  const characters = {
    gold_op: { id: 'gold_op', name: 'gold_op', rarity: 6, profession: '近卫', skills: [mkSkill('MANUFACTURE', '贵金属', 30)] },
    trade_op: { id: 'trade_op', name: 'trade_op', rarity: 6, profession: '先锋', skills: [mkSkill('TRADING', '订单效率', 35)] },
    ctrl_op: { id: 'ctrl_op', name: 'ctrl_op', rarity: 6, profession: '辅助', skills: [mkSkill('CONTROL', '制造加成', 10)] },
  }
  const specs = [...pool(60), { id: 'gold_op' }, { id: 'trade_op' }, { id: 'ctrl_op' }]
  const player = mkPlayer(specs)
  const result = generate(player, mkData(characters), { operationsPerDay: 1, weights: { lmd: 100, exp: 0, orundum: 0, trust: 0 }, drones: false })
  const c = top(result)
  assert.equal(c.mix.goldMF, 3)
  assert.equal(c.mix.lmdTR, 3)
  const mfControl = 10 / 100
  const trControl = 0
  const mfRate = (1 / 1.2) * (1 + 0.03 + 0.30 + mfControl) + 2 * (1 / 1.2) * (1 + 0.03 + mfControl)
  const trDemand = 2 * (4 / 4.6) * (1 + 0.03 + trControl) + (4 / 4.6) * (1 + 0.03 + 0.35 + trControl)
  const trRate = 2 * (2000 / 4.6) * (1 + 0.03 + trControl) + (2000 / 4.6) * (1 + 0.03 + 0.35 + trControl)
  const ratio = Math.min(1, mfRate / trDemand)
  const expected = trRate * ratio * 24
  assert.ok(Math.abs(c.score.lmd - expected) < 0.02, 'expected ' + expected + ' got ' + c.score.lmd)
})

test('top candidate is at least as good as the naive all-gold / all-record / all-shard baselines', () => {
  const data = mkData()
  const player = mkPlayer(pool(60))
  const lmdTop = top(generate(player, data, { weights: { lmd: 100, exp: 0, orundum: 0, trust: 0 }, drones: false }))
  assert.ok(lmdTop.score.lmd >= 30000)
  const expTop = top(generate(player, data, { weights: { lmd: 0, exp: 100, orundum: 0, trust: 0 }, drones: false }))
  assert.ok(expTop.score.exp >= 24000)
  const jadeTop = top(generate(player, data, { weights: { lmd: 0, exp: 0, orundum: 100, trust: 0 }, drones: false }))
  assert.ok(jadeTop.score.orundum >= 700)
})


test('control buffs with the same buffId do not stack twice', () => {
  const characters = {
    ctrl_a: { id: 'ctrl_a', name: 'ctrl_a', rarity: 6, profession: '辅助', skills: [mkSkill('CONTROL', '制造加成', 10, { buffId: 'ctrl_same[000]' })] },
    ctrl_b: { id: 'ctrl_b', name: 'ctrl_b', rarity: 6, profession: '辅助', skills: [mkSkill('CONTROL', '制造加成', 5, { buffId: 'ctrl_same[010]' })] },
  }
  const player = mkPlayer([...pool(60), { id: 'ctrl_a' }, { id: 'ctrl_b' }])
  const result = generate(player, mkData(characters), { operationsPerDay: 1, weights: { lmd: 100, exp: 0, orundum: 0, trust: 0 }, drones: false })
  const c = top(result)
  assert.equal(c.queues[0].control.manufacture, 10)
})


test('level-gated recipes: 源石碎片 / 开采协力 not used below Lv3', () => {
  const lowBase = {
    ...BASE,
    outputs: [
      { id: 'mf0', type: 'MANUFACTURE', level: 1 },
      { id: 'tr0', type: 'TRADING', level: 1 },
      { id: 'pw0', type: 'POWER', level: 3 },
    ],
    counts: { MANUFACTURE: 1, TRADING: 1, POWER: 1 },
  }
  const data = mkData()
  const player = mkPlayer(pool(20))
  const result = generatePlans(player, lowBase, data, {
    mode: 'oneclick', operationsPerDay: 1,
    weights: { lmd: 0, exp: 0, orundum: 100, trust: 0 }, drones: false,
  })
  const c = result.candidates[0]
  assert.equal(c.mix.shardMF, 0)
  assert.equal(c.mix.jadeTR, 0)
  assert.equal(c.score.orundum, 0)
})


test('fixed products/strategies are respected and facilities expose mood/efficiency', () => {
  const data = mkData()
  const player = mkPlayer(pool(60))
  const products = ['赤金', '作战记录', '源石碎片']
  const strategies = ['龙门商法', '开采协力', '龙门商法']
  const result = generatePlans(player, BASE, data, {
    mode: 'manual',
    operationsPerDay: 3,
    products,
    strategies,
    drones: false,
    suggestions: false,
    weights: { lmd: 40, exp: 30, orundum: 20, trust: 10 },
  })
  assert.equal(result.candidates.length, 3)
  for (const c of result.candidates) {
    assert.deepEqual(c.mix.mfProducts, products)
    assert.deepEqual(c.mix.trStrategies, strategies)
    const q = c.queues[0]
    assert.equal(q.assigned.MANUFACTURE.length, 3)
    assert.equal(q.assigned.TRADING.length, 3)
    for (const room of q.assigned.MANUFACTURE) {
      assert.ok(Number.isFinite(room.efficiency) && room.efficiency > 1)
      assert.ok(Number.isFinite(room.moodPerOp))
      assert.ok(room.moodPerOp > 0)
    }
    for (const room of q.assigned.TRADING) {
      assert.ok(Number.isFinite(room.efficiency) && room.efficiency > 1)
      assert.ok(Number.isFinite(room.moodPerOp))
    }
    for (const key of ['CONTROL', 'MEETING', 'HIRE', 'TRAINING', 'WORKSHOP', 'RECYCLE']) {
      assert.ok(q.stats[key], 'missing stats ' + key)
      assert.ok(Number.isFinite(q.stats[key].moodPerOp))
    }
  }
})


test('recipe unlock is account-wide: one Lv3 room unlocks shards for all rooms', () => {
  const mixedBase = {
    ...BASE,
    outputs: [
      { id: 'mf0', type: 'MANUFACTURE', level: 3 },
      { id: 'mf1', type: 'MANUFACTURE', level: 1 },
      { id: 'tr0', type: 'TRADING', level: 3 },
      { id: 'pw0', type: 'POWER', level: 3 },
    ],
    counts: { MANUFACTURE: 2, TRADING: 1, POWER: 1 },
  }
  const data = mkData()
  const player = mkPlayer(pool(30))
  const products = ['源石碎片', '源石碎片']
  const strategies = ['开采协力']
  const result = generatePlans(player, mixedBase, data, {
    mode: 'oneclick', operationsPerDay: 2,
    products, strategies, drones: false,
    weights: { lmd: 0, exp: 0, orundum: 100, trust: 0 },
  })
  assert.deepEqual(result.candidates[0].mix.mfProducts, products)
  assert.deepEqual(result.candidates[0].mix.trStrategies, strategies)
})


test('level-up suggestions ignore workshop/records and keep LMD/orundum skills', () => {
  const characters = {
    workshop_op: { id: 'workshop_op', name: '加工干员', rarity: 6, profession: '近卫', skills: [mkSkill('WORKSHOP', '副产物', 100, { phase: 2 })] },
    record_op: { id: 'record_op', name: '记录干员', rarity: 6, profession: '近卫', skills: [mkSkill('MANUFACTURE', '作战记录', 30, { phase: 2 })] },
    gold_op: { id: 'gold_op', name: '赤金干员', rarity: 6, profession: '近卫', skills: [mkSkill('MANUFACTURE', '贵金属', 30, { phase: 2 })] },
  }
  const player = mkPlayer([{ id: 'workshop_op', elite: 0, level: 1 }, { id: 'record_op', elite: 0, level: 1 }, { id: 'gold_op', elite: 0, level: 1 }, ...pool(20)])
  const result = generate(player, mkData(characters), { weights: { lmd: 50, exp: 25, orundum: 25, trust: 0 } })
  const recs = result.meta.recommendations
  assert.ok(recs.some((r) => r.charId === 'gold_op'), 'LMD skill should be recommended')
  assert.ok(!recs.some((r) => r.charId === 'workshop_op'), 'workshop skill must not be recommended')
  assert.ok(!recs.some((r) => r.charId === 'record_op'), 'EXP-only skill must not be recommended')
})


test('shard plan accounts materials, LMD cost and trade bottleneck', () => {
  const base = {
    ...BASE,
    outputs: [
      { id: 'mf0', type: 'MANUFACTURE', level: 3 },
      { id: 'tr0', type: 'TRADING', level: 3 },
      { id: 'pw0', type: 'POWER', level: 3 },
    ],
    counts: { MANUFACTURE: 1, TRADING: 1, POWER: 1 },
  }
  const result = generatePlans(mkPlayer(pool(20)), base, mkData(), {
    mode: 'oneclick', operationsPerDay: 2,
    products: ['源石碎片'], strategies: ['开采协力'], recipes: ['固源岩'],
    drones: true, weights: { lmd: 0, exp: 0, orundum: 100, trust: 0 },
  })
  const c = result.candidates[0]
  const shard = c.score.shard
  assert.ok(shard.produced > 0)
  assert.ok(Math.abs(shard.guiyan - shard.produced * 2) < 1e-6)
  assert.ok(Math.abs(shard.lmdCost - shard.produced * 1600) < 1e-6)
  assert.ok(Math.abs(c.score.netLmd - (c.score.lmd - c.score.lmdCost)) < 1e-6)
  assert.ok(c.score.balance.shard)
  assert.ok(c.score.balance.shard.supply > 0)
  assert.ok(c.queues[0].assigned.MANUFACTURE[0].effectiveEfficiency > 0)
})


test('shard LMD cost can be overridden (e.g. 1200)', () => {
  const base = {
    ...BASE,
    outputs: [
      { id: 'mf0', type: 'MANUFACTURE', level: 3 },
      { id: 'tr0', type: 'TRADING', level: 3 },
      { id: 'pw0', type: 'POWER', level: 3 },
    ],
    counts: { MANUFACTURE: 1, TRADING: 1, POWER: 1 },
  }
  const result = generatePlans(mkPlayer(pool(20)), base, mkData(), {
    mode: 'oneclick', operationsPerDay: 2,
    products: ['源石碎片'], strategies: ['开采协力'], recipes: ['固源岩'],
    shardCosts: { guiyanLmd: 1200, deviceLmd: 1000 },
    drones: false, weights: { lmd: 0, exp: 0, orundum: 100, trust: 0 },
  })
  const c = result.candidates[0]
  assert.ok(Math.abs(c.score.shard.lmdCost - c.score.shard.produced * 1200) < 1e-6)
})


test('target modes produce relative scores from 0 to 100', () => {
  const data = mkData()
  const player = mkPlayer(pool(40))
  const result = generatePlans(player, BASE, data, {
    mode: 'manual', operationsPerDay: 3, target: 'orundum',
    products: ['赤金', '作战记录', '源石碎片'],
    strategies: ['龙门商法', '开采协力'],
    drones: false, weights: { lmd: 40, exp: 30, orundum: 20, trust: 10 },
  })
  const scores = result.candidates.map((c) => c.score.targetScore)
  assert.ok(scores.every((s) => Number.isFinite(s) && s >= 0 && s <= 100))
  assert.ok(Math.abs(Math.max(...scores) - 100) < 1e-9)
})


test('recommendations follow the bottleneck: manufacturing shortage excludes trade skills', () => {
  const characters = {
    mf_op: { id: 'mf_op', name: '制造干员', rarity: 6, profession: '近卫', skills: [mkSkill('MANUFACTURE', '贵金属', 30, { phase: 2 })] },
    trade_op: { id: 'trade_op', name: '贸易干员', rarity: 6, profession: '近卫', skills: [mkSkill('TRADING', '订单效率', 30, { phase: 2 })] },
  }
  const base = {
    ...BASE,
    outputs: [
      { id: 'mf0', type: 'MANUFACTURE', level: 3 },
      { id: 'tr0', type: 'TRADING', level: 3 },
      { id: 'pw0', type: 'POWER', level: 3 },
    ],
    counts: { MANUFACTURE: 1, TRADING: 1, POWER: 1 },
  }
  const player = mkPlayer([{ id: 'mf_op', elite: 0, level: 1 }, { id: 'trade_op', elite: 0, level: 1 }, ...pool(20)])
  const result = generatePlans(player, base, mkData(characters), {
    mode: 'oneclick', operationsPerDay: 2, target: 'balanced',
    products: ['赤金'], strategies: ['龙门商法'], drones: false,
    weights: { lmd: 50, exp: 0, orundum: 50, trust: 0 },
  })
  const recs = result.meta.recommendations
  assert.ok(recs.some((r) => r.charId === 'mf_op'), 'manufacturing skill should be recommended')
  assert.ok(!recs.some((r) => r.charId === 'trade_op'), 'trade skill should be excluded while manufacturing is the bottleneck')
})


test('mixed bottleneck keeps both production and trade recommendations', () => {
  const characters = {
    gold_op: { id: 'gold_op', name: '赤金干员', rarity: 6, profession: '近卫', skills: [mkSkill('MANUFACTURE', '贵金属', 30, { phase: 2 })] },
    trade_op: { id: 'trade_op', name: '贸易干员', rarity: 6, profession: '近卫', skills: [mkSkill('TRADING', '订单效率', 35, { phase: 2 })] },
  }
  const base = {
    ...BASE,
    outputs: [
      { id: 'mf0', type: 'MANUFACTURE', level: 3 },
      { id: 'mf1', type: 'MANUFACTURE', level: 3 },
      { id: 'mf2', type: 'MANUFACTURE', level: 3 },
      { id: 'mf3', type: 'MANUFACTURE', level: 3 },
      { id: 'tr0', type: 'TRADING', level: 3 },
      { id: 'tr1', type: 'TRADING', level: 3 },
      { id: 'pw0', type: 'POWER', level: 3 },
      { id: 'pw1', type: 'POWER', level: 3 },
    ],
    counts: { MANUFACTURE: 4, TRADING: 2, POWER: 2 },
  }
  const player = mkPlayer([{ id: 'gold_op', elite: 0, level: 1 }, { id: 'trade_op', elite: 0, level: 1 }, ...pool(20)])
  const result = generatePlans(player, base, mkData(characters), {
    mode: 'oneclick', operationsPerDay: 2, target: 'balanced',
    products: ['赤金', '源石碎片', '源石碎片', '源石碎片'],
    strategies: ['龙门商法', '开采协力'],
    drones: false, weights: { lmd: 50, exp: 0, orundum: 50, trust: 0 },
  })
  const recs = result.meta.recommendations
  assert.ok(recs.some((r) => r.category === 'gold-mfg'), 'gold production should be recommended')
  assert.ok(recs.some((r) => r.category === 'shard-trade'), 'jade trade should be recommended')
  assert.ok(result.meta.recommendationHint.includes('赤金制造'))
  assert.ok(result.meta.recommendationHint.includes('合成玉贸易'))
})


test('recommendations prefer low promotion cost for the same skill gain', () => {
  const characters = {
    cheap: {
      id: 'cheap', name: '低星干员', rarity: 3, profession: '近卫',
      evolveCosts: [null, [{ id: 'm1', count: 2, type: 'MATERIAL' }]],
      skills: [mkSkill('MANUFACTURE', '贵金属', 30, { phase: 1, level: 1 })],
    },
    expensive: {
      id: 'expensive', name: '高星干员', rarity: 6, profession: '近卫',
      evolveCosts: [null, [{ id: 'm2', count: 5, type: 'MATERIAL' }], [{ id: 'm3', count: 20, type: 'MATERIAL' }]],
      skills: [mkSkill('MANUFACTURE', '贵金属', 30, { phase: 2, level: 1 })],
    },
  }
  const player = mkPlayer([{ id: 'cheap', elite: 0, level: 1 }, { id: 'expensive', elite: 0, level: 1 }])
  const result = generate(player, mkData(characters), { weights: { lmd: 100, exp: 0, orundum: 0, trust: 0 } })
  const recs = result.meta.recommendations
  const cheap = recs.find((r) => r.charId === 'cheap')
  const expensive = recs.find((r) => r.charId === 'expensive')
  assert.ok(cheap && expensive)
  assert.ok(cheap.efficiency > expensive.efficiency)
  assert.ok(cheap.cost < expensive.cost)
})


test('manufacture slots never use a skill for another product', () => {
  const characters = {
    gold_op: { id: 'gold_op', name: '赤金干员', rarity: 5, profession: '近卫', skills: [mkSkill('MANUFACTURE', '贵金属', 30)] },
    record_op: { id: 'record_op', name: '经验干员', rarity: 5, profession: '近卫', skills: [mkSkill('MANUFACTURE', '作战记录', 30)] },
    source_op: { id: 'source_op', name: '源石干员', rarity: 5, profession: '近卫', skills: [mkSkill('MANUFACTURE', '源石', 30)] },
  }
  const player = mkPlayer([{ id: 'gold_op' }, { id: 'record_op' }, { id: 'source_op' }, ...pool(20)])
  const result = generate(player, mkData(characters), {
    products: ['赤金', '赤金', '赤金'], strategies: ['龙门商法', '龙门商法', '龙门商法'],
    weights: { lmd: 100, exp: 0, orundum: 0, trust: 0 },
  })
  const room = result.candidates[0].queues[0].assigned.MANUFACTURE[0]
  for (const op of room.ops) {
    assert.ok(!op.skill || op.skill.subcategory === '贵金属' || op.skill.subcategory === '通用')
  }
  assert.ok(!room.ops.some((op) => op.skill?.subcategory === '作战记录' || op.skill?.subcategory === '源石'))
})


test('operators data exposes structured effects and Ch\'en faction recovery', () => {
  const operators = JSON.parse(readFileSync(new URL('../public/data/v5/operators.json', import.meta.url), 'utf8'))
  const chen = Object.values(operators.characters).find((c) => c.name === '陈')
  const skill = chen.skills.find((s) => s.name === '德才兼备')
  assert.equal(skill.effects[0].type, 'moodRecovery')
  assert.equal(skill.effects[0].target, 'control')
  assert.equal(skill.effects[0].per, 'factionMember')
  assert.equal(skill.effects[0].factionId, 'lgd')
  assert.ok(Object.values(operators.characters).every((c) => c.skills.every((s) => Array.isArray(s.effects))))
})

test('characters 暴露 factions，与效果里的 factionId 同一套命名', () => {
  const operators = JSON.parse(readFileSync(new URL('../public/data/v5/operators.json', import.meta.url), 'utf8'))
  const chars = Object.values(operators.characters)
  const byName = (name) => chars.find((c) => c.name === name)
  // 标记 id ↔ 官方 nation/group/team 的翻译，逐个抽样确认
  assert.ok(byName('陈').factions.includes('lgd'), '龙门近卫局')
  assert.ok(byName('银灰').factions.includes('karlan'), '谢拉格')
  assert.ok(byName('早露').factions.includes('ussg'), '乌萨斯学生自治团')
  assert.ok(byName('灰烬').factions.includes('R6'), '彩虹小队')
  assert.ok(byName('提丰').factions.includes('sm'), '萨米')
  assert.ok(byName('芬').factions.includes('A1'), 'A1 小队')
  assert.ok(byName('吽').factions.includes('lda'), '鲤氏侦探事务所')
  assert.ok(byName('塞雷娅').factions.includes('rh'), '莱茵生命')

  // 反向护栏：效果里按派系计数用到的 factionId，必须至少能落到一个角色身上，
  // 否则那条效果永远算不出人数（正是本轮修复的 bug）。
  const used = new Set()
  for (const c of chars) {
    for (const s of c.skills || []) {
      for (const e of s.effects || []) {
        if (e.factionId && e.per === 'factionMember') used.add(e.factionId)
      }
    }
  }
  const owned = new Set(chars.flatMap((c) => c.factions || []))
  const missing = [...used].filter((f) => !owned.has(f))
  assert.deepEqual(missing, [], '这些 factionId 找不到任何干员: ' + missing.join(','))
})
