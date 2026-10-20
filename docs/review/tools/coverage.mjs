// 数据完整性审计（只打印，不下结论）：回答「结构化有没有漏东西」这类问题。
// 用法：node docs/review/tools/coverage.mjs
//
// 四个维度：
//   1. 数字覆盖：中文原文里的每个数字，是否都被某个字段承载
//   2. 片段覆盖：按「，；」切开的每段话，是否被某条 effect 的 text 覆盖（或属于前置句）
//   3. 标记覆盖：原文里的 <$cc.*> 标记（资源/标签/阵营/材料/概念）是否落到了字段上
//   4. 字段自洽：per 缺 perValue、有「最多」却无 cap、有阈值却无 condition 等
import fs from 'node:fs'
import { tokenize } from '../../../scripts/lib/effects.mjs'

const bd = JSON.parse(fs.readFileSync('C:/Data/deepseek/arknights-research/raw/building_data.json', 'utf8'))
const out = JSON.parse(fs.readFileSync('C:/Data/deepseek/arknights-scheduler/public/data/v5/operators.json', 'utf8'))

// buffId → 结构化 effects
const byBuff = new Map()
for (const c of Object.values(out.characters)) {
  for (const s of c.skills || []) {
    if (!byBuff.has(s.buffId)) byBuff.set(s.buffId, { skill: s, owners: [] })
    byBuff.get(s.buffId).owners.push(c.name)
  }
}

const numsOf = (effects) => {
  const out = []
  for (const e of effects) {
    if (e.value != null) out.push(Math.abs(Number(e.value)))
    if (e.perValue != null) out.push(Math.abs(Number(e.perValue)))
    if (e.cap != null) out.push(Math.abs(Number(e.cap)))
    if (e.min != null) out.push(Math.abs(Number(e.min)))
    if (e.count != null) out.push(Math.abs(Number(e.count)))
    if (e.threshold != null) out.push(Math.abs(Number(e.threshold)))
    if (e.level != null) out.push(Math.abs(Number(e.level)))
    if (e.recipeMoodCostAtLeast != null) out.push(Math.abs(Number(e.recipeMoodCostAtLeast)))
    const c = e.condition || {}
    for (const k of ['threshold', 'level', 'count', 'hours']) if (c[k] != null) out.push(Math.abs(Number(c[k])))
    if (Array.isArray(c.numbers)) out.push(...c.numbers.map(Math.abs))
    if (Array.isArray(c.extra)) {
      for (const x of c.extra) {
        if (x && x.threshold != null) out.push(Math.abs(Number(x.threshold)))
        if (x && x.level != null) out.push(Math.abs(Number(x.level)))
      }
    }
    if (e.addition) for (const k of ['initial', 'step', 'final']) if (e.addition[k] != null) out.push(Math.abs(Number(e.addition[k])))
  }
  return out
}

const segsOf = (plain) => String(plain).split(/[，；]/).map((s) => s.trim()).filter(Boolean)
const norm = (s) => String(s).replace(/[\s，；。、（）()]/g, '')

const PREAMBLE = /^(?:进驻|当|如果|若|同时|且|则|并|该|其|每)/

const report = { lostNumbers: [], unaccounted: [], markers: [], fields: [] }

for (const buffId of Object.keys(bd.buffs)) {
  const entry = byBuff.get(buffId)
  if (!entry) continue
  const { skill } = entry
  const effects = skill.effects || []
  const plain = tokenize(bd.buffs[buffId].description).plain
  const descNums = [...String(plain).matchAll(/(\d+(?:\.\d+)?)/g)].map((m) => Math.abs(Number(m[1])))
  const gotNums = numsOf(effects)
  const lost = descNums.filter((n) => !gotNums.some((g) => Math.abs(g - n) < 1e-9))
  if (lost.length) report.lostNumbers.push({ buffId, owners: entry.owners.slice(0, 2), lost, plain })

  // 片段覆盖：effect.text / condition.text / condition.extra[].text 任一命中即算"被承载"
  const covTexts = []
  for (const e of effects) {
    covTexts.push(norm(e.text || ''))
    const c = e.condition || {}
    covTexts.push(norm(c.text || ''))
    if (Array.isArray(c.extra)) for (const x of c.extra) covTexts.push(norm((x && x.text) || ''))
  }
  const texts = covTexts.join('|')
  for (const seg of segsOf(plain)) {
    const n = norm(seg)
    if (!n) continue
    if (texts.includes(n)) continue
    // 片段是若干 effect text 拼接后的子串也算覆盖（长句被切开）
    if (PREAMBLE.test(seg)) continue
    report.unaccounted.push({ buffId, owners: entry.owners.slice(0, 2), seg, plain })
  }

  // 标记覆盖
  const toks = tokenize(bd.buffs[buffId].description).tokens
  const landed = JSON.stringify(effects)
  for (const t of toks) {
    if (t.nested != null) continue
    if (t.kind === 'num' || t.kind === 'kw' || t.kind === 'rem') continue
    const id = String(t.id || '')
    const hit = id && landed.includes(id)
    if (!hit) report.markers.push({ buffId, owners: entry.owners.slice(0, 2), kind: t.kind, id, text: t.text, plain })
  }

  // 字段自洽
  for (const e of effects) {
    const t = String(e.text || '')
    if (e.per && e.perValue == null && /每(?:有)?\s*\d/.test(t)) report.fields.push({ buffId, issue: 'per 缺 perValue', e: JSON.stringify(e).slice(0, 160) })
    if (/最多[^0-9]{0,6}\d/.test(t) && e.cap == null) report.fields.push({ buffId, issue: '有「最多N」但缺 cap', e: JSON.stringify(e).slice(0, 160) })
    if (/每\s*\d+\s*(?:点|瓶|层|个|名|间|条|台|格)/.test(t) && e.per == null && e.perValue == null) report.fields.push({ buffId, issue: '有「每N单位」但无 per', e: JSON.stringify(e).slice(0, 160) })
  }
}

const p = (title, arr, fmt) => {
  console.log(`\n### ${title}：${arr.length}`)
  for (const x of arr.slice(0, 60)) console.log(fmt(x))
  if (arr.length > 60) console.log(`… 其余 ${arr.length - 60} 条见输出前 60 条`)
}

p('数字未被任何字段承载', report.lostNumbers,
  (x) => `${x.buffId} [${x.owners.join('、')}] 丢 ${JSON.stringify(x.lost)} ← ${x.plain}`)
p('片段未被任何 effect.text 覆盖', report.unaccounted,
  (x) => `${x.buffId} [${x.owners.join('、')}] 「${x.seg}」`)
p('标记未落到字段', report.markers,
  (x) => `${x.buffId} [${x.owners.join('、')}] ${x.kind}:${x.id}「${x.text}」`)
p('字段自洽可疑', report.fields,
  (x) => `${x.buffId} ${x.issue} ${x.e}`)
