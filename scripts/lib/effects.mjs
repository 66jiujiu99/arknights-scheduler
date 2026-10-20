// scripts/lib/effects.mjs
// v2 effects 解析器：把 building_data.json 的 buff 描述解析成程序可直接读取的结构化数据。
import { EFFECT_OVERRIDES } from './effect-overrides.mjs'
//
// 输入：building_data.json 的 buff 对象（buffId / buffName / roomType / description / targets）
// 输出：effects 数组 + manualReview
//
// effect 字段（缺省表示该维度不限制）：
//   type        见 EFFECT_TYPES
//   room        生效设施 MANUFACTURE/TRADING/POWER/CONTROL/DORMITORY/MEETING/HIRE/TRAINING/WORKSHOP/RECYCLE
//   target      self|room|roomMembers|control|dormitory|otherFacilities|partialFacilities|
//               allManufacture|allTrading|allDormitory|meeting|hire|trainingRoom|trainee|facilityCount
//   value       数值（心情类为正数；moodCost/moodCostReduction 取绝对值）
//   unit        percent|perHour|orders|slots|count|mood|probability|points|flat
//   product     产物筛选 贵金属|作战记录|源石|技巧概要|精英材料|基建材料|芯片|...
//   per         叠加单位 factionMember|tagMember|operator|resourcePoint|powerStation|tradingStation|
//               dormitoryLevel|hireSlot|goldLine|token|skillClass|capacity|orderLimit|droneCap|efficiency|roomLevel
//   perValue    "每 N" 的 N，缺省 1
//   factionId / tagId / profession / resourceName   触发主体筛选
//   cap         叠加上限
//   condition   { type, text, threshold?, char?, room?, branch?, level?, hours? }
//   stacking    stack|max|maxPerTarget|unique|special
//   addition    { initial, step, final } 暖机类技能
//   source      buffId
//   text        原始中文片段，便于人工核对

const MARK = ''

export const ROOM_CN = {
  CONTROL: '控制中枢', POWER: '发电站', MANUFACTURE: '制造站', TRADING: '贸易站',
  DORMITORY: '宿舍', WORKSHOP: '加工站', HIRE: '办公室', TRAINING: '训练室',
  RECYCLE: '回收站', MEETING: '会客室',
}

const ROOM_ALIASES = {
  '制造站': 'MANUFACTURE', '贸易站': 'TRADING', '发电站': 'POWER', '控制中枢': 'CONTROL',
  '宿舍': 'DORMITORY', '加工站': 'WORKSHOP', '人力办公室': 'HIRE', '办公室': 'HIRE',
  '训练室': 'TRAINING', '回收站': 'RECYCLE', '会客室': 'MEETING', '活动室': 'PRIVATE',
}

// building_data 的 buff.targets 是官方的产物/配方筛选，比中文描述更权威。
const PRODUCT_BY_FORMULA = {
  F_GOLD: '贵金属', F_EXP: '作战记录', F_DIAMOND: '源石',
  F_BUILDING: '基建材料', F_EVOLVE: '精英材料', F_SKILL: '技巧概要', F_ASC: '芯片',
}

// "每 N" 后面可能出现的量词，用来定位 perValue
const PER_UNIT_CHARS = '点个名间条台架瓶格层只次笔小节%座位'

// 指标词表。findMetric 取位置最靠前的匹配。
const METRICS = [
  { re: /无人机充能速度|充能速度/, type: 'droneCharge', room: 'POWER', unit: 'percent' },
  { re: /材料转化效率/, type: 'recycleEfficiency', room: 'RECYCLE', unit: 'percent' },
  { re: /副产品的产出概率|副产品产出概率/, type: 'workshopByproduct', room: 'WORKSHOP', unit: 'percent' },
  { re: /专精技能训练速度|技能训练速度|训练速度/, type: 'trainingSpeed', room: 'TRAINING', unit: 'percent' },
  { re: /线索搜集速度/, type: 'clueSpeed', room: 'MEETING', unit: 'percent' },
  // “每个招募位+10点记忆碎片”：仅在 HIRE 房间让资源增益优先于联络速度。
  { re: /招募位[^，；]*\d+\s*点\s*(?:记忆碎片|感知信息|人间烟火|无声共鸣|情报储备|思维链环|木天蓼|热情值)/, type: 'specialResource', room: 'HIRE', unit: 'points' },
  { re: /人脉资源的联络速度|联络速度/, type: 'hireSpeed', room: 'HIRE', unit: 'percent' },
  { re: /订单上限|使订单上限/, type: 'orderLimit', room: 'TRADING', unit: 'orders' },
  { re: /使订单上限|订单上限/, type: 'orderLimit', room: 'TRADING', unit: 'orders' },
  { re: /订单获取效率|订单效率/, type: 'orderEfficiency', room: 'TRADING', unit: 'percent' },
  { re: /高品质订单|高品质贵金属订单|订单质量/, type: 'orderQuality', room: 'TRADING', unit: 'percent' },
  { re: /龙门币收益/, type: 'orderValue', room: 'TRADING', unit: 'flat' },
  { re: /固定获取|特别订单|独占订单/, type: 'fixedOrder', room: 'TRADING', unit: 'flag' },
  { re: /使订单上限|订单上限-/, type: 'orderLimit', room: 'TRADING', unit: 'orders' },
  { re: /仓库容量上限|仓库上限容量|仓库容量/, type: 'capacity', room: 'MANUFACTURE', unit: 'slots' },
  { re: /消除[^，；]*心情消耗|消除自身心情消耗/, type: 'moodCostReset', unit: 'flag' },
  { re: /无法获得[^，；]*心情恢复/, type: 'moodRecoveryBlock', unit: 'flag' },
  { re: /互换心情/, type: 'moodExchange', unit: 'flag' },
  { re: /心情每小时恢复|每小时恢复|心情恢复速度|心情恢复/, type: 'moodRecovery', unit: 'perHour' },
  { re: /心情每小时消耗|每小时消耗|心情消耗/, type: 'moodCost', unit: 'perHour' },
  { re: /生产力/, type: 'productivity', room: 'MANUFACTURE', unit: 'percent' },
  { re: /获取效率/, type: 'orderEfficiency', room: 'TRADING', unit: 'percent' },
  { re: /赤金交付数/, type: 'orderValue', room: 'TRADING', unit: 'orders' },
  { re: /(?:提供|额外)\s*\d+\s*条?赤金生产线|赤金生产线\s*[+-]\s*\d/, type: 'goldLine', room: 'TRADING', unit: 'count' },
  { re: /视为违约订单/, type: 'fixedOrder', room: 'TRADING', unit: 'flag' },
  { re: /下次训练所需时间/, type: 'trainingSpeed', room: 'TRAINING', unit: 'percent' },
  { re: /出现概率|产出概率/, type: 'clueBias', room: 'MEETING', unit: 'probability' },
  { re: /恢复自身一次心情/, type: 'moodRecovery', unit: 'flat' },
  { re: /心情恢复效果|恢复效果/, type: 'moodRecovery', unit: 'perHour' },
  { re: /每小时心情消耗|心情消耗/, type: 'moodCost', unit: 'perHour' },
]

// 加工站的心情消耗按配方结算，不是每小时消耗。
// 注意：“加工原始心情消耗为8的任意类材料时，副产品概率提升50%”里，
// “心情消耗为8”只是筛选条件，不是心情消耗效果，故要求后面有“全部/恒定”等减免词。
const WORKSHOP_METRICS = [
  { re: /副产品的产出概率|副产品产出概率/, type: 'workshopByproduct', room: 'WORKSHOP', unit: 'percent' },
  { re: /心情消耗(?:为\s*\d+\s*(?:以上)?的?[^，；]{0,10}(?:全部|恒定)|恒定为)/, type: 'workshopMoodCost', room: 'WORKSHOP', unit: 'mood' },
  // 「全部心情消耗-1」这类没有“恒定为”字样，但仍是按次加工的心情点数。
  // 必须排除「心情消耗为N的配方」——那是筛选阈值，不是消耗效果。
  { re: /心情消耗(?!\s*为)/, type: 'workshopMoodCost', room: 'WORKSHOP', unit: 'mood' },
]

// 特殊资源（$cc.bd_*）——不进入常规产能计算，但结构化出来供后续接入。
const BD_NAMES = {
  bd_b1: '人间烟火', bd_a1: '感知信息', bd_a1_a1: '记忆碎片', bd_a1_a2: '梦境',
  bd_a1_a3: '小节', bd_B: '无声共鸣', bd_C: '巫术结晶', bd_A: '思维链环',
  bd_malist: '工程机器人', bd_mujica: '热情值', bd_ash: '情报储备', bd_felyne: '木天蓼',
  bd_tachanka: '乌萨斯特饮', bd_dungeon: '魔物料理', bd_wang_1: '外势', bd_wang_2: '实地',
  // 原始标记里唯一带点号的一个（<$cc.bd.costdrop>），按标记原文保留
  'bd.costdrop': '心情落差',
}

export const EFFECT_TYPES = [
  'productivity', 'orderEfficiency', 'orderLimit', 'capacity',
  'moodRecovery', 'moodCost', 'moodCostReduction', 'moodCostReset', 'moodRecoveryBlock', 'moodExchange',
  'droneCharge', 'clueSpeed', 'clueBias', 'hireSpeed', 'trainingSpeed', 'trainingTimeReduction',
  'workshopByproduct', 'workshopMoodCost', 'workshopLmdFree', 'workshopByproductGuarantee',
  'recycleEfficiency', 'facilityCount', 'specialResource', 'specialBonus',
  'orderQuality', 'fixedOrder', 'orderValue', 'goldLine', 'skillClassConvert',
  'resetOthers', 'unknown',
]

// ---------------------------------------------------------------- 分词器

function classify(inner, text) {
  if (inner === '@cc.vup') return { kind: 'num', sign: 'up', text }
  if (inner === '@cc.vdown') return { kind: 'num', sign: 'down', text }
  if (inner === '@cc.kw') return { kind: 'kw', text }
  if (inner === '@cc.rem') return { kind: 'rem', text }
  if (inner.startsWith('$cc.g.')) return { kind: 'faction', id: inner.slice(6), text }
  if (inner.startsWith('$cc.tag.')) return { kind: 'tag', id: inner.slice(8), text }
  if (inner.startsWith('$cc.bd')) return { kind: 'bd', id: inner.slice(4), text }
  if (inner.startsWith('$cc.c.')) return { kind: 'concept', id: inner.slice(6), text }
  if (inner.startsWith('$cc.sk.')) return { kind: 'skillClass', id: inner.slice(6), text }
  if (inner === '$cc.gvial') return { kind: 'char', text }
  if (inner.startsWith('$cc.')) return { kind: 'misc', id: inner.slice(4), text }
  return { kind: 'misc', text }
}

/** 把带 <@cc.*> 标记的原始描述拆成 { plain, marked, tokens }。 */
export function tokenize(desc) {
  const tokens = []
  let plain = ''
  let marked = ''
  const stack = []
  const raw = String(desc || '')

  const closeTag = () => {
    const t = stack.pop()
    if (!t) return
    const text = plain.slice(t.pStart)
    const tok = classify(t.inner, text)
    tok.at = t.pStart
    tokens.push(tok)
    const idx = tokens.length - 1
    marked = marked.slice(0, t.mStart) + MARK + idx + MARK
    for (const x of tokens) {
      if (x !== tok && x.at > t.pStart && x.nested == null) x.nested = idx
    }
  }

  let i = 0
  while (i < raw.length) {
    const lt = raw.indexOf('<', i)
    if (lt < 0) { plain += raw.slice(i); marked += raw.slice(i); break }
    plain += raw.slice(i, lt); marked += raw.slice(i, lt)
    if (raw.startsWith('</>', lt)) { i = lt + 3; closeTag(); continue }
    const gt = raw.indexOf('>', lt)
    if (gt < 0) { plain += raw.slice(lt); marked += raw.slice(lt); break }
    stack.push({ inner: raw.slice(lt + 1, gt), pStart: plain.length, mStart: marked.length })
    i = gt + 1
  }
  while (stack.length) closeTag()
  return { plain, marked, tokens }
}

