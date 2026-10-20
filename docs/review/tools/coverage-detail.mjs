// 覆盖审计的对照工具：把「未被承载的片段 / 未落字段的标记」与当前 effects 并排打印，
// 便于人工判断到底是真丢信息还是已经被类型字段承载。
// 用法：node docs/review/tools/coverage-detail.mjs [buffIdPrefix]
import fs from 'node:fs'
import { tokenize } from '../../../scripts/lib/effects.mjs'

const bd = JSON.parse(fs.readFileSync('C:/Data/deepseek/arknights-research/raw/building_data.json', 'utf8'))
const out = JSON.parse(fs.readFileSync('C:/Data/deepseek/arknights-scheduler/public/data/v5/operators.json', 'utf8'))
const filter = process.argv[2] || ''

const byBuff = new Map()
for (const c of Object.values(out.characters)) {
  for (const s of c.skills || []) if (!byBuff.has(s.buffId)) byBuff.set(s.buffId, { skill: s, owners: [c.name] })
  for (const s of c.skills || []) if (byBuff.get(s.buffId)) byBuff.get(s.buffId).owners.push(c.name)
}

const norm = (s) => String(s).replace(/[\s，；。、（）()]/g, '')
const PREAMBLE = /^(?:进驻|当|如果|若|同时|且|则|并|该|其|每)/

const compact = (e) => {
  const parts = [e.type]
  if (e.value != null) parts.push('v=' + e.value)
  for (const k of ['per', 'perValue', 'cap', 'min', 'factionId', 'tagId', 'resourceId', 'sourceResourceId', 'product', 'profession', 'clueNo', 'level', 'subtype']) {
    if (e[k] != null) parts.push(k + '=' + e[k])
  }
  if (e.countScope) parts.push('scope=' + JSON.stringify(e.countScope))
  if (e.excludeSelf) parts.push('excludeSelf')
  if (e.excludeAssist) parts.push('excludeAssist')
  if (e.condition) parts.push('cond=' + JSON.stringify(e.condition).slice(0, 90))
  return parts.join(' ')
}

for (const [buffId, entry] of byBuff) {
  if (filter && !buffId.startsWith(filter)) continue
  const plain = tokenize(bd.buffs[buffId].description).plain
  const effects = entry.skill.effects || []
  const cov = []
  for (const e of effects) {
    cov.push(norm(e.text || ''))
    const c = e.condition || {}
    cov.push(norm(c.text || ''))
    if (Array.isArray(c.extra)) for (const x of c.extra) cov.push(norm((x && x.text) || ''))
  }
  const joined = cov.join('|')
  const gaps = String(plain).split(/[，；]/).map((s) => s.trim()).filter(Boolean)
    .filter((seg) => !joined.includes(norm(seg)) && !PREAMBLE.test(seg))
  if (!gaps.length) continue
  console.log(`\n=== ${buffId} [${[...new Set(entry.owners)].join('、')}]`)
  console.log('  原文: ' + plain)
  console.log('  未覆盖: ' + gaps.map((g) => '「' + g + '」').join(' '))
  for (const e of effects) console.log('   · ' + compact(e))
}
