// Build v5 static base data from official Arknights game data.
// Usage: node scripts/build-base-data.mjs [--building path] [--characters path]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseBuff, effectScore, EFFECT_TYPES } from './lib/effects.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
// 沙箱/只读环境下可用 --out 指定替代输出目录（例如写入临时目录后再拷回仓库）。
const OUT = arg('--out') || join(ROOT, 'public', 'data', 'v5')
const CACHE = join(ROOT, '.cache', 'gamedata')
const BUILDING_URL = 'https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/zh_CN/gamedata/excel/building_data.json'
const CHARS_URL = 'https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/zh_CN/gamedata/excel/character_table.json'

function arg(name) {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : null
}

async function loadLocalOrFetch(file, url) {
  const explicit = arg(file === 'building_data.json' ? '--building' : '--characters')
  if (explicit) return JSON.parse(readFileSync(explicit, 'utf8'))
  const cached = join(CACHE, file)
  if (existsSync(cached)) return JSON.parse(readFileSync(cached, 'utf8'))
  const res = await fetch(url)
  if (!res.ok) throw new Error('download failed ' + file + ': ' + res.status)
  const text = await res.text()
  mkdirSync(CACHE, { recursive: true })
  writeFileSync(cached, text)
  return JSON.parse(text)
}

const PHASE = { PHASE_0: 0, PHASE_1: 1, PHASE_2: 2, PHASE_3: 3 }
const RARITY = { TIER_1: 1, TIER_2: 2, TIER_3: 3, TIER_4: 4, TIER_5: 5, TIER_6: 6 }
const PROF_CN = { CASTER: '术师', WARRIOR: '近卫', MEDIC: '医疗', PIONEER: '先锋', SNIPER: '狙击', SUPPORT: '辅助', SPECIAL: '特种', TANK: '重装', TOKEN: '召唤物', TRAP: '装置' }
const ROOM_NAMES = {
  CONTROL: '控制中枢', POWER: '发电站', MANUFACTURE: '制造站', TRADING: '贸易站',
  DORMITORY: '宿舍', WORKSHOP: '加工站', HIRE: '办公室', TRAINING: '训练室',
  RECYCLE: '回收站', MEETING: '会客室',
}