function stripMarkers(s) {
  return String(s || '')
    .replace(new RegExp(MARK + '\\d+' + MARK, 'g'), '')
    .replace(/<\$?[^>]*>/g, '')
    .replace(/<[^>]*>/g, '')
}

function parseNumToken(tok) {
  const m = String(tok.text).match(/([+-]?\d+(?:\.\d+)?)/)
  return { value: m ? Number(m[1]) : 0, percent: String(tok.text).includes('%') }
}

/** kw token 里的数字（如 +250）也要参与数值识别。 */
function isNumericToken(t) {
  return t.kind === 'num' || (t.kind === 'kw' && /^[+-]?\d/.test(String(t.text).trim()))
}

// 暖机类表述“首小时+X%，此后每小时+Y%，最终达到+Z%”中间的逗号不能切，
// 否则会被拆成三段而丢失递进关系。
const WARMUP_RE = /(?:[^，；]*?\d+(?:\.\d+)?%[，；])?[^，；]*?此后每小时[^，；]*?\d+(?:\.\d+)?%[，；][^，；]*?最终达到[^，；]*?\d+(?:\.\d+)?%/

function mergeWarmup(plain) {
  return plain.replace(WARMUP_RE, (m) => m.replace(/[，；]/g, '、'))
}

/** 按 ，/；切分，括号内的逗号不切。 */
function splitSegments(plain) {
  return splitRaw(mergeWarmup(plain))
}

function splitRaw(plain) {
  const out = []
  let depth = 0
  let start = 0
  for (let i = 0; i < plain.length; i += 1) {
    const ch = plain[i]
    if (ch === '（' || ch === '(') depth += 1
    else if (ch === '）' || ch === ')') depth = Math.max(0, depth - 1)
    else if (depth === 0 && (ch === '，' || ch === '；' || ch === ',')) {
      out.push({ text: plain.slice(start, i), start })
      start = i + 1
    }
  }
  out.push({ text: plain.slice(start), start })
  return out.filter((s) => s.text.trim())
}

// “进驻X时 / 当与X一起进驻X时”这类前置从句不含效果信息，跳过即可。
const PREAMBLE_RE = /^进驻[^，；]*?(?:时|位时)?(?:，|；|$)|^当与[^，；]*?(?:时|，)/

function isPreamble(text) {
  return PREAMBLE_RE.test(text.trim()) && !findMetricForPreamble(text)
}

// 后继效果句的引子词：「则…」「且…」「额外…」「同时…」
const CONTINUATION_HEAD_RE = /^(?:则|且|并|同时|该|其|额外|进一步)(?:额外)?/

/**
 * 「A；如果 C，则 B」里的 C 只限定 B，不能回溯挂到已经生成的 A 上。
 * 判断依据：C 是纯条件从句（无指标词），且它后面还跟着一条效果句。
 */
function hasEffectAfter(segments, si, roomType) {
  for (let i = si + 1; i < segments.length; i += 1) {
    const next = segments[i]
    if (isPreamble(next.text)) continue
    if (findMetric(next.text, roomType)) return true
    // 「当自身心情处于12以下时，感知信息+10」：特殊资源增益没有指标词，
    // 但它同样是一条效果句，否则条件会被回溯挂到上一条效果上。
    if (/<\$cc\.bd[^>]*>|人间烟火|感知信息|思维链环|无声共鸣|情报储备|木天蓼|热情值|乌萨斯特饮|魔物料理|巫术结晶|记忆碎片|梦境|小节|工程机器人|外势|实地/.test(next.text)) return true
    // 「当与X一起工作时，更容易获得线索」：后半句是 clueBias 效果，也算后继效果
    if (CLUE_BIAS_RE.test(next.text)) return true
    return CONTINUATION_HEAD_RE.test(next.text.trim()) || /额外/.test(next.text)
  }
  return false
}

// 前置从句里如果出现指标词，说明它不是纯前置（例如“进驻加工站加工技巧概要时”）
function findMetricForPreamble(text) {
  return /生产力|效率|上限|速度|概率|心情|容量/.test(text)
}

function findMetric(plain, roomType) {
  // “每10%订单获取效率使订单上限-1”：真正被作用的是订单上限，
  // 但“订单获取效率”位置更靠前，这里强制纠正。
  if (/使订单上限/.test(plain)) {
    return { re: /使订单上限/, type: 'orderLimit', room: 'TRADING', unit: 'orders', index: plain.search(/使订单上限/), name: '使订单上限', end: plain.search(/使订单上限/) + 5 }
  }

  const table = roomType === 'WORKSHOP' ? [...WORKSHOP_METRICS, ...METRICS] : METRICS
  let best = null
  for (const m of table) {
    const hit = plain.match(m.re)
    if (!hit) continue
    if (!best || hit.index < best.index || (hit.index === best.index && hit[0].length > best.name.length)) {
      best = { ...m, index: hit.index, name: hit[0] }
    }
  }
  if (best) best.end = best.index + best.name.length
  return best
}

// ---------------------------------------------------------------- 维度识别

/** 取段落内的 token，并把坐标转成段内相对位置（rel）。 */
function tokensIn(tokens, seg) {
  return tokens
    .filter((t) => !t.nested && t.at >= seg.start && t.at < seg.start + seg.text.length)
    .map((t) => ({ ...t, rel: t.at - seg.start }))
}

const TARGET_RULES = [
  // 「每个存在3名谢拉格干员的贸易站，订单获取效率+10%」：作用范围是"满足条件的那些站"
  [/每个存在\s*\d+\s*名[^，；]*贸易站/, 'allTrading', {}],
  [/每个存在\s*\d+\s*名[^，；]*制造站/, 'allManufacture', {}],
  [/每个存在\s*\d+\s*名[^，；]*会客室/, 'meeting', {}],
  // “每个进驻在制造站的骑士干员…” → 作用于全体验制造站，不是控制中枢自身房间
  [/每个进驻在制造站|进驻在制造站/, 'allManufacture', {}],
  [/每个进驻在贸易站|进驻在贸易站/, 'allTrading', {}],
  [/每个进驻在会客室|进驻在会客室/, 'meeting', {}],
  [/进驻在宿舍和活动室以外的设施|活动室以外的设施/, 'otherFacilities', {}],
  [/每个进驻在宿舍|进驻在宿舍/, 'allDormitory', {}],
  [/会客室内干员|会客室/, 'meeting', {}],
  [/控制中枢内除自身以外|中枢内除自身/, 'control', { excludeSelf: true }],
  [/控制中枢内所有干员|控制中枢内所有|中枢内所有干员/, 'control', {}],
  [/其他设施内处于工作状态的干员|其他设施/, 'otherFacilities', {}],
  [/部分设施内处于工作状态的干员|部分设施/, 'partialFacilities', {}],
  [/所有宿舍内所有干员|所有宿舍内|所有宿舍/, 'allDormitory', {}],
  [/全体干员|贸易站内全体干员/, 'roomMembers', {}],
  [/该宿舍内除自身以外|宿舍内除自身以外|除自身以外心情未满的某个干员|宿舍内除自身|除自身以外所有干员/, 'dormitory', { excludeSelf: true }],
  [/该宿舍内所有干员|宿舍内所有干员|该宿舍内心情|宿舍成员|该宿舍中|该宿舍内|宿舍内/, 'dormitory', {}],
  [/消除当前制造站内所有干员|当前制造站内所有干员/, 'roomMembers', {}],
  [/自身心情|自身和|自身为|自身累积/, 'self', {}],
  [/所有制造站|所有生产/, 'allManufacture', {}],
  [/所有贸易站/, 'allTrading', {}],

  [/人力办公室|办公室/, 'hire', {}],
  [/当前贸易站内|贸易站内除自身以外|贸易站内/, 'room', {}],
  [/当前制造站内所有干员|当前制造站内|当前制造站/, 'room', {}],
  [/所在贸易站|所在的制造站/, 'room', {}],
  [/训练室/, 'trainingRoom', {}],
  [/当前干员|该名干员|训练位干员/, 'trainee', {}],
]

function detectTarget(text) {
  for (const [re, target, extra] of TARGET_RULES) {
    if (re.test(text)) return { target, ...extra }
  }
  return { target: 'room' }
}

const PER_RULES = [
  [/每个招募位|招募位（不包含初始招募位）/, { per: 'hireSlot' }],
  [/每间宿舍每级|宿舍每级|每级|每间设施每级/, { per: 'roomLevel' }],
  [/每有\d*间发电站|每\d*间发电站|间发电站|每(?:个|座)发电站/, { per: 'powerStation' }],
  [/每个贸易站|每\d*个?贸易站/, { per: 'tradingStation' }],
  [/赤金生产线/, { per: 'goldLine' }],
  [/作业平台/, { per: 'token' }],
  [/标准化类技能|莱茵科技类技能|红松骑士团类技能|类技能/, { per: 'skillClass' }],
  [/每格仓库容量|提升的仓库容量/, { per: 'capacity' }],
  [/订单上限/, { per: 'orderLimit' }],
  [/无人机上限/, { per: 'droneCap' }],
  [/宿舍内每有\d+名干员|每有\d+名干员/, { per: 'operator' }],
]

// “每小时”里的“每”不是叠加单位，需要排除。
const PER_NOT_STACKING = /每小时|每级为恢复|每\d*次加工/

function detectPer(text, segTokens) {
  let perIdx = -1
  const re = /每/g
  let m
  while ((m = re.exec(text))) {
    const rest = text.slice(m.index + 1)
    if (/^小时/.test(rest)) continue
    if (/^\d*次加工/.test(rest)) continue
    perIdx = m.index
    break
  }
  if (perIdx < 0) return null
  if (!/每\s*\d|每个|每名|每有|每间|每条|每点|每格|每架|每瓶|每产生|每级|每座|每台|每位/.test(text.slice(perIdx))) {
    const bd = segTokens.find((t) => t.kind === 'bd')
    const faction = segTokens.find((t) => t.kind === 'faction')
    const tag = segTokens.find((t) => t.kind === 'tag')
    if (!bd && !faction && !tag) return null
  }
  const bd = segTokens.find((t) => t.kind === 'bd')
  const faction = segTokens.find((t) => t.kind === 'faction')
  const tag = segTokens.find((t) => t.kind === 'tag')

  let per = null
  // 「每间设施每级」是按设施等级计数，句中出现的产物名不是计数单位
  if (/每间设施每级|宿舍每级|每级/.test(text)) per = 'roomLevel'
  // 「每个招募位」是设施槽位计数，即使句中出现特殊资源也不该退化成 resourcePoint
  else if (/招募位/.test(text)) per = 'hireSlot'
  else if (bd) per = 'resourcePoint'
  else if (faction) per = 'factionMember'
  else if (tag) per = 'tagMember'
  else {
    for (const [re, rule] of PER_RULES) {
      if (re.test(text)) { per = rule.per; break }
    }
  }
  if (!per) {
    if (/干员/.test(text)) per = 'operator'
    else if (/生产力|订单获取效率|效率/.test(text)) per = 'efficiency'
    else per = 'operator'
  }

  let perValue = null
  for (const t of segTokens) {
    if (t.kind !== 'num') continue
    const rel = t.rel != null ? t.rel : t.at
    // 数字必须出现在"每"之后（"每个存在3名…" 里 3 在 每 之后）
    if (rel < perIdx) continue
    const rest = text.slice(rel + String(t.text).length)
    // 数字后面紧跟量词（“20点”“16个”“1名”），且这个“每”不在“每小时”里
    if (!PER_UNIT_CHARS.includes(rest[0] || '')) continue
    if (/^小时/.test(rest)) continue
    // "每个X干员可使…恢复+0.05"：0.05 是效果值不是计数。
    // 计数应紧跟在"每"之后（窗口 3 字符内），且量词后应是"干员/设施/点"等可数名词
    const gap = rel - perIdx
    const afterUnit = rest.slice(1, 4)
    const isCountWord = /干员|设施|名|个|点|条|间|格|架|瓶|台|笔|次/.test(afterUnit)
    if (gap > 3 && !isCountWord) continue
    perValue = parseNumToken(t).value
    break
  }

  const out = {
    per,
    factionId: faction ? faction.id : null,
    factionName: faction ? faction.text : null,
    tagId: tag ? tag.id : null,
    tagName: tag ? tag.text : null,
    resourceId: bd ? bd.id : null,
    resourceName: bd ? bd.text || BD_NAMES[bd.id] || null : null,
  }
  if (perValue != null) out.perValue = perValue
  return out
}

