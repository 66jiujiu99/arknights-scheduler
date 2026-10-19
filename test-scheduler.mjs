import { readFileSync } from 'node:fs'
import { DEFAULT_CONFIG, generateSchedule, normalizeConfig, seedConfigFromBuilding, validateConfig } from './src/utils/schedulerV4.js'

const skills = JSON.parse(readFileSync(new URL('./public/data/baseSkills.json', import.meta.url)))
const ctrlOps = JSON.parse(readFileSync(new URL('./public/data/ctrl_skills.json', import.meta.url)))
const ids = Object.keys(skills).slice(0, 120)
const chars = ids.map((id) => ({
  charId: id,
  id,
  name: skills[id].name,
  displayName: skills[id].name,
  rarity: skills[id].rarity || 1,
  level: 60,
  evolvePhase: 2,
}))

const building = {
  control: { level: 5 },
  manufactures: Array.from({ length: 4 }, () => ({ level: 3 })),
  tradings: Array.from({ length: 3 }, () => ({ level: 3 })),
  powers: Array.from({ length: 2 }, () => ({ level: 3 })),
  dormitories: Array.from({ length: 4 }, () => ({ level: 5 })),
  meeting: { level: 3 },
  hire: { level: 3 },
  training: { level: 3 },
}
const config = seedConfigFromBuilding(building)
console.log('config issues:', validateConfig(config))
console.log('grid:', config.grid.join(','), 'controlLevel:', config.controlLevel, 'dorms:', config.dorms)
const result = generateSchedule(
  { chars },
  skills,
  ctrlOps,
  config,
  ['赤金', '作战记录', '源石碎片', '通用'],
  ['龙门商法', '开采商法', '龙门商法'],
)
console.log('shifts:', result.schedules.length, 'totalEff:', result.totalEfficiency.toFixed(1), 'mood:', result.totalMoodCost.toFixed(2))
for (const shift of result.schedules) {
  const seen = new Set()
  let duplicates = 0
  let assigned = 0
  for (const station of shift.stations) {
    for (const op of station.ops) {
      if (op.charId.startsWith('empty_')) continue
      assigned += 1
      if (seen.has(op.charId)) duplicates += 1
      seen.add(op.charId)
    }
  }
  console.log(shift.label, 'stations:', shift.stations.length, 'assigned:', assigned, 'unique:', seen.size, 'duplicates:', duplicates, 'ctrlBonus:', shift.controlBonus)
  if (duplicates > 0) process.exitCode = 1
}
const defaultResult = generateSchedule({ chars }, skills, ctrlOps, normalizeConfig(DEFAULT_CONFIG), [], [])
console.log('default config totalEff:', defaultResult.totalEfficiency.toFixed(1))