function clean(desc) {
  return String(desc).replace(/<@[^>]*>/g, '').replace(/<\/>/g, '')
}
function firstPercent(desc) {
  const found = [...String(desc).matchAll(/([+-]?\d+(?:\.\d+)?)\s*%/g)]
    .map((m) => Number(m[1]))
  return found.length ? Math.max(...found) : 0
}
function allPercents(desc) {
  return [...String(desc).matchAll(/([+-]?\d+(?:\.\d+)?)\s*%/g)].map((m) => Number(m[1]))
}
function moodOf(desc) {
  const s = String(desc)
  let m = s.match(/心情每小时(?:消耗|恢复)\s*([+-]?\d+(?:\.\d+)?)/)
  if (m) return Number(m[1])
  m = s.match(/心情每小时消耗([+-]\d+(?:\.\d+)?)/)
  return m ? Number(m[1]) : 0
}
function orderLimitOf(desc) {
  const m = String(desc).match(/订单上限\s*([+-]?\d+)/)
  return m ? Number(m[1]) : 0
}
function capacityOf(desc) {
  const m = String(desc).match(/仓库容量\s*([+-]?\d+)/)
  return m ? Number(m[1]) : 0
}
function flatsOf(desc) {
  return [...String(desc).matchAll(/([+-]\d+(?:\.\d+)?)(?![\d.]*\s*%)/g)].map((m) => Number(m[1]))
}
function subcategory(room, desc, buffCategory) {
  const s = String(desc)
  if (room === 'MANUFACTURE') {
    if (s.includes('贵金属') || s.includes('赤金')) return '贵金属'
    if (s.includes('作战记录')) return '作战记录'
    if (s.includes('源石')) return '源石'
    if (s.includes('芯片')) return '芯片'
    if (s.includes('仓库容量')) return '仓库'
    return '通用'
  }
  if (room === 'TRADING') {
    if (s.includes('订单上限')) return '订单上限'
    if (s.includes('订单质量') || s.includes('裁缝') || s.includes('手工艺品') || s.includes('鉴定')) return '订单质量'
    if (s.includes('特殊订单') || s.includes('独占订单')) return '特殊订单'
    return '订单效率'
  }
  if (room === 'POWER') return '充能'
  if (room === 'CONTROL') {
    if (s.includes('线索')) return '线索'
    if (s.includes('办公室') || s.includes('人脉')) return '办公室'
    if (s.includes('心情')) return '心情'
    if (s.includes('制造')) return '制造加成'
    if (s.includes('贸易')) return '贸易加成'
    return '全局'
  }
  if (room === 'DORMITORY') {
    if (s.includes('互换')) return '互换'
    if (s.includes('除自身') || s.includes('某个干员')) return '单体恢复'
    if (s.includes('自身')) return '自身恢复'
    return '全体恢复'
  }
  if (room === 'MEETING') return s.includes('倾向') ? '线索倾向' : '线索速度'
  if (room === 'HIRE') return s.includes('心情') ? '联络与心情' : '联络速度'
  if (room === 'TRAINING') return s.includes('专精') ? '专精速度' : '训练速度'
  if (room === 'WORKSHOP') return s.includes('累积') ? '保底/累积' : s.includes('心情') ? '心情与概率' : '副产物'
  if (room === 'RECYCLE') return '转化效率'
  return buffCategory || '通用'
}
function isConditional(desc) {
  const s = String(desc)
  return /当|若|每有|每名|每点|如果|存在|满足|心情.{0,6}以下|达到|配合|一起进驻|暖机|累积/.test(s)
}


function normalizeRoom(room) { return room || null }

const building = await loadLocalOrFetch('building_data.json', BUILDING_URL)
const charTable = await loadLocalOrFetch('character_table.json', CHARS_URL)

const buffs = building.buffs || {}
const characters = {}
let skillCount = 0
let reviewCount = 0
const reviewList = []
for (const [charId, entry] of Object.entries(building.chars || {})) {
  const info = charTable[charId] || {}
  const skills = []
  for (const group of entry.buffChar || []) {
    for (const bd of group.buffData || []) {
      const buff = buffs[bd.buffId]
      if (!buff) continue
      const room = normalizeRoom(buff.roomType)
      if (!room) continue
      const phase = PHASE[bd.cond?.phase] ?? 0
      const level = Number(bd.cond?.level || 1)
      const rawDesc = buff.description || ''
      const desc = clean(rawDesc)
      const flats = flatsOf(desc)
      const flat = flats.length ? Math.max(...flats) : 0
      const flatNegative = flats.length ? Math.min(...flats) : 0
      skills.push({
        buffId: buff.buffId,
        room,
        name: buff.buffName || buff.buffId,
        desc: rawDesc,
        text: desc,
        rawText: rawDesc,
        category: buff.buffCategory || 'FUNCTION',
        subcategory: subcategory(room, desc, buff.buffCategory),
        phase,
        level,
        percent: firstPercent(desc),
        percents: allPercents(desc),
        flats,
        flat,
        flatNegative,
        value: firstPercent(desc) || (flat > 0 ? flat : 0),
        mood: moodOf(desc),
        orderLimit: orderLimitOf(desc),
        capacity: capacityOf(desc),
        stacking: desc.includes('同种效果取最高') ? 'max' : 'stack',
        conditional: isConditional(desc),
        effects: [],
      })
      const skill = skills[skills.length - 1]
      const parsed = parseBuff(buff)
      skill.effects = parsed.effects
      skill.text = parsed.text
      skill.manualReview = parsed.manualReview
      // 旧字段兼容：由 effects 反推，保证 percent/mood/orderLimit/capacity 与结构化结果一致
      const score = effectScore(skill)
      skill.percent = Number(score.percent.toFixed(4))
      skill.mood = Number(score.mood.toFixed(4))
      skill.orderLimit = score.orderLimit
      skill.capacity = score.capacity
      skill.value = skill.percent || (skill.flat > 0 ? skill.flat : 0)
      skill.stacking = parsed.effects.some((e) => e.stacking === 'max') ? 'max' : 'stack'
      skill.conditional = parsed.effects.some((e) => e.condition) || isConditional(desc)
      if (parsed.manualReview) {
        reviewCount += 1
        reviewList.push({ charId, char: info.name || charId, buffId: buff.buffId, room, name: buff.buffName || buff.buffId, text: parsed.text, reason: parsed.manualReview })
      }
      skillCount += 1
    }
  }
  skills.sort((a, b) => a.room.localeCompare(b.room) || a.phase - b.phase)
  if (skills.length) {
    characters[charId] = {
      id: charId,
      name: info.name || charId,
      rarity: RARITY[info.rarity] || 0,
      evolveCosts: (info.phases || []).map((p) => p.evolveCost || null),
      profession: PROF_CN[info.profession] || info.profession || '',
      subProfession: info.subProfessionId || '',
      nation: info.nationId || '',
      group: info.groupId || '',
      faction: { nation: info.nationId || '', group: info.groupId || '' },
      skills,
    }
  }
}

