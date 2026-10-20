// scripts/lib/factions.mjs
//
// 效果里的 factionId 用的是 building_data 描述标记 `<$cc.g.*>` 的取值
// （`rh` / `bs` / `psk` / `R6` …），与角色表里的官方 `nationId` / `groupId` / `teamId`
// 不是同一套命名。两边直接比较永远匹配不上，例如 `characters[].group` 是 `rhine`，
// 而效果里写的是 `rh`。这里把标记 id 翻译成"角色属于哪些派系"，
// 生成阶段落成 `characters[].factions`，下游按 `factions.includes(effect.factionId)` 判断即可。
//
// 判定依据（都可在原始数据中复核）：
// - group：`character_table.json` 的 `groupId`，如 rhine=莱茵生命、pinus=红松骑士团
// - nation：`nationId`，如 kjerag=谢拉格、sami=萨米（萨米在效果里写作 `sm`）
// - team：`teamId`，如 student=乌萨斯学生自治团、rainbow=彩虹小队、lee=鲤氏侦探事务所
// - displayPrefix：没有统一 teamId 时按编号前缀（怪物猎人小队 MH03/MH05/MH06）
//
// 注意：`karlan` 这个标记在描述里配的中文是「谢拉格」（地区），
// 而官方 `groupId=karlan` 是「喀兰贸易」，两者不是一回事，因此按 `kjerag` 国家字段匹配。
export const FACTION_MEMBERSHIP = {
  rh: { group: 'rhine' }, // 莱茵生命
  bs: { group: 'blacksteel' }, // 黑钢国际
  psk: { group: 'pinus' }, // 红松骑士团
  penguin: { group: 'penguin' }, // 企鹅物流
  sui: { group: 'sui' }, // 岁
  elite: { group: 'elite' }, // 精英干员
  abyssal: { group: 'abyssal' }, // 深海猎人
  glasgow: { group: 'glasgow' }, // 格拉斯哥帮
  lgd: { group: 'lgd' }, // 龙门近卫局
  karlan: { nation: 'kjerag' }, // 谢拉格
  siracusa: { nation: 'siracusa' }, // 叙拉古
  minos: { nation: 'minos' }, // 米诺斯
  sargon: { nation: 'sargon' }, // 萨尔贡
  laterano: { nation: 'laterano' }, // 拉特兰
  sm: { nation: 'sami' }, // 萨米
  rhodes: { nation: 'rhodes' }, // 罗德岛制药
  ussg: { team: 'student' }, // 乌萨斯学生自治团
  R6: { team: 'rainbow' }, // 彩虹小队
  lda: { team: 'lee' }, // 鲤氏侦探事务所
  A1: { team: 'reserve1' }, // A1 小队（行动预备组A1）
  mh: { displayPrefix: 'MH' }, // 怪物猎人小队
  sp: { spChar: true }, // 异格
}

// 彩虹小队的「防守方 / 进攻方」在角色表里没有字段可判定，
// 只能按同类技能（`train_spd_tag[020]/[030]` 家族）的持有者推断。
// TODO：待官方数据补出阵营字段后替换。
export const FACTION_CHARS = {
  Defence: ['char_4123_ela', 'char_4125_rdoc'], // 艾拉、医生
  Attack: ['char_4124_iana', 'char_4126_fuze'], // 双月、导火索
}

/** 返回某角色所属的派系标记 id 列表。 */
export function factionsOf(info = {}) {
  const out = new Set()
  const id = info.id || info.charId || ''
  for (const [token, rule] of Object.entries(FACTION_MEMBERSHIP)) {
    if (rule.group && info.groupId === rule.group) out.add(token)
    if (rule.nation && info.nationId === rule.nation) out.add(token)
    if (rule.team && info.teamId === rule.team) out.add(token)
    if (rule.spChar && info.isSpChar === true) out.add(token)
    if (rule.displayPrefix && String(info.displayNumber || '').startsWith(rule.displayPrefix)) out.add(token)
  }
  for (const [token, ids] of Object.entries(FACTION_CHARS)) {
    if (ids.includes(id)) out.add(token)
  }
  return [...out].sort()
}
