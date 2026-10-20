// 763 条人工核对结论的回归护栏
//
// 来源：docs/review/核对-1.md ~ 核对-10.md（每批 77 条，逐条人工读中文原文判定）
// 用途：锁定 2026-10 这轮反查修正的成果，防止解析器后续重构再次退化。
//
// expect 按 effects 下标对应，每项只写要校验的字段（不写全量，避免加字段就误报）。
// 字段路径支持 "a.b"。值为数组时按集合比较（顺序无关）。

export const CASES = [
  // ── S1 condition 只限定「额外」那段，不能回溯挂到无条件的基础值 ──────────
  {
    buffId: 'train_spd&profession2[110]',
    note: '基础 +30% 无条件；仅额外 +45% 带「专精至1级」',
    expectLength: 2,
    expect: [
      { value: 30, condition: null },
      { value: 45, condition: { type: 'trainToLevel', level: 1 } },
    ],
  },
  {
    buffId: 'trade_ord_spd_ext[000]',
    note: '基础 +25% 无条件；仅额外 +5% 带「乌尔比安在基建内」',
    expectLength: 2,
    expect: [{ value: 25, condition: null }, { value: 5 }],
  },
  {
    buffId: 'meet_spd&bd[000]',
    note: '基础 +10% 无条件；仅额外 +15% 带「与提丰一起工作」',
    expectLength: 3,
    expect: [{ value: 10, condition: null }, { value: 15, condition: { char: '提丰' } }],
  },
  {
    buffId: 'control_meeting&ord[000]',
    note: '两条效果的条件曾被整体互换，现在各归各位',
    expectLength: 2,
    expect: [{ value: 5, condition: { char: '伊内丝' } }, { value: 1, condition: { char: '赫德雷' } }],
  },
  {
    buffId: 'control_prod_tra_spd[000]',
    note: '外势/实地两个分支条件曾被互换',
    expectLength: 2,
    expect: [
      { type: 'orderEfficiency', value: 7, condition: { type: 'resourceCompare', left: '外势', op: 'gte' } },
      { type: 'productivity', value: 2, condition: { type: 'resourceCompare', left: '实地', op: 'gt' } },
    ],
  },
  {
    buffId: 'dorm_rec_oneself2[001]',
    note: '自身 +0.7 无条件；额外 +0.05 才带「宿舍内有其他干员」',
    expectLength: 2,
    expect: [{ value: 0.7, condition: null }, { value: 0.05 }],
  },
  {
    buffId: 'hire_spd_cost&char[001]',
    note: '心情消耗那条不该带「凛御银灰在控制中枢」，条件只属于额外 +10%',
    expectLength: 3,
    expect: [{ value: 35, condition: null }, { type: 'moodCostReduction', value: 0.25, condition: null }, { value: 10 }],
  },

  // ── S3 「每 N 个 X」的叠加单位 ───────────────────────────────────────────
  {
    buffId: 'manu_prod_spd_train&lv[000]',
    note: '训练室每级 → per=roomLevel，且 cap=30',
    expectLength: 1,
    expect: [{ type: 'productivity', value: 10, per: 'roomLevel', cap: 30 }],
  },
  {
    buffId: 'manu_prod_spd&power[000]',
    note: '每个发电站 → per=powerStation（不能落到兜底 efficiency）',
    expect: [{ _any: true, type: 'productivity', value: 5, per: 'powerStation' }],
  },
  {
    buffId: 'hire_spd_bd_n1_n1[100]',
    note: '每个招募位 → per=hireSlot（不能退化成 resourcePoint）',
    expect: [{ _any: true, type: 'specialResource', per: 'hireSlot', value: 10 }],
  },
  {
    buffId: 'dorm_rec_bd_n1_n2[000]',
    note: '当前宿舍每级 → per=roomLevel',
    expect: [{ _any: true, type: 'specialResource', per: 'roomLevel' }],
  },
  {
    buffId: 'manu_constrLv[000]',
    note: '每间设施每级 → per=roomLevel（产物名不是计数单位）',
    expect: [{ _any: true, type: 'specialResource', per: 'roomLevel' }],
  },
  {
    buffId: 'trade_ord_spd&meet[000]',
    note: '会客室每级额外提供 5% → per=roomLevel',
    expect: [{ value: 25, condition: null }, { _any: true, value: 5, per: 'roomLevel' }],
  },

  // ── S4 双职业不能只留第一个 ─────────────────────────────────────────────
  {
    buffId: 'train_spd_doubleProf[000]',
    note: '「近卫与狙击」两个职业都要保留',
    expectLength: 1,
    expect: [{ value: 30, professions: ['近卫', '狙击'] }],
  },
  {
    buffId: 'train_spd_doubleProf3[000]',
    note: '「近卫与狙击」+30%',
    expectLength: 1,
    expect: [{ value: 30, professions: ['近卫', '狙击'] }],
  },
  {
    buffId: 'train_spd_doubleProf2[000]',
    note: '「先锋与特种」两个职业都要保留',
    expect: [{ professions: ['先锋', '特种'] }],
  },

  // ── S6 「除自身以外」必须 excludeSelf（不限宿舍） ───────────────────────
  {
    buffId: 'trade_ord_spd&share[000]',
    note: '贸易站「除自身以外每名干员」',
    expect: [{ type: 'orderEfficiency', per: 'operator', excludeSelf: true }],
  },
  {
    buffId: 'power_rec_rhine[000]',
    note: '发电站「除自身以外的莱茵生命干员」：只有额外那条排除自身',
    expectLength: 2,
    expect: [{ excludeSelf: undefined }, { value: 3, excludeSelf: true }],
  },
  {
    buffId: 'dorm_rec_single_P[000]',
    note: '宿舍「除自身以外」：基础与额外两段都要排除自身',
    expectLength: 2,
    expect: [{ value: 0.55, excludeSelf: true }, { value: 0.45, excludeSelf: true }],
  },

  // ── S5 「最多N%」是 cap，不是独立 effect ────────────────────────────────
  {
    buffId: 'trade_ord_spd_variable2[000]',
    note: '合并为单条：每 5% 效率 +5%，cap 25',
    expectLength: 1,
    expect: [{ value: 5, per: 'efficiency', perValue: 5, cap: 25 }],
  },
  {
    buffId: 'manu_prod_spd_variable2[000]',
    note: '合并为单条：每 5% 效率 +5% 生产力，cap 40',
    expectLength: 1,
    expect: [{ value: 5, per: 'efficiency', perValue: 5, cap: 40 }],
  },
  {
    buffId: 'trade_ord_spd_variable3[000]',
    note: '订单上限是分母，不能变成独立的 orderLimit+5',
    expectLength: 1,
    expect: [{ type: 'orderEfficiency', value: 25, per: 'orderLimit', perValue: 5, cap: 100 }],
  },

  // ── S7 加工站材料子类不能被泛化成「精英材料」 ───────────────────────────
  {
    buffId: 'workshop_formula_device[020]',
    note: '加工异铁类材料',
    expect: [{ type: 'workshopByproduct', value: 90, product: '异铁' }],
  },
  {
    buffId: 'workshop_formula_device[030]',
    note: '加工聚酸酯类材料',
    expect: [{ type: 'workshopByproduct', product: '聚酸酯' }],
  },
  {
    buffId: 'workshop_formula_device[050]',
    note: '加工源岩类材料',
    expect: [{ type: 'workshopByproduct', product: '源岩' }],
  },
  {
    buffId: 'workshop_formula_device[080]',
    note: '加工手性屈光体/重相位对映体',
    expect: [{ type: 'workshopByproduct', product: '手性屈光体' }],
  },

  // ── S8 「加工原始心情消耗为N的材料」阈值要进 condition ──────────────────
  {
    buffId: 'workshop_formula_rub[000]',
    note: '阈值 2 属于筛选条件，不能丢进 manualReview',
    expect: [{ type: 'workshopByproduct', value: 40, condition: { type: 'recipeMoodCost', threshold: 2 } }],
  },
  {
    buffId: 'workshop_proc_cost[000]',
    note: '阈值 8；且不能凭空多出一条「+8 心情」效果',
    expectLength: 1,
    expect: [{ type: 'workshopByproduct', value: 50, condition: { type: 'recipeMoodCost', threshold: 8 } }],
  },

  // ── S2 「X 转化为 Y」的资源 id 取产物 Y ─────────────────────────────────
  {
    buffId: 'manu_bd_to_bd[000]',
    note: '人间烟火 → 巫术结晶，应记产物 bd_C',
    expect: [{ resourceId: 'bd_C' }],
  },

  // ── 方向：训练时间减少 ≠ 训练速度 -50% ──────────────────────────────────
  {
    buffId: 'train_spd_reduceTime[000]',
    note: '「下次训练所需时间-50%」是提速，不能写成 trainingSpeed 负值',
    expectLength: 1,
    expect: [{ type: 'trainingTimeReduction', value: 50, condition: { type: 'shiftHoursAtLeast', hours: 5 } }],
  },

  // ── 加工站心情消耗：单位是「每次加工点数」，且设定值/增减量要可区分 ─────
  {
    buffId: 'workshop_formula_cost[000]',
    note: '心情消耗为4以上全部-2：value=2（4 是阈值），unit=mood，subtype=reduce',
    expect: [{ type: 'workshopMoodCost', value: 2, unit: 'mood', subtype: 'reduce' }],
  },
  {
    buffId: 'workshop_formula_cost[010]',
    note: '相应配方全部+2心情消耗：increase',
    expect: [{ type: 'workshopMoodCost', value: 2, unit: 'mood', subtype: 'increase', condition: undefined }],
  },
  {
    buffId: 'workshop_formula_cost4[000]',
    note: '心情消耗恒定 2：setTo',
    expect: [{ type: 'workshopMoodCost', value: 2, unit: 'mood', subtype: 'setTo' }],
  },

  // ── 阈值不能写成 value ──────────────────────────────────────────────────
  {
    buffId: 'control_mp_bd_cost_expand[000]',
    note: '20 是「每20点人间烟火」的分母，不能是 value',
    expectLength: 2,
    expect: [{ value: 0.05 }, { value: 0.05, per: 'resourcePoint', perValue: 20 }],
  },

  // ── flag 类 value 应为 1 ────────────────────────────────────────────────
  {
    buffId: 'dorm_recExcludeOther[000]',
    note: 'moodRecoveryBlock 是 flag：value=1、target=self',
    expect: [{ type: 'moodRecovery', value: 2 }, { type: 'moodRecoveryBlock', value: 1, target: 'self' }],
  },

  // ── 正向护栏：本来就正确，不能改坏 ─────────────────────────────────────
  {
    buffId: 'control_mp_cost&faction[000]',
    note: '陈·德才兼备：控制中枢内每名龙门近卫局干员恢复 0.05',
    expect: [{ type: 'moodRecovery', target: 'control', per: 'factionMember', factionId: 'lgd', value: 0.05 }],
  },
  {
    buffId: 'dorm_rec_single[000]',
    note: '宿舍单体恢复：排除自身 + 心情未满 + 同种取最高',
    expect: [{ type: 'moodRecovery', target: 'dormitory', excludeSelf: true, value: 0.65, stacking: 'max', condition: { type: 'targetMoodNotFull' } }],
  },
  {
    buffId: 'power_rec_spd[000]',
    note: '发电站无人机充能 +10%',
    expect: [{ type: 'droneCharge', value: 10, unit: 'percent' }],
  },
]