const CONDITION_RULES = [
  [/心情消耗为\s*(\d+)\s*(?:以上)?/, (m) => ({ type: 'recipeMoodCost', threshold: Number(m[1]) })],
  [/当自身心情大于\s*(\d+)/, (m) => ({ type: 'selfMoodAbove', threshold: Number(m[1]) })],
  [/自身心情大于\s*(\d+)/, (m) => ({ type: 'selfMoodAbove', threshold: Number(m[1]) })],
  [/当自身心情处于\s*(\d+)\s*以下|心情处于\s*(\d+)\s*以下/, (m) => ({ type: 'selfMoodBelow', threshold: Number(m[1] || m[2]) })],
  [/心情处于\s*(\d+)\s*点及以上|达到\s*(\d+)\s*点及以上/, (m) => ({ type: 'selfMoodAtLeast', threshold: Number(m[1] || m[2]) })],
  [/心情落差大于\s*(\d+)/, (m) => ({ type: 'moodGapAbove', threshold: Number(m[1]) })],
  [/联络速度小于\s*(\d+)\s*%/, (m) => ({ type: 'hireSpeedBelow', threshold: Number(m[1]) })],
  [/小于\s*(\d+)\s*%/, (m) => ({ type: 'below', threshold: Number(m[1]) })],
  [/处于\s*(\d+)\s*点及以上/, (m) => ({ type: 'resourceAtLeast', threshold: Number(m[1]) })],
  [/单次工作时长达到\s*(\d+)\s*小时/, (m) => ({ type: 'shiftHoursAtLeast', hours: Number(m[1]) })],
  [/训练专精技能至\s*(\d+)\s*级/, (m) => ({ type: 'trainToLevel', level: Number(m[1]) })],
  [/如果训练位干员分支为\s*([^，；]+?)\s*，?则/, (m) => ({ type: 'traineeBranch', branch: m[1] })],
  [/如训练室有干员在进行技能专精|训练室有干员在进行技能专精/, () => ({ type: 'trainingInProgress' })],
  [/若(外势|实地)大于等于(外势|实地)/, (m) => ({ type: 'resourceCompare', left: m[1], right: m[2], op: 'gte' })],
  [/若(外势|实地)大于(外势|实地)/, (m) => ({ type: 'resourceCompare', left: m[1], right: m[2], op: 'gt' })],
  [/只有自身处于工作状态|会客室内只有自身/, () => ({ type: 'aloneInRoom' })],
  // 「如会客室没有另一干员则不提升」：需要会客室内除自身外还有人
  [/没有另一干员则不提升/, () => ({ type: 'needsOtherOperatorInRoom' })],
  [/处于线索交流时|线索交流时/, () => ({ type: 'clueExchange' })],
  [/如果自身为满心情|自身为满心情/, () => ({ type: 'selfMoodFull' })],
  [/心情未满/, () => ({ type: 'targetMoodNotFull' })],
  [/其他发电站内没有进驻/, () => ({ type: 'noTokenInOtherPower' })],
  [/每差\s*(\d+)\s*笔|差\s*(\d+)\s*笔/, (m) => ({ type: 'orderGap', threshold: Number(m[1] || m[2]) })],
  [/提升\s*(\d+)\s*格以下/, (m) => ({ type: 'capacityBelow', threshold: Number(m[1]) })],
  [/提升大于\s*(\d+)\s*格/, (m) => ({ type: 'capacityAbove', threshold: Number(m[1]) })],
  [/下笔赤金订单交付数大于\s*(\d+)/, (m) => ({ type: 'nextOrderAbove', threshold: Number(m[1]) })],
  [/下笔赤金订单交付数小于\s*(\d+)/, (m) => ({ type: 'nextOrderBelow', threshold: Number(m[1]) })],
  [/下笔赤金订单是违约订单/, () => ({ type: 'nextOrderDefault' })],
  [/当与(.+?)一起进驻(.+?)时|当与(.+?)进驻(.+?)一起工作时/, (m) => ({ type: 'withCharInRoom', char: m[1] || m[3], room: ROOM_ALIASES[(m[2] || m[4] || '').trim()] || null })],
  [/与其他(.+?)干员进驻(.+?)一起工作/, (m) => ({ type: 'withCharInRoom', char: m[1], room: ROOM_ALIASES[(m[2] || '').trim()] || null })],
  [/当(.+?)入驻(.+?)时/, (m) => ({ type: 'charInRoom', char: m[1], room: ROOM_ALIASES[(m[2] || '').trim()] || null })],
  // 「如果有2台以上作业平台进驻在发电站」讲的是数量/TAG，不是某个具名干员，别被下面这条抢走
  [/如果(?!\d+台以上)(.+?)进驻在(.+?)(?:[，）]|$)|如果(.+?)进驻(.+?)时/, (m) => ({ type: 'charInRoom', char: m[1] || m[3], room: ROOM_ALIASES[(m[2] || m[4] || '').trim()] || null })],
  [/如果目标是(.+?)，则|如果目标是(.+?)$/, (m) => ({ type: 'targetIs', text: m[1] || m[2] })],
  [/若(.+?)大于等于(.+?)，|若(.+?)大于(.+?)，/, (m) => ({ type: 'resourceCompare', left: m[1] || m[3], right: m[2] || m[4] })],
  [/每产生\d+次联络次数/, () => ({ type: 'onContact' })],
  [/每\d+次加工没有产出副产品/, () => ({ type: 'afterNoByproduct' })],
  [/心情\d+以下的干员/, () => ({ type: 'dormLowMoodCount' })],
  [/完整协助完成\d+次专精训练|协助一名干员训练时长达\d+小时/, () => ({ type: 'assistSession' })],
  [/如果有\d+台以上/, () => ({ type: 'tokenCountAtLeast' })],
]

// “每小时”“时”这类是时间单位或从句助词，不是条件触发词。
const CONDITION_TRIGGERS = /如果|若|当与|当自身|当.{1,12}时|只有|反之|达到.{0,4}小时|处于.{0,8}以下|.{0,6}以上时|小于|大于|满心情|心情未满|心情消耗为|线索交流时|没有进驻|下笔|每产生|次加工没有|分支为|专精技能至|进驻在|入驻|一起工作|大于等于|必定|连续消耗/

// 从句里出现的数字（阈值/分母），保存下来避免解析时丢失。
const CLAUSE_NUM_PATTERNS = [
  /每(?:有)?\s*(\d+(?:\.\d+)?)/,
  /心情\s*(\d+)\s*以下/,
  /心情\s*(\d+)\s*以上/,
  /心情\s*(\d+)/,
  /达到\s*(\d+)\s*小时/,
  /时长达\s*(\d+)\s*小时/,
  /超过\s*(\d+)/,
  /大于\s*(\d+)/,
  /小于\s*(\d+)/,
  /(\d+)\s*格/,
  /(\d+)\s*名/,
  /(\d+)\s*间/,
  /(\d+)\s*次/,
  /(\d+)\s*级/,
  /(\d+)\s*台/,
  /(\d+)\s*架/,
]

function clauseNumbers(text) {
  const out = []
  for (const re of CLAUSE_NUM_PATTERNS) {
    const m = String(text).match(re)
    if (m) out.push(Number(m[1]))
  }
  return [...new Set(out)]
}

function detectCondition(text) {
  if (!CONDITION_TRIGGERS.test(text)) return null
  for (const [re, fn] of CONDITION_RULES) {
    const m = text.match(re)
    if (m) {
      const c = fn(m) || {}
      c.text = stripMarkers(text).trim()
      c.numbers = clauseNumbers(text)
      return c
    }
  }
  return { type: 'other', text: stripMarkers(text).trim(), numbers: clauseNumbers(text) }
}

function detectStacking(text) {
  if (/该加成全局效果唯一|全局效果唯一|不受其它加成影响/.test(text)) return 'unique'
  if (/同种效果分别取最高/.test(text)) return 'maxPerTarget'
  if (/同种效果取最高/.test(text)) return 'max'
  if (/有特殊比较规则|特殊叠加规则/.test(text)) return 'special'
  return 'stack'
}

function detectCap(text) {
  const m = text.match(/最多[^0-9]{0,6}(\d+(?:\.\d+)?)/)
  if (m) return Number(m[1])
  const m2 = text.match(/上限\s*(\d+(?:\.\d+)?)/)
  if (m2) return Number(m2[1])
  return null
}

function detectProduct(text, targets, roomType) {
  const kw = text.match(/(手性屈光体或重相位对映体|贵金属|作战记录|源石|技巧概要|精英材料|基建材料|芯片|装置|异铁组|异铁|聚酸酯|炽合金块|酮凝集|晶体|源岩|手性屈光体|重相位对映体|任意类材料)/)
  // 「手性屈光体或重相位对映体」是两种材料都要，不能只取第一个
  const norm = (v) => (v === '手性屈光体或重相位对映体' ? '手性屈光体/重相位对映体' : v)
  // 加工站：原文描述限定的材料子类（异铁/装置/源岩…）才是权威。
  // 官方 targets 只是 F_EVOLVE→精英材料 这种大类，先取会被放大适用范围。
  if (kw && roomType === 'WORKSHOP') return norm(kw[1])
  if (Array.isArray(targets) && targets.length) {
    const list = targets.map((t) => PRODUCT_BY_FORMULA[t]).filter(Boolean)
    if (list.length === 1) return list[0]
    if (roomType === 'MANUFACTURE' && list.length >= 3) return null
    if (roomType === 'WORKSHOP' && list.length >= 4) return '任意类材料'
    if (list.length > 1) return list.join('/')
  }
  return kw ? kw[1] : null
}

const PROFESSIONS = ['先锋', '近卫', '重装', '狙击', '术师', '医疗', '辅助', '特种']

function detectProfessions(text, segTokens) {
  const found = []
  for (const t of segTokens) {
    if (t.kind !== 'kw') continue
    const s = String(t.text).trim()
    if (PROFESSIONS.includes(s) && !found.includes(s)) found.push(s)
  }
  for (const p of PROFESSIONS) if (text.includes(p) && !found.includes(p)) found.push(p)
  return found
}