const rooms = {}
for (const [id, room] of Object.entries(building.rooms || {})) {
  if (!ROOM_NAMES[id]) continue
  rooms[id] = {
    id,
    name: room.name || ROOM_NAMES[id],
    category: room.category,
    maxCount: room.maxCount,
    levels: (room.phases || []).map((p, index) => ({
      level: index + 1,
      slots: p.maxStationedNum,
      electricity: p.electricity,
    })),
  }
}

const constants = {}
for (const key of [
  'controlData', 'powerData', 'manufactData', 'tradingData', 'dormData', 'trainingData',
  'meetingData', 'hireData', 'privateRoomData', 'recycleData', 'recycleRoomConsts',
  'assistantUnlock', 'manufactManpowerCostByNum', 'tradingManpowerCostByNum',
  'comfortManpowerRecoverFactor', 'laborRecoverTime', 'apToLaborRatio', 'apToLaborUnlockLevel',
  'laborAssistUnlockLevel', 'manufactReduceTimeUnit', 'tradingReduceTimeUnit',
  'manufactLaborCostUnit', 'tradingLaborCostUnit', 'trainingBonusMax', 'privateFavorLevelThresholds',
  'manufactUnlockTips', 'shopUnlockTips', 'shopCounterCapacity', 'manufactInputCapacity',
]) constants[key] = building[key]

const manufactFormulas = Object.values(building.manufactFormulas || {})
const workshopFormulas = Object.values(building.workshopFormulas || {})

// Trading orders from PRTS (order values are not in building_data).
const orders = [
  { strategy: '龙门商法', type: 'O_GOLD', level: 1, gold: 2, lmd: 1000, seconds: 2 * 3600 + 24 * 60 },
  { strategy: '龙门商法', type: 'O_GOLD', level: 2, gold: 3, lmd: 1500, seconds: 3 * 3600 + 30 * 60 },
  { strategy: '龙门商法', type: 'O_GOLD', level: 3, gold: 4, lmd: 2000, seconds: 4 * 3600 + 36 * 60 },
  { strategy: '开采协力', type: 'O_DIAMOND', level: 3, shard: 2, orundum: 20, seconds: 2 * 3600 },
]

const prerequisites = {
  MEETING: ['WORKSHOP#1'],
  HIRE: ['WORKSHOP#1'],
  TRAINING: ['HIRE#1'],
  RECYCLE: ['TRAINING#1', 'CONTROL#5'],
  PRIVATE: ['MEETING#1', 'HIRE#1', 'TRAINING#1', 'RECYCLE#1'],
}

