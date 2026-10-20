// tests/effects.test.mjs
// v2 effects 结构化数据用例：直接读 public/data/v5/operators.json。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const ops = JSON.parse(readFileSync(new URL('../public/data/v5/operators.json', import.meta.url), 'utf8'))
const chars = Object.values(ops.characters)
const byName = new Map(chars.map((c) => [c.name, c]))

function skillOf(charName, skillName) {
  const c = byName.get(charName)
  assert.ok(c, '缺少干员 ' + charName)
  const s = (c.skills || []).find((x) => x.name === skillName)
  assert.ok(s, charName + ' 缺少技能 ' + skillName)
  return s
}
function effectsOf(charName, skillName) {
  return skillOf(charName, skillName).effects || []
}

test('每条技能都有 effects 数组', () => {
  for (const c of chars) {
    for (const s of c.skills || []) {
      assert.ok(Array.isArray(s.effects), c.name + '/' + s.name + ' 缺 effects')
    }
  }
})

test('schema 版本为 2，且 meta 带审核统计', () => {
  assert.equal(ops.meta.effectSchemaVersion, 2)
  assert.ok(ops.meta.audit)
  assert.equal(ops.meta.audit.skills, undefined)
  assert.ok(typeof ops.meta.audit.effectTotal === 'number')
  assert.ok(ops.meta.audit.effectTotal > 900)
  assert.ok(Array.isArray(ops.meta.effectTypes))
})

test("陈的德才兼备解析为 moodRecovery/control/factionMember/lgd/0.05", () => {
  const e = effectsOf('陈', '德才兼备')[0]
  assert.equal(e.type, 'moodRecovery')
  assert.equal(e.target, 'control')
  assert.equal(e.per, 'factionMember')
  assert.equal(e.factionId, 'lgd')
  assert.equal(e.value, 0.05)
  assert.equal(e.unit, 'perHour')
})

test('制造站产物严格区分：源石技能不会带贵金属产物', () => {
  let gold = 0
  let shard = 0
  let record = 0
  for (const c of chars) {
    for (const s of c.skills || []) {
      if (s.room !== 'MANUFACTURE') continue
      for (const e of s.effects || []) {
        if (e.type !== 'productivity') continue
        if (e.product === '贵金属') gold += 1
        else if (e.product === '源石') shard += 1
        else if (e.product === '作战记录') record += 1
      }
    }
  }
  assert.ok(gold > 0 && shard > 0 && record > 0, '三类产物都应有结构化条目')
})

test('贸易站订单上限按带符号数值存储', () => {
  const found = []
  for (const c of chars) {
    for (const s of c.skills || []) {
      for (const e of s.effects || []) {
        if (e.type === 'orderLimit') found.push({ name: c.name + '/' + s.name, v: e.value, unit: e.unit })
      }
    }
  }
  assert.ok(found.length > 10)
  for (const f of found) {
    assert.equal(typeof f.v, 'number')
    assert.equal(f.unit, 'orders')
  }
})

test('心情消耗与恢复分开表达，且心情数值不为负', () => {
  let recovery = 0
  let cost = 0
  let reduction = 0
  for (const c of chars) {
    for (const s of c.skills || []) {
      for (const e of s.effects || []) {
        if (e.type === 'moodRecovery') { recovery += 1; assert.ok(e.value >= 0) }
        if (e.type === 'moodCost') { cost += 1; assert.ok(e.value >= 0) }
        if (e.type === 'moodCostReduction') { reduction += 1; assert.ok(e.value >= 0) }
      }
    }
  }
  assert.ok(recovery > 50 && cost > 10 && reduction > 10)
})

test('发电站无人机充能结构化为 droneCharge/percent', () => {
  const e = effectsOf('格雷伊', '静电场')[0]
  assert.equal(e.type, 'droneCharge')
  assert.equal(e.room, 'POWER')
  assert.equal(e.unit, 'percent')
  assert.equal(e.value, 20)
})

test('控制中枢制造加成指向 allManufacture，且同种效果取最高', () => {
  // 凯尔希「最高权限」：控制中枢内给所有制造站加生产力
  const e = effectsOf('凯尔希', '最高权限').find((x) => x.type === 'productivity')
  assert.ok(e, '凯尔希/最高权限 应有 productivity')
  assert.equal(e.room, 'MANUFACTURE')
  assert.equal(e.target, 'allManufacture')
  assert.equal(e.unit, 'percent')
  assert.equal(e.value, 2)
  assert.equal(e.stacking, 'max')
  // 阿米娅「合作协议」：控制中枢内给所有贸易站加效率
  const t2 = effectsOf('阿米娅', '合作协议').find((x) => x.type === 'orderEfficiency')
  assert.ok(t2, '阿米娅/合作协议 应有 orderEfficiency')
  assert.equal(t2.room, 'TRADING')
  assert.equal(t2.target, 'allTrading')
  assert.equal(t2.value, 7)
  assert.equal(t2.stacking, 'max')
})

test('训练室技能带 profession 与 trainingSpeed', () => {
  const e = effectsOf('杜宾', '教官')[0]
  assert.equal(e.type, 'trainingSpeed')
  assert.equal(e.room, 'TRAINING')
  assert.equal(e.unit, 'percent')
  assert.equal(e.value, 25)
})