function detectProfession(text, segTokens) {
  return detectProfessions(text, segTokens)[0] || null
}


// ---------------------------------------------------------------- 暖机 / 递增类

function detectAddition(text, segTokens) {
  const sep = '[，、；]?'
  const re1 = new RegExp('首小时[^0-9+-]{0,4}([+-]?\\d+(?:\\.\\d+)?)\\s*%' + sep + '此后每小时[^0-9+-]{0,4}([+-]?\\d+(?:\\.\\d+)?)\\s*%' + sep + '最终达到[^0-9+-]{0,4}([+-]?\\d+(?:\\.\\d+)?)\\s*%')
  const m = text.match(re1)
  if (m) return { initial: Number(m[1]), step: Number(m[2]), final: Number(m[3]) }
  const re2 = new RegExp('此后每小时[^0-9+-]{0,4}([+-]?\\d+(?:\\.\\d+)?)\\s*%' + sep + '最终达到[^0-9+-]{0,4}([+-]?\\d+(?:\\.\\d+)?)\\s*%')
  const m2 = text.match(re2)
  if (m2) {
    // 形如“提升20%，此后每小时提升2%，最终达到30%”：初始值是暖机句之前的那个百分比
    const initM = text.match(/(\d+(?:\.\d+)?)\s*%[^0-9]{0,6}此后每小时/)
    return initM ? { initial: Number(initM[1]), step: Number(m2[1]), final: Number(m2[2]) } : { step: Number(m2[1]), final: Number(m2[2]) }
  }
  const re3 = new RegExp('此后每小时[^0-9+-]{0,4}([+-]?\\d+(?:\\.\\d+)?)\\s*%')
  const m3 = text.match(re3)
  if (m3) return { step: Number(m3[1]) }
  // 「生产力每小时+2%，最终达到+20%」：没有「首小时」，第一个小时就是 +2%，
  // 所以 initial 与 step 相同（第 10 小时恰好到 +20%）。
  const re4 = new RegExp('每小时[^0-9+-]{0,4}([+-]?\\d+(?:\\.\\d+)?)\\s*%' + sep + '最终达到[^0-9+-]{0,4}([+-]?\\d+(?:\\.\\d+)?)\\s*%')
  const m4 = text.match(re4)
  if (m4) return { initial: Number(m4[1]), step: Number(m4[1]), final: Number(m4[2]) }
  return null
}

// ---------------------------------------------------------------- 单段解析

function parseSegment(buff, seg, allTokens, ctx) {
  const roomType = buff.roomType
  const text = seg.text
  const segTokens = tokensIn(allTokens, seg)
  const metric = findMetric(text, roomType)
  if (!metric) return null
  if (isPreamble(text)) return null

  // 数字候选：<@cc.vup>/<@cc.vdown> 之外，<@cc.kw>+250</> 这类纯数字关键字也算
  const nums = segTokens.filter((t) => t.kind === 'num' || (t.kind === 'kw' && /^[+-]?\d/.test(String(t.text).trim())))
  const effect = {
    type: metric.type,
    room: metric.room || roomType,
    unit: metric.unit,
  }

  const target = detectTarget(text)
  for (const [k, v] of Object.entries(target)) effect[k] = v

  // —— 数值：取指标词之后第一个数字 token；没有就退到段内第一个数字
  let value = null
  let sign = null
  // "每有N点X，则额外+M"：M 才是增益，N 是叠加分母。
  // 默认取数会把 N 当成主数值，这里显式纠正。
  const extraGain = text.match(/每有\s*\d+\s*点[^，；]{0,20}[，、；]\s*(?:则)?\s*额外\s*([+-]?\d+(?:\.\d+)?)/)
  if (extraGain) {
    const gainVal = Math.abs(Number(extraGain[1]))
    for (const t of nums) {
      if (Math.abs(Math.abs(parseNumToken(t).value) - gainVal) < 1e-9) {
        value = parseNumToken(t).value
        sign = t.sign
        break
      }
    }
  }

  // 阈值数字（紧跟"小于/大于/达到/处于/提升N格…以下以上"）不是效果数值，跳过
  const isThresholdNum = (t) => {
    const rel = t.rel != null ? t.rel : t.at
    const before = text.slice(Math.max(0, rel - 8), rel)
    if (/小于\s*$|大于\s*$|达到\s*$|处于\s*$|以下\s*$|以上\s*$|超过\s*$/.test(before)) return true
    const after = text.slice(rel + String(t.text).length)
    // "提升16格以下的" → 16 是阈值
    if (/^\s*格(?:以下|以上)/.test(after)) return true
    return false
  }
  for (const t of nums) {
    const rel = t.rel != null ? t.rel : t.at
    if (isThresholdNum(t)) continue
    if (metric.end != null && rel >= metric.end) { value = parseNumToken(t).value; sign = t.sign; break }
  }
  if (value == null && nums.length) {
    // 回退一：指标词之前的最后一个数字（“心情消耗为4的配方心情消耗全部-1”）
    for (const t of nums) {
      const rel = t.rel != null ? t.rel : t.at
      if (isThresholdNum(t)) continue
      if (metric.index != null && rel + String(t.text).length <= metric.index) {
        value = parseNumToken(t).value
        sign = t.sign
      }
    }
  }
  if (value == null && nums.length) {
    const nonTh = nums.filter((t) => !isThresholdNum(t))
    const pick = nonTh.length ? nonTh[nonTh.length - 1] : null
    if (!pick) return null // 整段数字全是阈值 → 没有真实效果
    value = parseNumToken(pick).value
    sign = pick.sign
  }
  if (value == null) value = 0

  // —— 无人机充能特例："每10架无人机上限+1%充能速度（最多+25%）"
  // value 应是每档增益 1，cap 是 25，原逻辑误把 cap 当成 value。
  if (metric.type === 'droneCharge') {
    const dc = text.match(/每\s*(\d+)\s*架无人机上限\s*[+-]?\s*(\d+(?:\.\d+)?)/)
    if (dc) {
      value = Math.abs(Number(dc[2]))
    }
  }
  // 赤金生产线：value 取“提供N条”的 N，不是上限人数
  if (metric.type === 'goldLine') {
    const gm = text.match(/(?:提供|额外)\s*(\d+)\s*条/)
    if (gm) value = Number(gm[1])
  }

  // —— 加工站心情消耗特例（须在 value 确定后再纠正）：
  // "心情消耗为4以上的配方全部-2心情消耗" → value 是减免量 2，4 只是阈值。
  if (metric.type === 'workshopMoodCost') {
    const wc = text.match(/心情消耗为\s*\d+\s*(?:以上)?[^0-9+-]{0,8}?全部(?:除以)?\s*([+-]?\d+(?:\.\d+)?)/)
    if (wc) {
      value = Math.abs(Number(wc[1]))
      const th = text.match(/心情消耗为\s*(\d+)/)
      const div = /全部除以/.test(text)
      effect.recipeMoodCostAtLeast = th ? Number(th[1]) : null
      if (div) effect.subtype = 'divide'
    }
  }

  effect.value = value
  effect.signedValue = value

  // —— 心情类：以数字本身的符号为准。
  //     心情每小时消耗 -0.25 → moodCostReduction（收益）
  //     心情每小时恢复 -0.1  → 实际是净消耗，转成 moodCost
  if (metric.type === 'workshopMoodCost') {
    // 「恒定为N」是设定值，「-N」是减免、「+N」是增加、「全部除以N」是除法，四者必须可区分。
    // 除法必须最先判，否则会被兜底成 increase（罗小黑「全部除以4」曾被反成 +4）。
    const signed = text.match(/全部\s*([+-]\s*\d+(?:\.\d+)?)/)
      || text.match(/心情消耗\s*([+-]\s*\d+(?:\.\d+)?)/)
      || text.match(/([+-])\s*\d+(?:\.\d+)?\s*心情消耗/)
    effect.subtype = /全部除以|除以/.test(text)
      ? 'divide'
      : /恒定|固定|变为/.test(text)
        ? 'setTo'
        : (signed && /-/.test(signed[1]) ? 'reduce' : 'increase')
    effect.value = Math.abs(value)
  } else if (metric.type === 'moodCost') {
    if (value < 0) { effect.type = 'moodCostReduction'; effect.value = Math.abs(value) }
    else effect.value = Math.abs(value)
  } else if (metric.type === 'moodRecovery') {
    if (value < 0) { effect.type = 'moodCost'; effect.value = Math.abs(value) }
    else effect.value = Math.abs(value)
  }

  // —— 订单上限：按带符号的增量存储（可正可负）
  if (metric.type === 'orderLimit') effect.value = value

  // —— 叠加维度
  const per = detectPer(text, segTokens)
  if (per) {
    for (const [k, v] of Object.entries(per)) if (v != null) effect[k] = v
  } else {
    // “推进之王对该宿舍中格拉斯哥帮干员恢复效果额外+0.3”：没有“每”，但主体是派系
    const fTok = segTokens.find((x) => x.kind === 'faction')
    const tTok = segTokens.find((x) => x.kind === 'tag')
    if (fTok) { effect.factionId = fTok.id; effect.factionName = fTok.text }
    if (tTok) { effect.tagId = tTok.id; effect.tagName = tTok.text }
  }

  // —— 产物
  // 加工站的材料子类常写在前置从句里（“进驻加工站加工「异铁」类材料时，副产品…”），
  // 前置从句会被跳过，所以要从整条描述回捞，否则会退回官方 targets 的「精英材料」大类。
  const descPlain = stripMarkers(buff.description || '')
  const product = (roomType === 'WORKSHOP' ? detectProduct(descPlain, null, 'WORKSHOP') : null)
    || detectProduct(text, buff.targets, roomType)
  if (product) effect.product = product

  // —— 职业：只对训练室效果有意义；制造/贸易里的“龙门近卫局”等不含职业语义
  // 「近卫与狙击干员」这类双职业必须两个都保留，否则会漏掉半个受训人群。
  const professions = detectProfessions(text, segTokens)
  if (professions.length && (metric.room === 'TRAINING' || buff.roomType === 'TRAINING')) {
    effect.profession = professions[0]
    if (professions.length > 1) effect.professions = professions
  }

  // —— 条件
  const cond = detectCondition(text)
  if (cond) effect.condition = cond

  // “其他干员提供的订单获取效率全部归零”“其他干员提供的生产力全部归零”：
  // 这是一个独立的抑制机制，必须结构化，不能只留中文。
  const resetM = text.match(/(订单获取效率|效率|生产力|仓库容量|心情恢复)/g)
  if (/全部归零|归零/.test(text)) {
    const what = /订单获取效率|效率/.test(text) ? 'orderEfficiency'
      : /生产力/.test(text) ? 'productivity'
      : /仓库容量/.test(text) ? 'capacity'
      : /心情恢复/.test(text) ? 'moodRecovery' : 'efficiency'
    return {
      type: 'resetOthers',
      room: metric.room || buff.roomType,
      target: 'roomMembers',
      value: 0,
      unit: 'flag',
      resets: what,
      exclude: /不包含根据设施数量提供加成/.test(text) ? 'facilityCountBonus' : null,
      condition: detectCondition(text),
      stacking: 'stack',
      source: buff.buffId,
      text: stripMarkers(text).trim(),
    }
  }

  // —— 质变型指标：原文只有程度词（「小幅提升/提升…的出现概率」），整段没有任何百分比。
  // 用 level 表达档位、value 保持 flag 语义 1；凭空补一个百分比会污染排班收益计算。
  const QUALITATIVE_TYPES = new Set(['orderQuality'])
  if (QUALITATIVE_TYPES.has(metric.type) && !nums.some((t) => !isThresholdNum(t))) {
    const plainSeg = stripMarkers(text)
    effect.value = 1
    effect.unit = 'flag'
    effect.level = /小幅提升|略微提升|小幅提高/.test(plainSeg) ? 'small' : 'normal'
    const prod = detectProduct(plainSeg, buff.targets, roomType)
    if (prod) effect.product = prod
    if (/工作时长影响概率|工作时长和招募位影响概率/.test(plainSeg)) {
      effect.condition = { type: 'workTimeAffectsProbability', text: plainSeg.trim() }
    }
  }

  // 数值为 0 且没有 flag 语义 → 说明没解析到真实数值，不生成垃圾效果
  if (Number(effect.value) === 0 && effect.unit !== 'flag') return null

  // “加工原始心情消耗为8的材料时，副产品概率提升50%”：
  // “心情消耗为8”是筛选条件不是消耗效果，且会污染 moodCost，这里丢弃。
  if (effect.type === 'moodCost' && /原始心情消耗|心情消耗为\s*\d/.test(text) && !/全部|恒定/.test(text)) {
    return null
  }

  // "每N个/笔/格/条X，提供M%Y"：N 是叠加分母不是效果。
  // 若本段主数值就是那个"每"后面的 N，则不生成独立 effect（由下一句承载增益）。
  // 判据：数字紧跟在"每"之后、且段内该数字后接量词，同时段里还有别的增益数字。
  const perNumIdx = text.indexOf('每')
  // 纯叠加分母句（"每有4条赤金生产线"）没有增益标记，不生成独立效果。
  // 增益标记：+N / 额外N / 提供N / 提升N / N% / 为…提供
  const hasGainMarker = /[+-]\s*\d|额外\s*[+-]?\d|提供\s*\d|提升\s*\d|\d+\s*%|为.{0,8}提供/.test(text)
  // 仅针对确实误判的句式：纯分母从句（"每有N条/个/笔X"，后面没有增益）
  // 精确匹配，避免误伤"每4点X+1%Y"这类正常句
  // 纯分母从句：整段以"每有N<量词><名词>"结尾（没有下文增益）。
  // 必须锚定到段尾，否则会误伤"每16个工程机器人+5%生产力"这类正常句。
  const pureDenominator = /^每(?:有)?\s*\d+\s*(?:条|个|笔|格|名|间|点|架|台)\s*[\u4e00-\u9fa5]*(?:，|；|$)/.test(text.trim()) && !/[+-]\s*\d/.test(text)
  // 若段内同时含"额外+N"增益（如"每有20点X，则额外+0.05"），
  // 说明它是真效果不是纯分母，不当作分母段处理。
  const hasExtraGain = /额外\s*[+-]?\d/.test(text)
  if (pureDenominator && !hasExtraGain) {
    // 把分母 N 记下来传给下一条效果（否则 '每4条赤金生产线' 的 4 会丢失）
    const dn = text.match(/每(?:有)?\s*(\d+(?:\.\d+)?)/)
    if (dn) {
      const segTok2 = segTokens
      const perInf = detectPer(text, segTok2)
      if (!perInf) return null
      perInf.perValue = Number(dn[1])
      return { denominator: perInf }
    }
    return null
  }

  // —— 叠加上限 / 叠加规则
  const cap = detectCap(text)
  if (cap != null) effect.cap = cap
  effect.stacking = detectStacking(text)

  // —— 暖机：value 取最终值，同时保留 initial/step 便于按小时精确模拟
  const addition = detectAddition(text, segTokens)
  if (addition) {
    effect.addition = addition
    if (addition.final != null) effect.value = Math.abs(addition.final)
    else if (addition.step != null) effect.value = Math.abs(addition.step)
    // 暖机句内部不再拆成多条独立效果
    if (/首小时|此后每小时|最终达到/.test(text)) effect.warmup = true
  }

  effect.source = buff.buffId
  effect.text = stripMarkers(text).trim()
  return effect
}

