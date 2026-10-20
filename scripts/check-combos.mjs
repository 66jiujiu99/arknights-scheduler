// 组合数据校验：effects 里出现「依赖他人在场」的条件时，combos.json 必须有对应组合；
// 反过来，标记 appliedByEffects 的组合必须真能在 effects 里找到依据（避免留下过期条目）。
// 用法：node scripts/check-combos.mjs
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ops = JSON.parse(readFileSync(join(ROOT, 'public/data/v5/operators.json'), 'utf8'))
const comboFile = JSON.parse(readFileSync(join(ROOT, 'public/data/v5/combos.json'), 'utf8'))
const characters = ops.characters || {}
const combos = comboFile.combos || []

const PAIR_TYPES = new Set(['charInRoom', 'withCharInRoom', 'factionInRoom', 'withFactionInRoom'])
const pairKey = (facility, a, b) => facility + '|' + [a, b].sort().join('+')

const comboPairs = new Set()
const comboMembers = new Set()
for (const combo of combos) {
  const facility = combo.facility
  for (const m of combo.members || []) {
    if (!characters[m]) console.log(`  ! 组合 ${combo.id} 的成员 ${m} 不在角色表里`)
    comboMembers.add(m)
  }
  if ((combo.members || []).length === 2) comboPairs.add(pairKey(facility, combo.members[0], combo.members[1]))
}

const missing = []
const factionOnly = []
const effectPairs = new Set()
let checked = 0
for (const [charId, entry] of Object.entries(characters)) {
  for (const skill of entry.skills || []) {
    for (const effect of skill.effects || []) {
      const cond = effect.condition
      if (!cond || !PAIR_TYPES.has(cond.type)) continue
      checked += 1
      const facility = effect.room || skill.room
      if (cond.char) {
        const partnerId = Object.values(characters).find((c) => c.name === cond.char)?.id
        if (!partnerId) { console.log(`  ! ${entry.name} ${skill.buffId}: 条件干员「${cond.char}」不在角色表`); continue }
        effectPairs.add(pairKey(facility, charId, partnerId))
        if (!comboPairs.has(pairKey(facility, charId, partnerId))) {
          missing.push(`${entry.name} + ${cond.char} @${facility}（${skill.buffId}）`)
        }
      } else if (cond.factionName || cond.factionId) {
        factionOnly.push(`${entry.name} ← ${cond.factionName || cond.factionId} @${facility}（${skill.buffId}）`)
      }
    }
  }
}

const stale = combos
  .filter((c) => c.appliedByEffects && (c.members || []).length === 2)
  .filter((c) => !effectPairs.has(pairKey(c.facility, c.members[0], c.members[1])))
  .map((c) => `${c.id}（${c.members.join(' + ')}）`)

console.log('combos', combos.length, '| 手写', comboFile.meta?.handwritten ?? '?', '| 派生', comboFile.meta?.derived ?? '?')
console.log('effects 里的伙伴条件', checked, '条；其中具名干员配对', checked - factionOnly.length, '条')
console.log('阵营型条件', factionOnly.length, '条（无固定成员，不生成两人组合）')
console.log('缺少组合的配对', missing.length)
for (const m of missing) console.log('  ✗', m)
console.log('过期/无依据的派生组合', stale.length)
for (const s of stale) console.log('  ?', s)

if (missing.length || stale.length) {
  console.log('组合校验未通过')
  process.exit(1)
}
console.log('组合校验通过：所有「具名干员同房间」条件都有对应组合')
