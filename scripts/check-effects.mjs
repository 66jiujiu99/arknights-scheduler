// scripts/check-effects.mjs
// 校验 public/data/v5/operators.json 的 v2 effects 结构是否自洽。
// 用法：node scripts/check-effects.mjs
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { EFFECT_TYPES } from './lib/effects.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ops = JSON.parse(readFileSync(join(ROOT, 'public', 'data', 'v5', 'operators.json'), 'utf8'))

const KNOWN_TYPES = new Set(EFFECT_TYPES)
const KNOWN_UNITS = new Set(['percent', 'perHour', 'orders', 'slots', 'count', 'mood', 'probability', 'points', 'flat', 'flag'])
const KNOWN_TARGETS = new Set([
  'self', 'room', 'roomMembers', 'control', 'dormitory', 'otherFacilities', 'partialFacilities',
  'allManufacture', 'allTrading', 'allDormitory', 'meeting', 'hire', 'trainingRoom', 'trainee',
  'facilityCount', 'base',
])
const KNOWN_PER = new Set([
  'factionMember', 'tagMember', 'operator', 'resourcePoint', 'powerStation', 'tradingStation',
  'dormitoryLevel', 'hireSlot', 'goldLine', 'token', 'skillClass', 'capacity', 'orderLimit',
  'droneCap', 'efficiency', 'roomLevel', 'accumulate', 'facilityCount',
])
const ROOMS = new Set(['CONTROL', 'POWER', 'MANUFACTURE', 'TRADING', 'DORMITORY', 'WORKSHOP', 'HIRE', 'TRAINING', 'RECYCLE', 'MEETING'])

const problems = []
const chars = Object.values(ops.characters || {})
let skillCount = 0
let effectCount = 0
let emptyEffects = 0
let manualReview = 0
const factionIds = new Set()
const typeCount = {}

for (const c of chars) {
  for (const s of c.skills || []) {
    skillCount += 1
    if (!Array.isArray(s.effects)) {
      problems.push({ char: c.name, skill: s.name, issue: 'effects 不是数组' })
      continue
    }
    if (!s.effects.length) emptyEffects += 1
    if (s.manualReview) manualReview += 1
    if (!ROOMS.has(s.room)) problems.push({ char: c.name, skill: s.name, issue: '未知 room: ' + s.room })
    for (const e of s.effects) {
      effectCount += 1
      typeCount[e.type] = (typeCount[e.type] || 0) + 1
      if (!KNOWN_TYPES.has(e.type)) problems.push({ char: c.name, skill: s.name, issue: '未知 type: ' + e.type })
      if (e.unit && !KNOWN_UNITS.has(e.unit)) problems.push({ char: c.name, skill: s.name, issue: '未知 unit: ' + e.unit })
      if (e.target && !KNOWN_TARGETS.has(e.target)) problems.push({ char: c.name, skill: s.name, issue: '未知 target: ' + e.target })
      if (e.per && !KNOWN_PER.has(e.per)) problems.push({ char: c.name, skill: s.name, issue: '未知 per: ' + e.per })
      if (typeof e.value !== 'number' || Number.isNaN(e.value)) problems.push({ char: c.name, skill: s.name, issue: 'value 不是数字: ' + e.value })
      if (e.factionId) factionIds.add(e.factionId)
      // 心情类必须为正（方向由 type 表达）
      if (['moodRecovery', 'moodCost', 'moodCostReduction'].includes(e.type) && Number(e.value) < 0) {
        problems.push({ char: c.name, skill: s.name, issue: '心情类 value 为负: ' + e.value })
      }
      if (e.condition && typeof e.condition !== 'object') {
        problems.push({ char: c.name, skill: s.name, issue: 'condition 不是对象' })
      }
    }
  }
}

console.log('干员数', chars.length)
console.log('技能数', skillCount)
console.log('effect 数', effectCount)
console.log('空 effects', emptyEffects)
console.log('manualReview', manualReview)
console.log('type 分布', JSON.stringify(typeCount))
console.log('factionId', [...factionIds].sort().join(','))
if (problems.length) {
  console.log('--- 问题 ' + problems.length + ' 条 ---')
  for (const p of problems.slice(0, 40)) console.log('  ' + p.char + '/' + p.skill + ': ' + p.issue)
} else {
  console.log('结构校验通过：没有未知 type/unit/target/per，value 均为数字。')
}

// 验收标准 2：陈的德才兼备
const chen = chars.find((c) => c.name === '陈')
const sk = chen?.skills?.find((s) => s.name === '德才兼备')
const e0 = sk?.effects?.[0] || {}
const ok = e0.type === 'moodRecovery' && e0.target === 'control' && e0.per === 'factionMember' && e0.factionId === 'lgd' && Number(e0.value) === 0.05
console.log('验收·陈/德才兼备:', ok ? 'PASS' : 'FAIL', JSON.stringify(e0))
console.log('验收·每条 skill 都有 effects 数组:', chars.every((c) => (c.skills || []).every((s) => Array.isArray(s.effects))) ? 'PASS' : 'FAIL')
console.log('验收·schema 版本:', ops.meta?.effectSchemaVersion)

process.exit(problems.length ? 1 : 0)