// ---------------------------------------------------------------- 房间特殊规则

// 会客室线索倾向：没有数值，只有派系偏向
const CLUE_BIAS_RE = /更容易获得(.+?)线索|增加(.+?)线索的出现概率/

// 线索派系表（《罗德岛基建·会客室》7 份线索的固定编号）：
// 1 莱茵生命 2 企鹅物流 3 黑钢 4 乌萨斯学生自治团 5 格拉斯哥帮 6 喀兰贸易 7 罗德岛制药
// 说明：原文中这些派系名是普通关键词（<@cc.kw>），没有 <$cc.g.*> 标记，
// 因此无法从原始数据取出 factionId；clueNo 才是这里唯一可靠的编号。
const CLUE_FACTIONS = [
  { no: 1, id: 'rh', names: ['莱茵生命'] },
  { no: 2, id: 'penguin', names: ['企鹅物流'] },
  { no: 3, id: 'bs', names: ['黑钢国际', '黑钢'] },
  { no: 4, id: 'ussg', names: ['乌萨斯学生自治团'] },
  { no: 5, id: 'glasgow', names: ['格拉斯哥帮'] },
  { no: 6, id: 'karlan', names: ['喀兰贸易'] },
  { no: 7, id: 'rhodes', names: ['罗德岛制药'] },
]

/** 按中文派系名查线索编号与派系 id，查不到返回 null。 */
function clueFactionOf(name) {
  if (!name) return null
  const hit = CLUE_FACTIONS.find((f) => f.names.some((n) => name.includes(n)))
  return hit ? { no: hit.no, id: hit.id } : null
}

function parseMeetingExtra(buff, t) {
  const m = t.plain.match(CLUE_BIAS_RE)
  if (!m) return null
  const plain = stripMarkers(t.plain).trim()
  const factionTok = t.tokens.find((x) => x.kind === 'faction')
  // 「更容易获得线索板上尚未拥有的线索」里的「尚未拥有的」是线索范围，不是阵营名。
  // 阵营只能来自派系表或 <$cc.g.*> 标记，否则会把整句中文塞进 faction 字段。
  const target = /尚未拥有|没有的|未持有|未获得/.test(m[0])
    ? 'notOwned'
    : (/已经拥有|已拥有|已持有/.test(m[0]) ? 'owned' : undefined)
  // 「尚未拥有的」「已经拥有的」是线索范围（clueTarget），不是派系名，不能拿来查派系表。
  const nameInText = stripMarkers(m[1] || m[2] || '').trim() || null
  const rawName = factionTok ? factionTok.text : (target ? null : nameInText)
  const clue = clueFactionOf(rawName)
  const effect = {
    type: 'clueBias',
    room: 'MEETING',
    target: 'meeting',
    value: 1,
    unit: 'flag',
    clueTarget: target,
    clueNo: clue ? clue.no : undefined,
    factionId: clue ? clue.id : (factionTok ? factionTok.id : undefined),
    factionName: rawName || undefined,
    stacking: 'stack',
    source: buff.buffId,
    text: plain,
  }
  // 只有原文明确写了「工作时长影响概率」才挂该条件
  if (/工作时长影响概率|工作时长和招募位影响概率/.test(plain)) {
    effect.condition = { type: 'workTimeAffectsProbability', text: plain }
  }
  return effect
}

// 加工站减免龙门币 / 保底副产物
function parseWorkshopExtra(buff, t) {
  const p = t.plain
  if (/减免龙门币消耗/.test(p)) {
    return {
      type: 'workshopLmdFree', room: 'WORKSHOP', target: 'room', value: 1, unit: 'flag',
      product: detectProduct(p, buff.targets, buff.roomType),
      stacking: 'stack', source: buff.buffId, text: stripMarkers(p).trim(),
    }
  }
  const g = p.match(/累积\s*(\d+)\s*点(因果|业报)必定产出一次副产品/)
  if (g) {
    return {
      type: 'workshopByproductGuarantee', room: 'WORKSHOP', target: 'room', value: 1, unit: 'flag',
      per: 'accumulate', perValue: Number(g[1]), resourceName: g[2],
      stacking: 'stack', source: buff.buffId, text: stripMarkers(p).trim(),
    }
  }
  return null
}

// 特殊资源增减（人间烟火 / 感知信息 / 情报储备 ...）
function parseBdExtra(buff, t, seg, allTokens) {
  const segTokens = tokensIn(allTokens, seg)
  const bd = segTokens.find((x) => x.kind === 'bd')
  if (!bd) return null
  const text = seg.text
  const nums = segTokens.filter((x) => x.kind === 'num')
  // 该段的主指标若是产能类，则特殊资源只是附加，不单独成条
  const metric = findMetric(text, buff.roomType)
  if (metric && metric.type !== 'specialResource') return null
  // "每有20点热情值，则额外+0.05"：N 是叠加分母，不是资源增益，
  // 交给 pendingCondition，否则会凭空生成"热情值+20"。
  // 但"每有1名X干员，则热情值+N" 是真的资源增益（bd 后有数字），要保留。
  if (!metric && /^每|^同时每|^且每/.test(text.trim())) {
    const hasGainAfterBd = nums.some((x) => (x.rel != null ? x.rel : x.at) > (bd.rel != null ? bd.rel : bd.at))
    if (!hasGainAfterBd) return null
  }
  const bdRel = bd.rel != null ? bd.rel : bd.at
  const numsAfter = nums.filter((x) => (x.rel != null ? x.rel : x.at) > bdRel)
  const t0 = numsAfter[0] || nums[nums.length - 1]
  const value = t0 ? Math.abs(parseNumToken(t0).value) : 0
  // 资源增减的叠加维度：“宿舍内每有1名干员，热情值+1” → per=operator, perValue=1
  const dormPer = text.match(/每有\s*(\d+(?:\.\d+)?)\s*名/)
  const dormObj = { per: null, perValue: null }
  if (dormPer) {
    dormObj.per = 'operator'
    dormObj.perValue = Number(dormPer[1])
  }

  // 解析不到数值说明这段不是资源增减（例如"每有4点心情落差"只是条件），不生成假效果
  if (!value) return null
  // “每5点X转化为1点Y”：产出的是 Y，不是消耗品 X
  const conv = text.match(/转化为\s*\d+\s*(?:点|层|个)?\s*([\u4e00-\u9fa5]{2,6})/)
  // 转化句的资源 id 必须取「转化为」之后的那一个，否则会记成被消耗的资源
  let outBd = bd
  if (conv) {
    const convRel = text.indexOf('转化为')
    const after = segTokens.filter((x) => x.kind === 'bd' && (x.rel != null ? x.rel : x.at) > convRel)
    if (after.length) outBd = after[after.length - 1]
  }
  return {
    type: 'specialResource',
    room: buff.roomType,
    target: detectTarget(text).target,
    value,
    unit: 'points',
    resourceId: outBd.id,
    resourceName: outBd.text || BD_NAMES[outBd.id] || (conv ? conv[1] : null),
    per: detectPer(text, segTokens)?.per || dormObj.per,
    perValue: detectPer(text, segTokens)?.perValue ?? dormObj.perValue,
    condition: detectCondition(text),
    cap: detectCap(text),
    stacking: detectStacking(text),
    source: buff.buffId,
    text: stripMarkers(text).trim(),
  }
}

// 深海猎人 / 部分技能的特殊加成（描述里只有概念链接，没有数值）
const SPECIAL_BONUS_RE = /获得(.{0,10}特殊加成)|可以为(.{0,20})额外提供心情恢复/

