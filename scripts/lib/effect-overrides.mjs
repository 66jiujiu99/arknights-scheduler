// 人工确证的个例修正表
//
// 这里只放「句式不规则、用通用正则去修的风险高于收益」的条目。
// 每条都必须对照 building_data.json 的中文原文确认过，并在 note 里写清依据。
// 结构：buffId -> { note, effects: [...] }
// effects 为最终结果，source/text 由 effects.mjs 自动补齐。

export const EFFECT_OVERRIDES = {
  // 「当前贸易站内干员提供的每5%订单获取效率，额外提供5%效率，最多提供25%效率」
  // 分母是「5%效率」，增益是 5%，上限 25%。原解析拆成两条各 value=5，会重复计一次。
  'trade_ord_spd_variable2[000]': {
    note: '每5%效率额外+5%，最多+25%；合并为单条并直接带上限',
    effects: [
      { type: 'orderEfficiency', room: 'TRADING', unit: 'percent', target: 'room', value: 5, per: 'efficiency', perValue: 5, cap: 25, stacking: 'stack' },
    ],
  },
  'trade_ord_spd_variable2[001]': {
    note: '同上，上限 35%',
    effects: [
      { type: 'orderEfficiency', room: 'TRADING', unit: 'percent', target: 'room', value: 5, per: 'efficiency', perValue: 5, cap: 35, stacking: 'stack' },
    ],
  },

  // 「每5个订单上限，提供25%订单获取效率，最多提供100%效率」
  // 原解析把「每5个订单上限」当成独立的 orderLimit+5，会凭空给贸易站加 5 个上限。
  'trade_ord_spd_variable3[000]': {
    note: '订单上限是分母不是效果，主体是 25% 订单效率，最多 100%',
    effects: [
      { type: 'orderEfficiency', room: 'TRADING', unit: 'percent', target: 'room', value: 25, per: 'orderLimit', perValue: 5, cap: 100, stacking: 'stack' },
    ],
  },

  // 「每5%生产力，额外提供5%生产力，最多提供40%生产力」
  'manu_prod_spd_variable2[000]': {
    note: '每5%效率额外+5%生产力，最多+40%；原解析多出一条 value=40 会被重复累加',
    effects: [
      { type: 'productivity', room: 'MANUFACTURE', unit: 'percent', target: 'room', value: 5, per: 'efficiency', perValue: 5, cap: 40, stacking: 'stack' },
    ],
  },

  // 「提升16格以下的，每格仓库容量提供1%生产力；提升大于16格的，每格仓库容量提供3%生产力」
  // 被作用的是「生产力」，不是「仓库容量」；两档分别对应 16 格以下/以上。
  'manu_prod_spd_variable3[000]': {
    note: '两档生产力加成，16格以下 1%/格，大于16格 3%/格',
    effects: [
      { type: 'productivity', room: 'MANUFACTURE', unit: 'percent', target: 'room', value: 1, per: 'capacity', condition: { type: 'capacityBelow', threshold: 16 }, stacking: 'stack' },
      { type: 'productivity', room: 'MANUFACTURE', unit: 'percent', target: 'room', value: 3, per: 'capacity', condition: { type: 'capacityAbove', threshold: 16 }, stacking: 'stack' },
    ],
  },

  // 「其他设施内…+0.05；同时每有20点人间烟火，则额外+0.05」
  // 20 是叠加分母不是增益；原解析把 20 直接写成 value，会算出每小时恢复 +20 心情。
  'control_mp_bd_cost_expand[000]': {
    note: '基础 +0.05 无条件；每 20 点人间烟火额外 +0.05（20 是 perValue）',
    effects: [
      { type: 'moodRecovery', room: 'CONTROL', unit: 'perHour', target: 'otherFacilities', value: 0.05, stacking: 'stack' },
      { type: 'moodRecovery', room: 'CONTROL', unit: 'perHour', target: 'otherFacilities', value: 0.05, per: 'resourcePoint', perValue: 20, resourceId: 'bd_b1', resourceName: '人间烟火', stacking: 'stack' },
    ],
  },

  // 「单次协助一名干员训练时长达5小时，则该名干员下次训练所需时间-50%」
  // 这是「训练时间减少」，不是「训练速度 -50%」——后者会被算成训练变慢。
  'train_spd_reduceTime[000]': {
    note: '训练所需时间 -50%（提速），条件：单次协助时长达 5 小时',
    effects: [
      { type: 'trainingTimeReduction', room: 'TRAINING', unit: 'percent', target: 'trainee', value: 50, condition: { type: 'shiftHoursAtLeast', hours: 5 }, stacking: 'stack' },
    ],
  },
  'train_spd_reduceTime[001]': {
    note: '同 train_spd_reduceTime[000]',
    effects: [
      { type: 'trainingTimeReduction', room: 'TRAINING', unit: 'percent', target: 'trainee', value: 50, condition: { type: 'shiftHoursAtLeast', hours: 5 }, stacking: 'stack' },
    ],
  },

  // 「自身心情每小时恢复+2，同时无法获得其他来源提供的心情恢复效果」
  // flag 类 value 应为 1；且被屏蔽的是自身，target 应为 self。
  'dorm_recExcludeOther[000]': {
    note: 'moodRecoveryBlock 是 flag，value=1，target=self',
    effects: [
      { type: 'moodRecovery', room: 'DORMITORY', unit: 'perHour', target: 'self', value: 2, stacking: 'stack' },
      { type: 'moodRecoveryBlock', room: 'DORMITORY', unit: 'flag', target: 'self', value: 1, stacking: 'stack' },
    ],
  },

  // 「每有一间进驻精英干员的设施，联络速度额外+4%（最多5间）」
  // 按「设施数」计数，不是按干员人数；原 per=factionMember 会在同设施多人时重复计数。
  // 阵营约束记在效果级 factionId 上（与真言的 trade_ord_spd&tag[010] 同口径），
  // 不再另挂一个只做过滤的 condition.factionInFacility。
  'hire_spd_tag[000]': {
    note: '按设施数叠加（每间设施 +4%，最多 5 间）',
    effects: [
      { type: 'hireSpeed', room: 'HIRE', unit: 'percent', target: 'room', value: 30, stacking: 'stack' },
      { type: 'hireSpeed', room: 'HIRE', unit: 'percent', target: 'room', value: 4, per: 'facilityCount', cap: 5, factionId: 'elite', factionName: '精英干员', stacking: 'stack' },
    ],
  },

  // 「如果目标是怪物猎人小队成员和泡影国狩猎小队，则恢复效果额外+0.45」  // 目标筛选是标签，原解析只留下 targetIs 自由文本，缺 tagId。
  'dorm_rec_single&tag[000]': {
    note: '额外 +0.45 仅对两个标签的干员生效，且同样排除自身',
    effects: [
      { type: 'moodRecovery', room: 'DORMITORY', unit: 'perHour', target: 'dormitory', excludeSelf: true, value: 0.55, condition: { type: 'targetMoodNotFull' }, stacking: 'max' },
      { type: 'moodRecovery', room: 'DORMITORY', unit: 'perHour', target: 'dormitory', excludeSelf: true, value: 0.45, condition: { type: 'targetIs', tagIds: ['mh', 'mh2'], tagNames: ['怪物猎人小队', '泡影国狩猎小队'] }, stacking: 'stack' },
    ],
  },

  // 「每完整协助完成1次专精训练，累计一定武道。武道达到上限时，下一次开始协助
  // **近卫**干员训练专精技能至**1**级将立即完成」：职业与等级都在正文里，
  // 但整句被并进 condition.text，原解析只留 assistSession，任意职业都会触发"立即完成"。
  'train_spd_bd&reduceTime[000]': {
    note: '立即完成只对近卫干员的 1 级专精生效，且需武道攒满',
    effects: [
      {
        type: 'trainingSpeed', room: 'TRAINING', target: 'trainee', value: 1, unit: 'flag', subtype: 'instantComplete',
        resourceName: '武道', profession: '近卫',
        condition: { type: 'trainToLevel', level: 1, extra: [{ type: 'assistSession' }] },
        stacking: 'stack',
      },
    ],
  },

  // 「控制中枢内每个鲤氏侦探事务所干员**可使该派系干员额外恢复心情**，同时每人可使控制中枢内
  // 所有干员的心情每小时恢复+0.2」：前半句在原始数据里完全没有数值（概念型加成），
  // 不落一条 effect 下游会以为它不存在。
  'control_mp_cost&faction2[000]': {
    note: '前半句无数值（同派系额外恢复，概念型），后半句 +0.2 按 lda 人数叠加',
    effects: [
      { type: 'moodRecovery', room: 'CONTROL', unit: 'perHour', target: 'control', value: 0.2, per: 'factionMember', perValue: 1, factionId: 'lda', factionName: '鲤氏侦探事务所', stacking: 'stack' },
      { type: 'specialBonus', room: 'CONTROL', target: 'roomMembers', value: 1, unit: 'flag', subtype: 'extraMoodRecovery', factionId: 'lda', factionName: '鲤氏侦探事务所', per: 'factionMember', perValue: 1, stacking: 'special' },
    ],
  },
}
