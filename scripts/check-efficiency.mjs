/**
 * Real-account efficiency check. Requires AK_CRED (cred,token).
 * CI without a secret skips this script.
 */
import { readFileSync } from 'node:fs'
import { loginWithPair } from '../src/api/skland.js'
import { buildBase, DEFAULT_MANUAL } from '../src/core/base.js'
import { generatePlans, SCORE_SCALE } from '../src/core/optimizer.js'

if (!process.env.AK_CRED) {
  console.log('SKIP: AK_CRED not set')
  process.exit(0)
}

const ops = JSON.parse(readFileSync(new URL('../public/data/v5/operators.json', import.meta.url), 'utf8'))
const fac = JSON.parse(readFileSync(new URL('../public/data/v5/facilities.json', import.meta.url), 'utf8'))
const combos = JSON.parse(readFileSync(new URL('../public/data/v5/combos.json', import.meta.url), 'utf8'))
const data = { meta: ops.meta, characters: ops.characters, facilities: fac, combos: combos.combos.filter((c) => c.verified !== false), allCombos: combos.combos }
const SCALE = SCORE_SCALE

let failed = 0
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' :: ' + detail : ''))
  if (!ok) failed += 1
}

const session = await loginWithPair(process.env.AK_CRED)
const base = buildBase(session, { ...DEFAULT_MANUAL, workshopLevel: 3, recycleLevel: 3, privateCount: 8, useAssistants: true }, data)
const weights = { lmd: 40, exp: 30, orundum: 20, trust: 10 }
const one = generatePlans(session, base, data, { mode: 'oneclick', operationsPerDay: 2, weights, drones: true }).candidates[0]
const manual = generatePlans(session, base, data, { mode: 'manual', operationsPerDay: 3, weights, drones: true }).candidates[0]
const lmdOnly = generatePlans(session, base, data, { mode: 'oneclick', operationsPerDay: 2, weights: { lmd: 100, exp: 0, orundum: 0, trust: 0 }, drones: true }).candidates[0]
const expOnly = generatePlans(session, base, data, { mode: 'oneclick', operationsPerDay: 2, weights: { lmd: 0, exp: 100, orundum: 0, trust: 0 }, drones: true }).candidates[0]
const jadeOnly = generatePlans(session, base, data, { mode: 'oneclick', operationsPerDay: 2, weights: { lmd: 0, exp: 0, orundum: 100, trust: 0 }, drones: true }).candidates[0]

function expectedTotal(c) {
  const totalW = weights.lmd + weights.exp + weights.orundum + weights.trust || 1
  const w = { lmd: weights.lmd / totalW, exp: weights.exp / totalW, orundum: weights.orundum / totalW, trust: weights.trust / totalW }
  const raw = (c.score.lmd / SCALE.lmd) * w.lmd + (c.score.exp / SCALE.exp) * w.exp + (c.score.orundum / SCALE.orundum) * w.orundum + (c.score.trust / SCALE.trust) * w.trust
  return raw * (c.score.moodFactor || 1) * 100
}
function validatePlan(c) {
  const owned = new Set(session.chars.map((x) => x.charId))
  for (const q of c.queues) {
    const seen = new Set()
    const all = []
    all.push(...q.assigned.CONTROL)
    q.assigned.MANUFACTURE.forEach((r) => all.push(...r.ops))
    q.assigned.TRADING.forEach((r) => all.push(...r.ops))
    q.assigned.POWER.forEach((r) => all.push(...r.ops))
    for (const k of ['MEETING', 'HIRE', 'TRAINING', 'WORKSHOP', 'RECYCLE']) all.push(...(q.assigned[k] || []))
    for (const op of all) {
      if (!owned.has(op.charId)) return 'not owned ' + op.charId
      if (seen.has(op.charId)) return 'duplicate ' + op.charId
      seen.add(op.charId)
      if (op.skill) {
        const ch = session.chars.find((x) => x.charId === op.charId)
        if (op.skill.phase > ch.elite || op.skill.level > ch.level) return 'locked skill ' + op.charId
      }
    }
    if (q.assigned.CONTROL.length !== base.controlLevel) return 'control slots'
    if (q.assigned.MANUFACTURE.length !== base.counts.MANUFACTURE) return 'mf rooms'
    if (q.assigned.TRADING.length !== base.counts.TRADING) return 'tr rooms'
    if (q.assigned.POWER.length !== base.counts.POWER) return 'power rooms'
  }
  return ''
}

console.log('base', JSON.stringify({ counts: base.counts, control: base.controlLevel, dorms: base.dorms.length, power: base.power.balance }))
console.log('oneclick', one.label, one.score.total.toFixed(1), 'lmd', Math.round(one.score.lmd), 'exp', Math.round(one.score.exp), 'jade', Math.round(one.score.orundum), 'mood', one.score.minMood.toFixed(1))
console.log('manual  ', manual.label, manual.score.total.toFixed(1), 'lmd', Math.round(manual.score.lmd), 'exp', Math.round(manual.score.exp), 'jade', Math.round(manual.score.orundum), 'mood', manual.score.minMood.toFixed(1))

check('power balance non-negative', base.power.balance >= 0, String(base.power.balance))
check('manual efficiency >= one-click', manual.score.total >= one.score.total - 0.01, manual.score.total.toFixed(2) + ' vs ' + one.score.total.toFixed(2))
check('total matches normalised formula (oneclick)', Math.abs(expectedTotal(one) - one.score.total) < 0.02, expectedTotal(one).toFixed(3) + ' vs ' + one.score.total.toFixed(3))
check('total matches normalised formula (manual)', Math.abs(expectedTotal(manual) - manual.score.total) < 0.02, expectedTotal(manual).toFixed(3) + ' vs ' + manual.score.total.toFixed(3))
check('one-click plan valid', validatePlan(one) === '', validatePlan(one))
check('manual plan valid', validatePlan(manual) === '', validatePlan(manual))
check('no burnout (manual)', manual.score.minMood >= 0, manual.score.minMood.toFixed(1))
check('LMD weights produce LMD output', lmdOnly.score.lmd > 0 && lmdOnly.score.lmd >= expOnly.score.lmd && lmdOnly.score.lmd >= jadeOnly.score.lmd, String(Math.round(lmdOnly.score.lmd)))
check('EXP weights produce EXP output', expOnly.score.exp > 0 && expOnly.score.exp >= lmdOnly.score.exp && expOnly.score.exp >= jadeOnly.score.exp, String(Math.round(expOnly.score.exp)))
check('Orundum weights produce jade output', jadeOnly.score.orundum > 0 && jadeOnly.score.orundum >= lmdOnly.score.orundum && jadeOnly.score.orundum >= expOnly.score.orundum, String(Math.round(jadeOnly.score.orundum)))
check('outputs within plausible bounds', one.score.lmd < 60000 && one.score.exp < 60000 && one.score.orundum < 2000)
check('plan uses owned operators only', validatePlan(one) === '')
check('recommendations only owned', (generatePlans(session, base, data, { mode: 'oneclick', operationsPerDay: 2, weights, drones: true }).meta.recommendations || []).every((r) => session.chars.some((c) => c.charId === r.charId)))

console.log(failed ? 'RESULT: FAIL (' + failed + ')' : 'RESULT: PASS')
process.exit(failed ? 1 : 0)
