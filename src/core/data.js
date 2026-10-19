const BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || '/'

let cache = null

export async function loadGameData() {
  if (cache) return cache
  const get = async (name) => {
    const res = await fetch(BASE + 'data/v5/' + name + '?v=20261020')
    if (!res.ok) throw new Error('加载 ' + name + ' 失败：HTTP ' + res.status)
    return res.json()
  }
  const [operators, facilities, combos] = await Promise.all([
    get('operators.json'),
    get('facilities.json'),
    get('combos.json'),
  ])
  const characters = operators.characters || {}
  const byName = new Map()
  for (const c of Object.values(characters)) byName.set(c.name, c.id)
  cache = {
    meta: operators.meta,
    characters,
    byName,
    facilities,
    combos: (combos.combos || []).filter((c) => c.verified !== false),
    allCombos: combos.combos || [],
  }
  return cache
}

export function skillsOf(char, data) {
  const entry = data.characters[char.charId]
  if (!entry) return []
  return (entry.skills || []).filter((s) => (
    Number(s.phase || 0) <= Number(char.elite || 0)
    && Number(char.level || 1) >= Number(s.level || 1)
  ))
}

/** Best unlocked skill for each room. */
export function bestSkillsByRoom(char, data) {
  const result = {}
  for (const s of skillsOf(char, data)) {
    const prev = result[s.room]
    if (!prev || Number(s.value || 0) > Number(prev.value || 0)) result[s.room] = s
  }
  return result
}

/** A conservative numeric score for allocation; conditional skills are discounted. */
export function skillValue(skill, room = skill.room) {
  if (!skill) return 0
  let value = 0
  if (room === 'TRADING') {
    if (skill.subcategory === '订单效率') value = Number(skill.percent || 0)
    else if (skill.subcategory === '订单上限') value = Number(skill.orderLimit || 0) * 2
    else if (skill.subcategory === '订单质量') value = 6
    else if (skill.subcategory === '特殊订单') value = 5
    else value = Number(skill.percent || 0)
  } else if (room === 'MANUFACTURE') {
    value = skill.subcategory === '仓库' ? 0 : Number(skill.percent || 0)
  } else if (room === 'DORMITORY') {
    value = Math.max(0, Number(skill.flat || 0))
  } else if (room === 'WORKSHOP') {
    value = Number(skill.percent || 0) || (skill.subcategory === '保底/累积' ? 10 : 0)
  } else {
    value = Number(skill.percent || 0) || Math.max(0, Number(skill.flat || 0))
  }
  if (skill.conditional) value *= 0.85
  return Math.max(0, value)
}

export function comboById(data, id) {
  return (data.allCombos || []).find((c) => c.id === id)
}