function parseSpecialBonus(buff, t) {
  const m = t.plain.match(SPECIAL_BONUS_RE)
  if (!m) return null
  const factionTok = t.tokens.find((x) => x.kind === 'faction')
  return {
    type: 'specialBonus',
    room: buff.roomType,
    target: 'base',
    value: 1,
    unit: 'flag',
    factionId: factionTok ? factionTok.id : null,
    factionName: factionTok ? factionTok.text : null,
    stacking: 'special',
    source: buff.buffId,
    text: stripMarkers(t.plain).trim(),
  }
}

// 设施数量（发电站额外 +N，仅影响设施数量）
function parseFacilityCount(buff, t, seg, allTokens) {
  if (!/仅影响设施数量/.test(seg.text)) return null
  const segTokens = tokensIn(allTokens, seg)
  const nums = segTokens.filter((x) => x.kind === 'num')
  const value = nums.length ? Math.abs(parseNumToken(nums[nums.length - 1]).value) : 0
  const kwRoom = segTokens.filter((x) => x.kind === 'kw').map((x) => ROOM_ALIASES[String(x.text).trim()]).find(Boolean)
  return {
    type: 'facilityCount',
    room: kwRoom || buff.roomType,
    target: 'facilityCount',
    value,
    unit: 'count',
    condition: detectCondition(seg.text),
    stacking: 'stack',
    source: buff.buffId,
    text: stripMarkers(seg.text).trim(),
  }
}

// ---------------------------------------------------------------- 主入口

// “反之则自身心情每小时恢复+0.5”“则额外+0.5”“额外提供5%效率”这类续写段
// 没有自己的指标词，需要继承上一段已解析出的指标。
const CONTINUATION_RE = /^(?:反之|则额外|额外|同时|同时该|此后|最终达到|且|以及|如果)/

function parseContinuation(buff, seg, allTokens, prevEffects) {
  const text = seg.text
  if (!CONTINUATION_RE.test(text.trim())) return null
  const prev = prevEffects[prevEffects.length - 1]
  const segTokens = tokensIn(allTokens, seg)
  const nums = segTokens.filter((x) => x.kind === 'num')

  // 能自己找到指标的（如“反之则自身心情每小时恢复+0.5”）交给常规解析
  const own = findMetric(text, buff.roomType)
  if (own) return null
  if (!prev) return null

  // 纯条件从句（没有数字）：合并进上一条的 condition，标记为未识别但可解释
  if (!nums.length) {
    if (!prev.condition) prev.condition = { type: 'other', text: stripMarkers(text).trim() }
    prev.condition.extra = stripMarkers(text).trim()
    return { skip: true }
  }

  const t0 = nums[nums.length - 1]
  const value = Math.abs(parseNumToken(t0).value)
  const effect = {
    type: prev.type,
    room: prev.room,
    unit: prev.unit,
    target: detectTarget(text).target === 'room' && prev.target ? prev.target : detectTarget(text).target,
    value,
    text: stripMarkers(text).trim(),
    source: buff.buffId,
    stacking: detectStacking(text),
  }
  if (prev.product) effect.product = prev.product
  if (prev.profession) effect.profession = prev.profession
  if (prev.condition) effect.condition = prev.condition
  const cap = detectCap(text)
  if (cap != null) effect.cap = cap
  if (prev.type === 'moodRecovery' || prev.type === 'moodCost') effect.value = Math.abs(value)
  return effect
}

// “则恢复效果额外+0.45”“充能速度额外+3%”“则赤金交付数额外+1”
// 这类收尾段没有主语，需要继承上一条效果的指标与条件。
const BONUS_RE = /^(?:则|同时|，)?(?:该|当前)?[^，；]{0,10}(?:恢复效果|充能速度|效率|订单获取效率|生产力|订单上限|交付数|心情)?(?:额外)?[+-]?\d/

function parseBonusClause(buff, seg, allTokens, prevEffects) {
  const text = seg.text.trim()
  if (!/额外|则赤金交付数|则视为|下次训练所需时间/.test(text)) return null
  const prev = prevEffects[prevEffects.length - 1]
  if (!prev) return null
  const segTokens = tokensIn(allTokens, seg)
  const nums = segTokens.filter((x) => x.kind === 'num')
  if (!nums.length) return null

  // 违约订单判定：没有数值语义，单独成条
  if (/视为违约订单/.test(text)) {
    return {
      type: 'fixedOrder', room: prev.room || buff.roomType, target: 'room',
      value: 1, unit: 'flag', subtype: 'treatAsDefault',
      condition: detectCondition(text), stacking: 'stack',
      source: buff.buffId, text: stripMarkers(text).trim(),
    }
  }
  // 下次训练时间
  const rt = text.match(/下次训练所需时间[^0-9+-]{0,4}([+-]?\d+)\s*%/)
  if (rt) {
    return {
      type: 'trainingSpeed', room: 'TRAINING', target: 'trainee',
      value: Math.abs(Number(rt[1])), unit: 'percent', subtype: 'nextSessionTimeReduce',
      condition: detectCondition(text), stacking: 'stack',
      source: buff.buffId, text: stripMarkers(text).trim(),
    }
  }

  const value = Math.abs(parseNumToken(nums[nums.length - 1]).value)
  // "每有N点X，则额外+M"：M 才是增益
  const eg = text.match(/每有\s*\d+\s*点[^，；]{0,20}[，、；]?\s*(?:则)?\s*额外\s*([+-]?\d+(?:\.\d+)?)/)
  const realValue = eg ? Math.abs(Number(eg[1])) : value
  const per = detectPer(text, segTokens)
  // 段内自带明确指标词（"会客室线索搜集速度额外提升+5%"）时，用段内指标而非继承
  const ownMetric = findMetric(text, buff.roomType)
  const useType = ownMetric && ownMetric.type !== prev.type ? ownMetric.type : prev.type
  const useRoom = ownMetric && ownMetric.room ? ownMetric.room : (prev.room || buff.roomType)
  const useUnit = ownMetric && ownMetric.unit ? ownMetric.unit : prev.unit
  const useTarget = ownMetric && /会客室|贸易站|制造站|宿舍|办公室|训练室|控制中枢/.test(text)
    ? detectTarget(text).target : prev.target
  // “每有10点人间烟火，则额外-0.01”里的 per 出现在前一段，这里只保留数值
  const effect = {
    type: useType,
    room: useRoom,
    unit: useUnit,
    target: useTarget,
    value: realValue,
    // 不在这里继承 prev.condition：本段前面若刚出现过条件从句，
    // 那条从句才是本职的前置（例如「A+0.55，如果目标是锡兰，则额外+0.45」）。
    // 继承交给 parseBuff 在 pendingCondition 之后统一兜底。
    condition: detectCondition(text) || undefined,
    stacking: detectStacking(text),
    source: buff.buffId,
    text: stripMarkers(text).trim(),
  }
  if (prev.product) effect.product = prev.product
  // 「协助狙击干员…至2级，则训练速度额外+45%」：后半句同样只对同一职业生效，
  // 不继承就会退化成任意职业都加 45%。
  if (prev.profession) effect.profession = prev.profession
  if (prev.professions) effect.professions = prev.professions
  if (per && per.per && per.per !== 'operator') { effect.per = per.per; if (per.perValue != null) effect.perValue = per.perValue }
  const cap = detectCap(text)
  if (cap != null) effect.cap = cap
  return effect
}

// 极少数描述无法从句式解析，按 buffId 家族给出结构化结果。
function fallbackEffects(buff, t) {
  const base = buff.buffId.replace(/\[\d+\]$/, '')
  const plain = t.plain
  const nums = t.tokens.filter((x) => x.kind === 'num' || (x.kind === 'kw' && /^[+-]?\d/.test(String(x.text).trim())))
  const num = (i) => (nums[i] ? Math.abs(parseNumToken(nums[i]).value) : 0)
  const bd = t.tokens.find((x) => x.kind === 'bd')
  const faction = t.tokens.find((x) => x.kind === 'faction')
  const tag = t.tokens.find((x) => x.kind === 'tag')
  const common = { room: buff.roomType, source: buff.buffId, stacking: 'stack', text: stripMarkers(plain).trim() }

  // 每个招募位 +N 点特殊资源
  if (/招募位/.test(plain) && (bd || /人间烟火|感知信息|思维链环|无声共鸣|情报储备|木天蓼|热情值|乌萨斯特饮|魔物料理|巫术结晶/.test(plain))) {
    return [{ type: 'specialResource', target: 'room', value: num(0), unit: 'points',
      resourceId: bd ? bd.id : null,
      resourceName: bd ? (bd.text || BD_NAMES[bd.id] || null) : (plain.match(/(人间烟火|感知信息|思维链环|无声共鸣|情报储备|木天蓼|热情值|乌萨斯特饮|魔物料理|巫术结晶)/) || [])[1] || null,
      per: 'hireSlot', condition: { type: 'hireSlotPresent', text: stripMarkers(plain).trim() }, ...common }]
  }
  // 每个招募位 +N 点特殊资源（被 pureDenominator 跳过后走这里）
  if (/招募位/.test(plain) && bd) {
    return [{ type: 'specialResource', target: 'room', value: num(0), unit: 'points',
      resourceId: bd.id, resourceName: bd.text || BD_NAMES[bd.id] || null,
      per: 'hireSlot', condition: { type: 'hireSlotPresent', text: stripMarkers(plain).trim() }, ...common }]
  }
  // 加工站：连续无副产物后恢复心情
  if (/恢复自身一次心情|没有产出副产品/.test(plain)) {
    return [{ type: 'moodRecovery', target: 'self', value: 1, unit: 'flat',
      subtype: 'refundRecipeCost',
      condition: { type: 'afterNoByproduct', text: stripMarkers(plain).trim() }, ...common }]
  }
  // 会客室：非某派系线索时提升该派系线索概率
  const flag = plain.match(/不是(.+?)时，则额外增加(.+?)线索的出现概率/)
  if (flag) {
    const clue = clueFactionOf(flag[2].trim())
    return [{ type: 'clueBias', room: 'MEETING', target: 'meeting', value: 1, unit: 'flag',
      clueNo: clue ? clue.no : null,
      factionId: clue ? clue.id : (faction ? faction.id : null),
      factionName: flag[2].trim(),
      condition: { type: 'clueNotFaction', clueNo: clue ? clue.no : null, text: stripMarkers(plain).trim() },
      stacking: 'stack', source: buff.buffId, text: stripMarkers(plain).trim() }]
  }
  // 加工站：T3 副产品必定为某材料
  // 「必定为聚酸酯组」里的「组」是材料名的一部分（聚酸酯组 ≠ 聚酸酯），不能用可选组吃掉。
  const drop = plain.match(/副产品必定为(.+?)$/)
  if (drop) {
    // 「产出T3品质的副产品时」是前置条件，T3 是普通关键词不是数字，之前整条丢失。
    const tier = plain.match(/产出\s*T(\d)\s*品质的副产品/)
    return [{ type: 'workshopByproduct', target: 'room', value: 1, unit: 'flag',
      subtype: 'forceByproduct', forced: drop[1].replace(/[。；，]$/, '').trim(),
      product: detectProduct(plain, buff.targets, buff.roomType),
      condition: tier ? { type: 'byproductTier', threshold: Number(tier[1]), text: stripMarkers(plain).trim() } : undefined,
      ...common }]
  }
  // 技能类别转换（莱茵科技/红松骑士团 视为标准化）
  if (/视作标准化类技能/.test(plain)) {
    return [{ type: 'skillClassConvert', target: 'room', value: 1, unit: 'flag',
      from: ['莱茵科技', '红松骑士团'], to: '标准化', ...common }]
  }
  // 会客室：连续消耗心情后必定获得某派系线索
  const must = plain.match(/连续消耗超过\s*(\d+)\s*点心情下一次必定获得(.+?)的线索/)
  if (must) {
    const clue = clueFactionOf(must[2].trim())
    // 「如果会客室内只有自身处于工作状态时」是独立触发条件，不能与心情消耗条件互相覆盖。
    const alone = /只有自身处于工作状态/.test(plain)
    const condition = {
      type: 'afterMoodSpent',
      threshold: Number(must[1]),
      text: stripMarkers(plain).trim(),
    }
    if (alone) condition.extra = [{ type: 'aloneInRoom', text: '会客室内只有自身处于工作状态' }]
    return [{ type: 'clueBias', room: 'MEETING', target: 'meeting', value: 1, unit: 'flag',
      clueNo: clue ? clue.no : null,
      factionId: clue ? clue.id : (faction ? faction.id : null),
      factionName: must[2].trim(),
      guarantee: true,
      condition,
      stacking: 'stack', source: buff.buffId, text: stripMarkers(plain).trim() }]
  }
  // 训练室：武道累积后瞬间完成
  if (/武道/.test(plain)) {
    return [{ type: 'trainingSpeed', target: 'trainee', value: 1, unit: 'flag',
      subtype: 'instantComplete', resourceName: '武道',
      condition: { type: 'assistSession', text: stripMarkers(plain).trim() }, ...common }]
  }
  // 最后兜底：标记为 unknown，保留原文
  return [{
    type: 'unknown', target: detectTarget(plain).target, value: 1, unit: 'flag',
    factionId: faction ? faction.id : null, tagId: tag ? tag.id : null,
    condition: { type: 'unparsed', text: stripMarkers(plain).trim() }, ...common,
  }]
}