const layouts = [
  { id: '3-3-3', name: '3 制造 / 3 贸易 / 3 发电', manufacture: 3, trading: 3, power: 3, note: '满级时电力刚好 810，最稳' },
  { id: '2-4-3', name: '2 制造 / 4 贸易 / 3 发电', manufacture: 2, trading: 4, power: 3, note: '偏龙门币' },
  { id: '4-2-3', name: '4 制造 / 2 贸易 / 3 发电', manufacture: 4, trading: 2, power: 3, note: '偏经验/赤金' },
  { id: '3-4-2', name: '3 制造 / 4 贸易 / 2 发电', manufacture: 3, trading: 4, power: 2, note: '电力换产出，需降级' },
  { id: '5-1-3', name: '5 制造 / 1 贸易 / 3 发电', manufacture: 5, trading: 1, power: 3, note: '极限经验流' },
]

mkdirSync(OUT, { recursive: true })
mkdirSync(join(OUT, '..'), { recursive: true })
// —— effects 审核统计
const typeCount = {}
const targetCount = {}
const factionIds = new Set()
let effectTotal = 0
let skillsWithEffects = 0
for (const c of Object.values(characters)) {
  for (const sk of c.skills) {
    if (!Array.isArray(sk.effects)) continue
    if (sk.effects.length) skillsWithEffects += 1
    effectTotal += sk.effects.length
    for (const e of sk.effects) {
      typeCount[e.type] = (typeCount[e.type] || 0) + 1
      if (e.target) targetCount[e.target] = (targetCount[e.target] || 0) + 1
      if (e.factionId) factionIds.add(e.factionId)
    }
  }
}

writeFileSync(join(OUT, 'operators.json'), JSON.stringify({
  meta: {
    version: '2026-10-20',
    effectSchemaVersion: 2,
    source: 'Kengxxiao/ArknightsGameData zh_CN',
    characters: Object.keys(characters).length,
    skills: skillCount,
    effectTypes: EFFECT_TYPES,
    audit: {
      skillsWithEffects,
      skillsWithoutEffects: skillCount - skillsWithEffects,
      effectTotal,
      manualReview: reviewCount,
      typeCount,
      targetCount,
      factionIds: [...factionIds].sort(),
    },
  },
  characters,
}, null, 0))
writeFileSync(join(OUT, 'facilities.json'), JSON.stringify({
  meta: { version: '2026-10-16', source: 'Kengxxiao/ArknightsGameData zh_CN' },
  rooms, constants, formulas: { manufacture: manufactFormulas, workshop: workshopFormulas, orders },
  prerequisites, layouts,
}, null, 0))

// Combos: source file keeps names for hand editing; output resolves charIds.
const comboSource = JSON.parse(readFileSync(join(ROOT, 'scripts', 'combos.source.json'), 'utf8'))
const byName = new Map(Object.values(characters).map((c) => [c.name, c.id]))
const combos = []
const unresolved = []
for (const combo of comboSource.combos || []) {
  const members = (combo.members || []).map((name) => byName.get(name) || null)
  if (members.some((id) => !id)) {
    unresolved.push({ id: combo.id, missing: (combo.members || []).filter((name, i) => !members[i]) })
    continue
  }
  combos.push({ ...combo, members })
}
writeFileSync(join(OUT, 'combos.json'), JSON.stringify({
  meta: { version: '2026-10-16', source: 'hand-written combos, resolved by scripts/build-base-data.mjs', unresolved },
  combos,
}, null, 0))

console.log('operators', Object.keys(characters).length, 'skills', skillCount)
console.log('effects', effectTotal, 'skillsWithEffects', skillsWithEffects, 'manualReview', reviewCount)
if (reviewList.length) {
  console.log('--- manualReview ---')
  for (const x of reviewList) console.log('  ' + x.room + '|' + x.char + '|' + x.buffId + '|' + x.text)
}
console.log('rooms', Object.keys(rooms).length, 'formulas', manufactFormulas.length, workshopFormulas.length)
console.log('combos', combos.length, 'unresolved', unresolved.length)
console.log('output', OUT)