test('加工站副产物概率带产物筛选', () => {
  const e = effectsOf('12F', '特训记录')[0]
  assert.equal(e.type, 'workshopByproduct')
  assert.equal(e.room, 'WORKSHOP')
  assert.equal(e.product, '芯片')
  assert.equal(e.value, 70)
})

test('宿舍单体恢复标记 excludeSelf 与同种效果取最高', () => {
  const e = effectsOf('芙蓉', '善解人意')[0]
  assert.equal(e.type, 'moodRecovery')
  assert.equal(e.excludeSelf, true)
  assert.equal(e.stacking, 'max')
})

test('条件技能带 condition 对象而不是只留中文', () => {
  let withCond = 0
  for (const c of chars) {
    for (const s of c.skills || []) {
      for (const e of s.effects || []) {
        if (e.condition) {
          withCond += 1
          assert.equal(typeof e.condition, 'object')
          assert.ok(e.condition.type, 'condition 需要 type')
        }
      }
    }
  }
  assert.ok(withCond > 100, '应有大量条件效果')
})

test('阵营叠加用 factionId + per=factionMember 表达', () => {
  const ids = new Set()
  for (const c of chars) {
    for (const s of c.skills || []) {
      for (const e of s.effects || []) {
        if (e.per === 'factionMember') {
          assert.ok(e.factionId, c.name + '/' + s.name + ' 缺 factionId')
          ids.add(e.factionId)
        }
      }
    }
  }
  for (const id of ['lgd', 'sui', 'abyssal', 'ussg', 'karlan', 'R6']) {
    assert.ok(ids.has(id), '缺少阵营 ' + id)
  }
})

test('特殊资源（人间烟火等）结构化为 specialResource', () => {
  const found = []
  for (const c of chars) {
    for (const s of c.skills || []) {
      for (const e of s.effects || []) {
        if (e.type === 'specialResource') found.push(e)
      }
    }
  }
  assert.ok(found.length > 20)
  const names = new Set(found.map((e) => e.resourceName))
  assert.ok(names.has('人间烟火'), '应包含人间烟火')
})

test('加工站心情消耗按配方结算，不是每小时消耗', () => {
  const found = []
  for (const c of chars) {
    for (const s of c.skills || []) {
      for (const e of s.effects || []) {
        if (e.type === 'workshopMoodCost') found.push(e)
      }
    }
  }
  assert.ok(found.length > 10)
  for (const e of found) assert.equal(e.unit, 'mood')
})

test('未结构化技能有 manualReview 说明', () => {
  for (const c of chars) {
    for (const s of c.skills || []) {
      if (!s.effects || !s.effects.length) {
        assert.ok(s.manualReview, c.name + '/' + s.name + ' 空 effects 需要 manualReview')
        assert.ok(s.manualReview.reason)
      }
    }
  }
})

test('每条 effect 都有 source（buffId）与 text 便于核对', () => {
  for (const c of chars) {
    for (const s of c.skills || []) {
      for (const e of s.effects || []) {
        assert.ok(e.source, c.name + '/' + s.name + ' 缺 source')
        assert.ok(e.text, c.name + '/' + s.name + ' 缺 text')
      }
    }
  }
})

test('effect 的 room 都是合法设施', () => {
  const ROOMS = new Set(['CONTROL', 'POWER', 'MANUFACTURE', 'TRADING', 'DORMITORY', 'WORKSHOP', 'HIRE', 'TRAINING', 'RECYCLE', 'MEETING'])
  for (const c of chars) {
    for (const s of c.skills || []) {
      for (const e of s.effects || []) {
        assert.ok(ROOMS.has(e.room), c.name + '/' + s.name + ' 非法 room: ' + e.room)
      }
    }
  }
})
// 「当与 X 同站」「当前房间存在某阵营」这类组合条件不能计入静态值，
// 否则等于无条件生效，且会和 combos 重复计算（德克萨斯「恩怨」曾算成 130%）。
test('组合型条件效果不进静态 percent / mood', () => {
  const byBuff = new Map()
  for (const c of chars) for (const s of c.skills || []) if (!byBuff.has(s.buffId)) byBuff.set(s.buffId, { char: c.name, skill: s })
  const texas = byBuff.get('trade_ord_spd&cost_P[000]')
  assert.ok(texas, '缺少德克萨斯「恩怨」')
  assert.equal(texas.skill.percent, 0, '恩怨 +65% 是条件效果，不该进静态 percent')
  assert.equal(texas.skill.mood, 0, '恩怨 +0.3/h 心情消耗是条件效果')
  assert.ok(texas.skill.effects.some((e) => e.condition?.type === 'withCharInRoom' && Number(e.value) === 65))
  const morgan = byBuff.get('dorm_rec_toone[000]')
  assert.equal(morgan.skill.mood, 0, '摩根 +0.3 需要推进之王在场')
  const vina = byBuff.get('trade_ord_spd&par[001]')
  assert.equal(vina.skill.percent, 30, '维娜基础 +30% 是常驻的')
})