// 前置从句（触发条件 + 叠加维度）挂到效果上。
// 「每个进驻在贸易站的谢拉格干员，订单获取效率-15%」里 per/factionId 在从句里，
// 而「每有1名彩虹小队干员，则情报储备+1」的资源 id 在效果段里，
// 所以两边都要能互相补，且不能因为效果自带条件就整体跳过。
function applyPending(e, pc) {
  if (!e || !pc) return e
  if (!e.condition) {
    e.condition = pc.condition
    if (pc.clauseNumbers && e.condition && !e.condition.numbers) e.condition.numbers = pc.clauseNumbers
  } else if (pc.condition && pc.condition.text && !e.condition.extra) {
    // 效果自带的条件（如配方阈值）与前置从句的条件（如「宿舍内每有10名…」）
    // 是两件事，不能互相覆盖，前置从句保留在 extra 里
    e.condition.extra = pc.condition.text
  }
  if (pc.factionId && !e.factionId) { e.factionId = pc.factionId; e.factionName = pc.factionName }
  if (pc.tagId && !e.tagId) { e.tagId = pc.tagId; e.tagName = pc.tagName }
  if (pc.resourceId && !e.resourceId) { e.resourceId = pc.resourceId; e.resourceName = pc.resourceName }
  if (pc.cap != null && e.cap == null) e.cap = pc.cap
  if (pc.per && !e.per) e.per = pc.per
  if (pc.perValue != null && e.perValue == null) e.perValue = pc.perValue
  if (pc.product && !e.product) e.product = pc.product
  if (pc.profession && !e.profession && !e.professions) {
    e.profession = pc.profession
    if (pc.professions) e.professions = pc.professions
  }
  // 「每个进驻在贸易站的谢拉格干员，订单获取效率-15%」：作用范围在从句里，
  // 效果段只剩「订单获取效率-15%」，detectTarget 会退化成 room。
  // 只认「进驻在X站」且目标设施与效果房间一致的情况：
  // 「如果菲亚梅塔进驻在宿舍，会客室线索速度+10%」里的宿舍是条件，不是作用范围。
  const TARGET_ROOM = {
    allTrading: 'TRADING', allManufacture: 'MANUFACTURE', meeting: 'MEETING',
    allDormitory: 'DORMITORY', trainingRoom: 'TRAINING', control: 'CONTROL',
  }
  if (e.target === 'room' && pc.condition && pc.condition.text && /进驻在|存在\d+名/.test(pc.condition.text)) {
    const t = detectTarget(pc.condition.text)
    if (t && t.target && TARGET_ROOM[t.target] && TARGET_ROOM[t.target] === e.room) {
      e.target = t.target
      if (t.excludeSelf && e.excludeSelf == null) e.excludeSelf = true
    }
  }
  return e
}

