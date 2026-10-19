import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildBase, DEFAULT_MANUAL } from '../src/core/base.js'
import { generatePlans } from '../src/core/optimizer.js'
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
