// 开发用：对比两次生成的 operators.json，按 buffId 汇总 effects 变化
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const REPO = 'C:/Data/deepseek/arknights-scheduler'
const base = JSON.parse(execSync('git show HEAD:public/data/v5/operators.json', { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8'))
const now = JSON.parse(readFileSync(REPO + '/public/data/v5/operators.json', 'utf8'))

const index = (db) => {
  const m = new Map()
  for (const c of Object.values(db.characters)) {
    for (const s of c.skills || []) if (!m.has(s.buffId)) m.set(s.buffId, s)
  }
  return m
}
const A = index(base)
const B = index(now)
const all = new Set([...A.keys(), ...B.keys()])
const changed = []
for (const id of all) {
  const a = A.get(id)
  const b = B.get(id)
  const ea = JSON.stringify(a?.effects ?? null)
  const eb = JSON.stringify(b?.effects ?? null)
  if (ea !== eb) changed.push({ id, room: (b || a)?.room, a: a?.effects, b: b?.effects })
}
changed.sort((x, y) => x.id.localeCompare(y.id))
const lines = [`改动 buffId 数：${changed.length} / ${all.size}`]
for (const c of changed) {
  lines.push(`\n=== ${c.id} [${c.room}]`)
  lines.push('  - 旧: ' + JSON.stringify(c.a))
  lines.push('  + 新: ' + JSON.stringify(c.b))
}
writeFileSync(REPO + '/docs/review/tools/diff-out.txt', lines.join('\n'), 'utf8')
console.log(lines.slice(0, 1).join('\n'))
console.log('明细 -> docs/review/tools/diff-out.txt')