/** 解析单个 buff，返回 { effects, manualReview, text } */
export function parseBuff(buff) {
  const t = tokenize(buff.description)
  const segments = splitSegments(t.plain)
  const effects = []
  const unparsed = []
  // “每个进驻在贸易站的谢拉格干员，订单获取效率-15%”这类：前段是触发主体/条件，
  // 后段才是效果。先攒起来，等下一条 effect 生成时附上。
  let pendingCondition = null

  for (let si = 0; si < segments.length; si += 1) {
    const seg = segments[si]
    const className = buff.buffId.replace(/\[\d+\]$/, '')

    const fc = parseFacilityCount(buff, t, seg, t.tokens)
    if (fc) {
      // 「如果Lancet-2进驻在发电站，发电站额外+2（仅影响设施数量）」：
      // 条件在上一段，不能因为这条自带指标就把前置条件丢掉。
      applyPending(fc, pendingCondition)
      effects.push(fc); pendingCondition = null; continue
    }

    const bias = parseMeetingExtra(buff, t)
    if (bias && CLUE_BIAS_RE.test(seg.text) && !findMetric(seg.text, buff.roomType)) { effects.push(bias); pendingCondition = null; continue }

    const ws = buff.roomType === 'WORKSHOP' ? parseWorkshopExtra(buff, t) : null
    if (ws) { effects.push(ws); pendingCondition = null; continue }

    // “提升会客室内干员所属派系的线索倾向效果”
    if (/线索倾向效果|线索倾向/.test(seg.text) && !findMetric(seg.text, buff.roomType)) {
      const level = /小幅提升/.test(seg.text) ? 'small' : 'normal'
      // 「（如会客室没有另一干员则不提升）」在括号里，可能被切分丢掉，用整段原文兜底识别。
      const cond = detectCondition(seg.text)
        || (/没有另一干员则不提升/.test(t.plain) ? { type: 'needsOtherOperatorInRoom' } : null)
      effects.push({
        type: 'clueBias', room: 'MEETING', target: 'meeting', value: 1, unit: 'flag',
        level, scope: 'roomMemberFaction',
        condition: cond || undefined,
        stacking: 'stack', source: buff.buffId, text: stripMarkers(seg.text).trim(),
      })
      pendingCondition = null
      continue
    }

    const bd = parseBdExtra(buff, t, seg, t.tokens)
    if (bd) { applyPending(bd, pendingCondition); effects.push(bd); pendingCondition = null; continue }

    // “则恢复效果额外+0.45”“充能速度额外+3%”“则赤金交付数额外+1”
    const bonus = parseBonusClause(buff, seg, t.tokens, effects)
    if (bonus) {
      if (!bonus.condition) {
        if (pendingCondition && pendingCondition.condition) {
          bonus.condition = pendingCondition.condition
        } else {
          // 没有新条件从句时，才沿用上一条的条件（“当与X一起工作时，A+5%，额外+3%”）
          const p = effects[effects.length - 1]
          if (p && p.condition) bonus.condition = { ...p.condition }
        }
      }
      if (pendingCondition && !bonus.condition) {
        bonus.condition = pendingCondition.condition
      }
      if (pendingCondition) {
        if (pendingCondition.per && !bonus.per) bonus.per = pendingCondition.per
        if (pendingCondition.perValue != null && bonus.perValue == null) bonus.perValue = pendingCondition.perValue
        if (pendingCondition.cap != null && bonus.cap == null) bonus.cap = pendingCondition.cap
        if (pendingCondition.factionId && !bonus.factionId) bonus.factionId = pendingCondition.factionId
        if (pendingCondition.tagId && !bonus.tagId) bonus.tagId = pendingCondition.tagId
      }
      effects.push(bonus); pendingCondition = null; continue }

    const sb = parseSpecialBonus(buff, t)
    if (sb && !findMetric(seg.text, buff.roomType)
        && !effects.some((x) => x.type === 'specialBonus')) {
      effects.push(sb)
      pendingCondition = null
      continue
    }

    // “最多提供25%效率”这类纯上限段：把 cap 挂到上一条
    if (/^最多|^上限/.test(seg.text.trim()) && !findMetric(seg.text, buff.roomType) && effects.length) {
      const capOnly = detectCap(seg.text)
      if (capOnly != null) { effects[effects.length - 1].cap = capOnly; continue }
    }

    // 纯条件从句（“当自身心情处于12以下时”）
    const condOnly = detectCondition(seg.text)
    if (condOnly && !findMetric(seg.text, buff.roomType) && effects.length) {
      // 「A；如果 C，则 B」：C 只限定后面的 B。
      // 回溯挂到 A 会让本无条件的基础值变成「满足 C 才生效」，严重低估收益。
      if (hasEffectAfter(segments, si, buff.roomType)) {
        // 条件从句里往往同时带着叠加维度（「每个进驻在贸易站的谢拉格干员」），
        // 必须一并传递，否则阵营叠加信息会整条丢失。
        const perInf = detectPer(seg.text, tokensIn(t.tokens, seg))
        // 「协助狙击干员训练专精技能至1级时」：职业限制在条件从句里，效果主体在下一段。
        const profs = buff.roomType === 'TRAINING'
          ? detectProfessions(seg.text, tokensIn(t.tokens, seg))
          : []
        pendingCondition = {
          condition: condOnly,
          per: perInf ? perInf.per : null,
          perValue: perInf ? perInf.perValue : null,
          factionId: perInf ? perInf.factionId : null,
          factionName: perInf ? perInf.factionName : null,
          tagId: perInf ? perInf.tagId : null,
          tagName: perInf ? perInf.tagName : null,
          cap: detectCap(seg.text),
          profession: profs[0] || null,
          professions: profs.length > 1 ? profs : null,
        }
        continue
      }
      const prev = effects[effects.length - 1]
      prev.condition = prev.condition
        ? { ...condOnly, extra: prev.condition.text || prev.condition.extra }
        : condOnly
      if (!prev.condition.type) prev.condition.type = 'other'
      continue
    }

    // 纯分母从句：不生成效果，但把 N 存进 pendingCondition
    const denom = parseSegment(buff, seg, t.tokens, { className })
    if (denom && denom.denominator) {
      pendingCondition = {
        condition: null,
        per: denom.denominator.per,
        perValue: denom.denominator.perValue,
        factionId: denom.denominator.factionId,
        factionName: denom.denominator.factionName,
        tagId: denom.denominator.tagId,
        tagName: denom.denominator.tagName,
        resourceId: denom.denominator.resourceId,
        resourceName: denom.denominator.resourceName,
        cap: denom.denominator.cap,
      }
      continue
    }

    let e = denom
    if (!e) e = parseContinuation(buff, seg, t.tokens, effects)
    if (e && e.skip) e = null
    if (e) {
      applyPending(e, pendingCondition)
      effects.push(e)
    } else {
      // “生产作战记录类配方时”这类是产物限定，挂到下一条的 product
      if (/^生产.+配方时$|^加工.+时$/.test(seg.text.trim())) {
        const prod = detectProduct(seg.text, null, buff.roomType)
        pendingCondition = { product: prod, condition: null }
        continue
      }
      // 攒起来：这一段是下一条效果的触发主体/条件
      const cond = detectCondition(seg.text)
      const per = detectPer(seg.text, tokensIn(t.tokens, seg))
      // 「每个存在3名谢拉格干员的贸易站，订单获取效率+10%」：3 是"按站前提"而不是
      // 叠加分母（3 人 +10%，6 人也只 +10%），不能按 perValue=3 逐人累加。
      const exist = stripMarkers(seg.text).match(/每个存在\s*(\d+)\s*名(.+?)干员的(.+?)(?:，|$)/)
      if (exist) {
        const th = Number(exist[1])
        pendingCondition = {
          condition: {
            type: 'factionCountAtLeast',
            factionId: per ? per.factionId : null,
            factionName: per ? per.factionName : null,
            threshold: th,
            text: stripMarkers(seg.text).trim(),
            numbers: [th],
          },
        }
        continue
      }
      if (cond || per) {
        pendingCondition = {
          condition: cond || { type: 'trigger', text: stripMarkers(seg.text).trim() },
          clauseNumbers: (cond && cond.numbers) ? cond.numbers : clauseNumbers(seg.text),
          factionId: per ? per.factionId : null,
          factionName: per ? per.factionName : null,
          tagId: per ? per.tagId : null,
          tagName: per ? per.tagName : null,
          cap: detectCap(seg.text),
          per: per ? per.per : null,
          perValue: per ? per.perValue : null,
          resourceId: per ? per.resourceId : null,
          resourceName: per ? per.resourceName : null,
        }
      // "如训练室有干员在进行技能专精"：纯条件，存为 pendingCondition 供后续效果挂载
      if (!effects.length && condOnly && !findMetric(seg.text, buff.roomType)) {
        const profs = buff.roomType === 'TRAINING'
          ? detectProfessions(seg.text, tokensIn(t.tokens, seg))
          : []
        // 「每个进驻在贸易站的谢拉格干员，订单获取效率-15%」：叠加维度与阵营都在
        // 这个从句里，不能因为"还没有前一条效果"就把 per/factionId 丢掉。
        pendingCondition = {
          condition: condOnly,
          per: per ? per.per : null,
          perValue: per ? per.perValue : null,
          factionId: per ? per.factionId : null,
          factionName: per ? per.factionName : null,
          tagId: per ? per.tagId : null,
          tagName: per ? per.tagName : null,
          resourceId: per ? per.resourceId : null,
          resourceName: per ? per.resourceName : null,
          cap: detectCap(seg.text),
          profession: profs[0] || null,
          professions: profs.length > 1 ? profs : null,
        }
        continue
      }
      } else if (!isPreamble(seg.text)) {
        unparsed.push(stripMarkers(seg.text).trim())
      }
    }
  }

  // 纯条件段（"如训练室有干员在进行技能专精"）回溯挂到最后一个效果
  if (unparsed.length && effects.length) {
    const back = []
    for (const segText of unparsed) {
      const c = detectCondition(segText)
      if (c) {
        effects[effects.length - 1].condition = effects[effects.length - 1].condition || c
      } else back.push(segText)
    }
    unparsed.length = 0
    unparsed.push(...back)
  }

  // 兜底：整条都没解析出 effect 时，按 buffId 语义给出结构化结果
  if (!effects.length) effects.push(...fallbackEffects(buff, t))

  // 后处理：补齐从句数字 —— 效果自身文本含每N/心情N以下等阈值时
  // 把数字记入 condition.numbers，避免这些数值丢失
  for (const e of effects) {
    if (!e.condition) {
      const nums = clauseNumbers(String(e.text || ''))
      if (nums.length) e.condition = { type: 'trigger', text: String(e.text || ''), numbers: nums }
    } else if (!e.condition.numbers) {
      const nums = clauseNumbers(String(e.condition.text || e.text || ''))
      if (nums.length) e.condition.numbers = nums
    }
  }
  // 后处理：补齐 perValue —— 若效果有叠加维度但缺"每 N"，
  // 从生效文本/条件文本里回捞（"每有4条赤金生产线" → perValue=4）
  for (const e of effects) {
    if (e.per && e.perValue == null) {
      const src = String(e.text || "") + " " + String((e.condition && e.condition.text) || "")
      const m = src.match(/每(?:有)?\s*(\d+(?:\.\d+)?)/)
      if (m) e.perValue = Number(m[1])
    }
  }

  // 「生产力每小时+2%，最终达到+20%」（无「首小时」）：分段后变成 2% 与 20% 两条独立效果，
  // 全文再匹配一次暖机句式，合并成一条 warmup 效果（value 取最终值）。
  const plainAll = stripMarkers(t.plain).trim()
  if (!/首小时|此后每小时/.test(plainAll)) {
    const wholeAdd = detectAddition(plainAll, [])
    if (wholeAdd && wholeAdd.initial != null && wholeAdd.final != null) {
      const keep = effects.find((e) => e.addition == null
        && (Math.abs(Number(e.value)) === Math.abs(wholeAdd.final) || Math.abs(Number(e.value)) === Math.abs(wholeAdd.initial)))
      if (keep) {
        for (let i = effects.length - 1; i >= 0; i -= 1) {
          const e = effects[i]
          if (e === keep || e.addition != null || e.type !== keep.type) continue
          const v = Math.abs(Number(e.value))
          if (v === Math.abs(wholeAdd.step) || v === Math.abs(wholeAdd.final)) effects.splice(i, 1)
        }
        keep.addition = wholeAdd
        keep.value = Math.abs(wholeAdd.final)
        keep.warmup = true
      }
    }
  }

  // 暖机技能去重：主效果（value=final）保留，同 type 的中间值条目移除
  const warm = effects.filter((e) => e.warmup && e.addition && e.addition.final != null)
  if (warm.length) {
    const finals = new Set(warm.map((e) => Math.abs(Number(e.value))))
    const kept = effects.filter((e) => {
      if (!e.warmup) return true
      if (e.addition && e.addition.final != null) return true
      return false
    })
    effects.length = 0
    effects.push(...kept)
  }

  // 暖机：把 addition 归并到同 type 的首条 effect 上，避免拆成多条独立值
  for (const e of effects) {
    if (!e.addition || e.addition.final == null) continue
    const first = effects.find((x) => x.type === e.type && x !== e && x.addition == null)
    if (first) {
      first.addition = e.addition
      first.value = Math.abs(Number(e.addition.final))
      first.warmup = true
      e.mergeIntoFirst = true
    }
  }
  const merged = effects.filter((e) => !e.mergeIntoFirst)
  effects.length = 0
  effects.push(...merged)

  // 去重：同一 buff 内签名完全相同的 effect 只保留一条
  const seenFx = new Set()
  const dedup = []
  for (const e of effects) {
    const sig = [e.type, e.room, e.target, e.value, e.unit, e.product, e.per, e.perValue, e.subtype, e.forced, String(e.text)].join('|')
    if (seenFx.has(sig)) continue
    seenFx.add(sig)
    dedup.push(e)
  }
  effects.length = 0
  effects.push(...dedup)

  // 「除自身以外」只对"作用于一批干员"的效果有意义。
  // clueBias 之类的倾向/标记效果没有"排除自身"的概念，用整句正则会把无关效果一起传染。
  const NO_EXCLUDE_SELF_TYPES = new Set(['clueBias', 'fixedOrder', 'resetOthers', 'specialBonus', 'unknown'])
  const hasExcludeSelfText = (e) => !NO_EXCLUDE_SELF_TYPES.has(e.type) && /除自身以外|除自身之外/.test(
    String(e.text || '') + ' ' + String((e.condition && e.condition.text) || ''),
  )
  for (const e of effects) {
    if (e.excludeSelf == null && e.target && e.target !== 'self' && hasExcludeSelfText(e)) e.excludeSelf = true
  }
  for (const e of effects) {
    if (e.excludeSelf != null || e.target === 'self') continue
    if (NO_EXCLUDE_SELF_TYPES.has(e.type)) continue
    if (!['dormitory', 'roomMembers', 'allDormitory'].includes(e.target)) continue
    const sibling = effects.find((x) => x !== e && x.excludeSelf != null && x.type === e.type && x.target === e.target)
    if (sibling) e.excludeSelf = true
  }

  // 后处理：清理临时字段
  for (const e of effects) {
    delete e.signedValue
    delete e.direction
    if (e.excludeSelf === false) delete e.excludeSelf
    for (const k of Object.keys(e)) if (e[k] === null || e[k] === undefined) delete e[k]
  }

  // 最终兜底：把描述里未被任何 effect 承载的数字记到 condition.numbers
  if (effects.length) {
    const carried = []
    for (const e of effects) {
      if (e.value != null) carried.push(Math.abs(Number(e.value)))
      if (e.perValue != null) carried.push(Math.abs(Number(e.perValue)))
      if (e.cap != null) carried.push(Math.abs(Number(e.cap)))
      if (e.condition && Array.isArray(e.condition.numbers)) carried.push(...e.condition.numbers.map(Math.abs))
      if (e.recipeMoodCostAtLeast != null) carried.push(Math.abs(Number(e.recipeMoodCostAtLeast)))
    }
    const descNums = clauseNumbers(stripMarkers(t.plain).trim())
    const lost = descNums.filter((n) => !carried.some((c) => Math.abs(c - n) < 1e-9))
    if (lost.length) {
      const last = effects[effects.length - 1]
      if (!last.condition) last.condition = { type: 'other', text: String(last.text || '') }
      last.condition.numbers = [...(last.condition.numbers || []), ...lost]
    }
  }
  // flag 类效果的 value 不承载数值（语义由 type 承担），统一规范化为 1。
  // 留 0 会被下游的 `if (value)` 当成"没有效果"，且与"数值真的是 0"无法区分。
  for (const e of effects) {
    if (e.unit === 'flag') e.value = 1
  }

  // 人工确证的个例修正：句式不规则，用通用正则去修的风险高于收益，见 effect-overrides.mjs
  const override = EFFECT_OVERRIDES[buff.buffId]
  if (override) {
    const descText = stripMarkers(t.plain).trim()
    effects.length = 0
    for (const e of override.effects) {
      effects.push({ ...e, source: buff.buffId, text: e.text || descText })
    }
    unparsed.length = 0
  }

  const manualReview = unparsed.length
    ? { reason: '未识别的表述', segments: unparsed }
    : null
  return { effects, manualReview, text: stripMarkers(t.plain).trim() }
}

/** 兼容旧字段：从 effects 反推一个保守的数值，用于排序/展示 */
export function effectScore(skill) {
  const effects = skill.effects || []
  let percent = 0
  let orderLimit = 0
  let capacity = 0
  let mood = 0
  for (const e of effects) {
    if (e.unit === 'percent' && ['productivity', 'orderEfficiency', 'droneCharge', 'clueSpeed', 'hireSpeed', 'trainingSpeed', 'recycleEfficiency', 'workshopByproduct'].includes(e.type)) {
      percent += Number(e.value || 0)
    }
    if (e.type === 'orderLimit') orderLimit += Number(e.value || 0)
    if (e.type === 'capacity') capacity += Number(e.value || 0)
    if (e.type === 'moodRecovery') mood += Number(e.value || 0)
    if (e.type === 'moodCost') mood -= Number(e.value || 0)
    if (e.type === 'moodCostReduction') mood += Number(e.value || 0)
  }
  return { percent, orderLimit, capacity, mood }
}
