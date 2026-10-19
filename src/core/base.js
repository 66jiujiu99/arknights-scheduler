export const MANUAL_KEY = 'ak_v5_manual'

export const DEFAULT_MANUAL = {
  workshopLevel: 1,
  recycleLevel: 0,
  privateCount: 0,
  privateLevels: [],
  useAssistants: true,
}

export function loadManual() {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_MANUAL }
  try {
    const raw = localStorage.getItem(MANUAL_KEY)
    return raw ? { ...DEFAULT_MANUAL, ...JSON.parse(raw) } : { ...DEFAULT_MANUAL }
  } catch {
    return { ...DEFAULT_MANUAL }
  }
}

export function saveManual(manual) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(MANUAL_KEY, JSON.stringify(manual))
  } catch {
    /* quota / private mode */
  }
}

function powerOf(data, room, level) {
  const info = data.facilities.rooms[room]
  if (!info) return 0
  const phase = (info.levels || []).find((l) => Number(l.level) === Number(level))
  return Math.abs(Number(phase?.electricity || 0))
}

export function buildBase(player, manual, data) {
  const b = player.building
  const outputs = (b.outputs || []).map((r, index) => ({
    id: 'out' + index,
    type: r.type,
    level: Number(r.level || 1),
    slotId: r.slotId,
  }))
  const counts = { MANUFACTURE: 0, TRADING: 0, POWER: 0 }
  for (const o of outputs) counts[o.type] = (counts[o.type] || 0) + 1

  const dorms = (b.dorms || []).map((d, i) => ({
    id: 'dorm' + i,
    level: Number(d.level || 1),
    comfort: Number(d.comfort || 0),
  }))
  const controlLevel = Number(b.control?.level || 1)
  const assistantCount = (data.facilities.constants.assistantUnlock || [1, 1, 3, 4, 5])
    .filter((lv) => Number(lv) <= controlLevel).length

  const base = {
    controlLevel,
    outputs,
    counts,
    dorms,
    meetingLevel: Number(b.meeting?.level || 1),
    hireLevel: Number(b.hire?.level || 1),
    trainingLevel: Number(b.training?.level || 1),
    workshopLevel: Number(manual.workshopLevel || 1),
    recycleLevel: Number(manual.recycleLevel || 0),
    privateCount: Math.min(8, Math.max(0, Number(manual.privateCount || 0))),
    privateLevels: Array.isArray(manual.privateLevels) ? manual.privateLevels.map(Number) : [],
    assistants: manual.useAssistants === false ? 0 : assistantCount,
  }

  let supply = 0
  for (const o of outputs) if (o.type === 'POWER') supply += powerOf(data, 'POWER', o.level)
  let demand = 0
  const demandDetail = {}
  for (const o of outputs) {
    if (o.type === 'POWER') continue
    const p = powerOf(data, o.type, o.level)
    demand += p
    demandDetail[o.type] = (demandDetail[o.type] || 0) + p
  }
  const dormPower = dorms.reduce((sum, d) => sum + powerOf(data, 'DORMITORY', d.level), 0)
  const meetingPower = powerOf(data, 'MEETING', base.meetingLevel)
  const hirePower = powerOf(data, 'HIRE', base.hireLevel)
  const trainingPower = powerOf(data, 'TRAINING', base.trainingLevel)
  const workshopPower = powerOf(data, 'WORKSHOP', base.workshopLevel)
  const recyclePower = powerOf(data, 'RECYCLE', base.recycleLevel)
  demand += dormPower + meetingPower + hirePower + trainingPower + workshopPower + recyclePower
  demandDetail.DORMITORY = dormPower
  demandDetail.MEETING = meetingPower
  demandDetail.HIRE = hirePower
  demandDetail.TRAINING = trainingPower
  demandDetail.WORKSHOP = workshopPower
  demandDetail.RECYCLE = recyclePower

  base.power = {
    supply,
    demand,
    balance: supply - demand,
    detail: demandDetail,
  }
  base.issues = validateBase(base, data)
  return base
}

export function validateBase(base, data) {
  const issues = []
  if (base.power.balance < 0) {
    issues.push('电力不足：缺 ' + Math.abs(base.power.balance) + '，请降级设施或减少房间')
  }
  for (const o of base.outputs) {
    if (o.level > base.controlLevel) {
      issues.push(data.facilities.rooms[o.type]?.name + ' Lv' + o.level + ' 超过控制中枢 Lv' + base.controlLevel)
    }
  }
  if (base.dorms.some((d) => d.level > base.controlLevel)) issues.push('宿舍等级超过控制中枢等级')
  if (base.meetingLevel > base.controlLevel) issues.push('会客室等级超过控制中枢等级')
  if (base.hireLevel > base.controlLevel) issues.push('办公室等级超过控制中枢等级')
  if (base.trainingLevel > base.controlLevel) issues.push('训练室等级超过控制中枢等级')
  if (base.workshopLevel > base.controlLevel) issues.push('加工站等级超过控制中枢等级')
  return issues
}

export function baseSummary(base) {
  return {
    counts: base.counts,
    control: base.controlLevel,
    dorms: base.dorms.length,
    assistants: base.assistants,
    power: base.power,
  }
}

export function manualFromBase(base) {
  return {
    workshopLevel: base.workshopLevel,
    recycleLevel: base.recycleLevel,
    privateCount: base.privateCount,
    privateLevels: base.privateLevels.slice(),
    useAssistants: base.assistants > 0,
  }
}

export function emptySteadyState(base) {
  return {
    ...base,
    stationed: {},
    mood: 24,
    drones: 250,
  }
}
