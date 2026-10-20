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
    note: '发电站「除自身以外的莱茵生命干员」：只有额外那条排除自身；且「基建内（不包含副手…）」要带 excludeAssist',
    expectLength: 2,
    expect: [{ excludeSelf: undefined }, { value: 3, excludeSelf: true, excludeAssist: true, factionId: 'rh' }],
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
    note: '加工手性屈光体或重相位对映体：两种材料都要覆盖，不能只取第一个',
    expect: [{ type: 'workshopByproduct', product: '手性屈光体/重相位对映体' }],
  },
  {
    buffId: 'workshop_formula_lolxh[000]',
    note: '「全部除以4」是除法，不能兜底成 increase(+4)',
    expect: [{ type: 'workshopMoodCost', value: 4, unit: 'mood', subtype: 'divide' }],
  },
  {
    buffId: 'workshop_formula_cost&dorm[000]',
    note: '配方阈值4 与「宿舍每10名心情<12干员」并存，且按人数叠加（分母 10 不能丢成 1）',
    expect: [{
      type: 'workshopMoodCost', value: 1, per: 'operator', perValue: 10,
      condition: { type: 'recipeMoodCost', threshold: 4 },
      // 「宿舍内每有10名心情12以下的干员」是并列条件，落 condition.extra（决策 7）
      'condition.extra.0.type': 'dormLowMoodCount',
      'condition.extra.0.threshold': 12,
    }],
  },
  {
    buffId: 'control_clue_cost&faction[990]',
    note: 'excludeSelf 只属于心情消耗那条，不能传染给 clueBias',
    expect: [{ type: 'clueBias', excludeSelf: undefined }, { type: 'moodCost', excludeSelf: true }],
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
    note: '人间烟火 → 巫术结晶，产物记 bd_C，转化源记 bd_b1，每 5 点换 1 点',
    expect: [{ resourceId: 'bd_C', sourceResourceId: 'bd_b1', perValue: 5 }],
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

  // ── 会客室线索派系（clueNo / clueTarget / guarantee） ──────────────────
  {
    buffId: 'meet_flag[010]',
    note: '山·哥伦比亚史：线索不是莱茵生命时增加莱茵生命线索概率 → clueNo=1',
    expectLength: 1,
    expect: [{
      type: 'clueBias', clueNo: 1, factionId: 'rh', factionName: '莱茵生命',
      condition: { type: 'clueNotFaction', clueNo: 1 },
    }],
  },
  {
    buffId: 'meet_flag[060]',
    note: '极境·插旗：罗德岛制药是第 7 号线索（原文只有普通关键词，没有阵营标记）',
    expectLength: 1,
    expect: [{ type: 'clueBias', clueNo: 7, factionId: 'rhodes', factionName: '罗德岛制药' }],
  },
  {
    buffId: 'meet_spd_notOwned[000]',
    note: '晓歌：更容易获得尚未拥有的线索——「尚未拥有的」是线索范围，不能当成派系名',
    expect: [{
      _any: true, type: 'clueBias', clueTarget: 'notOwned',
      factionName: null, clueNo: null,
    }],
  },
  {
    buffId: 'meet_spd&condChar_mustget[000]',
    note: '霍尔海雅：独自工作 + 连续消耗 16 点心情 → 必定获得第 1 号线索，两个条件都要在',
    expectLength: 1,
    expect: [{
      type: 'clueBias', clueNo: 1, guarantee: true,
      condition: { type: 'afterMoodSpent', threshold: 16, 'extra.0.type': 'aloneInRoom' },
    }],
  },
  {
    buffId: 'meet_spd&team[010]',
    note: '塞雷娅·守望者：搜集速度 +10% 与莱茵生命线索倾向是两条独立效果',
    expectLength: 2,
    expect: [
      { type: 'clueSpeed', value: 10 },
      { type: 'clueBias', clueNo: 1, condition: { type: 'workTimeAffectsProbability' } },
    ],
  },
  {
    buffId: 'meet_team&char[000]',
    note: '哈洛德：提升会客室内另一干员所属派系线索倾向，没有另一干员则不提升',
    expectLength: 1,
    expect: [{
      type: 'clueBias', scope: 'roomMemberFaction',
      condition: { type: 'needsOtherOperatorInRoom' },
    }],
  },

  // ── 无数字的「质变型」指标：订单品质 ──────────────────────────────────
  {
    buffId: 'trade_ord_wt&cost[000]',
    note: '柏喙·裁缝α：小幅提升高品质贵金属订单概率——原文没有百分比，用 level 表达档位',
    expectLength: 2,
    expect: [
      {
        _any: true, type: 'orderQuality', value: 1, unit: 'flag', level: 'small',
        product: '贵金属', condition: { type: 'workTimeAffectsProbability' },
      },
      { _any: true, type: 'moodCostReduction', value: 0.25 },
    ],
  },
  {
    buffId: 'trade_ord_wt&cost[010]',
    note: '柏喙·裁缝β：「提升」（没有「小幅」）比 α 高一档 → level normal',
    expect: [{ _any: true, type: 'orderQuality', level: 'normal', product: '贵金属' }],
  },

  // ── 暖机句式（无「首小时」） ─────────────────────────────────────────
  {
    buffId: 'manu_prod_spd_addition[100]',
    note: '阿罗玛：生产力每小时+2%，最终达到+20% —— 必须是 1 条 effect，value 取最终值',
    expectLength: 1,
    expect: [{
      type: 'productivity', value: 20, warmup: true,
      addition: { initial: 2, step: 2, final: 20 },
    }],
  },

  // ── 加工站强制副产品与 T3 前提 ───────────────────────────────────────
  {
    buffId: 'workshop_formula_drop[020]',
    note: '洛洛：「聚酸酯组」的「组」是材料名的一部分，不能剥掉；T3 前提要结构化',
    expectLength: 1,
    expect: [{
      type: 'workshopByproduct', subtype: 'forceByproduct', forced: '聚酸酯组',
      condition: { type: 'byproductTier', threshold: 3 },
    }],
  },

  // ── 特殊资源 id ─────────────────────────────────────────────────────
  {
    buffId: 'manu_prod_bd[000]',
    note: '导火索：每有1瓶乌萨斯特饮 → per=resourcePoint 且必须知道是哪种资源',
    expect: [{ _any: true, type: 'capacity', per: 'resourcePoint', resourceId: 'bd_tachanka', resourceName: '乌萨斯特饮' }],
  },

  // ── flag 类 value 统一为 1 ───────────────────────────────────────────
  {
    buffId: 'trade_ord_vodfox[000]',
    note: '巫恋：其他干员订单效率全部归零（flag 语义在 resets），且「每人+45%」逐人叠加',
    expect: [
      { _any: true, type: 'resetOthers', value: 1, resets: 'orderEfficiency' },
      { _any: true, type: 'orderEfficiency', value: 45, per: 'operator', perValue: 1 },
    ],
  },
  {
    buffId: 'dorm_exchangeAp[000]',
    note: '菲亚梅塔：互换心情是布尔机制，value 应为 1',
    expect: [{ _any: true, type: 'moodExchange', value: 1 }],
  },

  // ── 控制中枢技能作用于其他设施：范围在从句里，不能在效果段丢成 room ────
  {
    buffId: 'control_tra_limit&spd[000]',
    note: '灵知：每个进驻在贸易站的谢拉格干员 → 作用于所有贸易站，且按派系人数叠加',
    expectLength: 2,
    expect: [
      {
        type: 'orderEfficiency', target: 'allTrading', value: -15,
        per: 'factionMember', factionId: 'karlan', factionName: '谢拉格',
      },
      { type: 'orderLimit', target: 'allTrading', value: 6, per: 'factionMember', factionId: 'karlan' },
    ],
  },
  {
    buffId: 'control_tra_limit&spd3[000]',
    note: '凛御银灰：「存在3名谢拉格干员的贸易站」是按站门槛（不是每3人叠加），符合条件的那座站叠加',
    expectLength: 1,
    expect: [{
      type: 'orderEfficiency', target: 'allTrading', value: 10,
      per: 'tradingStation', perValue: 1,
      condition: { type: 'factionCountAtLeast', factionId: 'karlan', threshold: 3 },
    }],
  },
  {
    buffId: 'control_mp_psk[000]',
    note: '焰尾：每个进驻在制造站的红松骑士团干员 → 所有制造站，两条配方各带派系叠加',
    expectLength: 2,
    expect: [
      { type: 'productivity', target: 'allManufacture', value: 10, product: '作战记录', per: 'factionMember', factionId: 'psk' },
      { type: 'productivity', target: 'allManufacture', value: -10, product: '贵金属', per: 'factionMember', factionId: 'psk' },
    ],
  },
  {
    buffId: 'control_mp_bd[000]',
    note: '灰烬：控制中枢内每有1名彩虹小队干员则情报储备+1',
    expectLength: 1,
    expect: [{
      type: 'specialResource', value: 1, per: 'factionMember', perValue: 1,
      factionId: 'R6', factionName: '彩虹小队', resourceId: 'bd_ash', resourceName: '情报储备',
    }],
  },
  {
    buffId: 'control_costToBD[000]',
    note: '令：心情>12 给人间烟火+15、心情≤12 给感知信息+10，两个条件不能互换',
    expectLength: 2,
    expect: [
      { type: 'specialResource', value: 15, resourceId: 'bd_b1', condition: { type: 'selfMoodAbove', threshold: 12 } },
      { type: 'specialResource', value: 10, resourceId: 'bd_a1', condition: { type: 'selfMoodBelow', threshold: 12 } },
    ],
  },

  // ── 第三轮复验发现的问题 ─────────────────────────────────────────────
  {
    buffId: 'manu_prod_spd&limit&bd[000]',
    note: '泰拉大陆调查团：「生产力+5%」是无条件的，只有「每有1个木天蓼+1%」才带条件',
    expectLength: 3,
    expect: [
      { type: 'capacity', value: 8, condition: null },
      { type: 'productivity', value: 5, condition: null },
      { type: 'productivity', value: 1, per: 'resourcePoint', resourceId: 'bd_felyne' },
    ],
  },
  {
    buffId: 'dorm_rec_oneself2[000]',
    note: '芳汀：「每人额外为自身+0.05」同样逐人叠加',
    expect: [{ _any: true, type: 'moodRecovery', value: 0.05, per: 'operator', perValue: 1 }],
  },
  {
    buffId: 'train_spd&profession3[131]',
    note: '「如果训练位干员分支为驭法铁卫」要结构化成分支条件，不能只留中文',
    expect: [{
      _any: true, type: 'trainingSpeed', value: 45, profession: '重装',
      condition: { type: 'traineeBranch', branch: '驭法铁卫' },
    }],
  },
  {
    buffId: 'meet_spd_notOwned&exchange[000]',
    note: '骋风：「处于线索交流时」只在线索交流期间生效，条件不能丢',
    expect: [{ _any: true, type: 'clueBias', clueTarget: 'notOwned', condition: { type: 'clueExchange' } }],
  },
  // ── 回归护栏（第三轮复验确认过的三条） ─────────────────────────────
  {
    buffId: 'control_token_prod_spd[000]',
    note: '作业平台是装置不是干员：必须用 tokenCountAtLeast，不能塞进 charInRoom.char',
    expectLength: 1,
    expect: [{ type: 'productivity', condition: { type: 'tokenCountAtLeast' } }],
  },
  {
    buffId: 'meet_spd&bd[999]',
    note: '「当与虎狼丸进驻会客室一起工作时，更容易获得未拥有线索」：条件要挂在 clueBias 上',
    expect: [{
      _any: true, type: 'clueBias',
      condition: { type: 'withCharInRoom', char: '虎狼丸' },
    }],
  },
  {
    buffId: 'power_rec_spd_P[001]',
    note: '「如果逻各斯进驻在训练室协助位」：房间必须解析成 TRAINING，不能是 null',
    expect: [{
      _any: true, type: 'droneCharge', value: 5,
      condition: { type: 'charInRoom', char: '逻各斯', room: 'TRAINING' },
    }],
  },
  // ── 条件收敛复验（第四轮）：分母从句删掉后必须保留计数域/资源口径 ──────────
  {
    buffId: 'hire_spd_blitz[000]',
    note: '闪击：情报储备与乌萨斯特饮两条 +5%，必须靠 resourceId 区分，不能被去重成一条',
    expectLength: 3,
    expect: [
      { value: 20 },
      { value: 5, per: 'resourcePoint', perValue: 1, resourceId: 'bd_ash' },
      { value: 5, per: 'resourcePoint', perValue: 1, resourceId: 'bd_tachanka' },
    ],
  },
  {
    buffId: 'trade_cost&bd2[000]',
    note: '铎铃：每10点人间烟火额外 -0.01，资源口径不能丢',
    expect: [{ _any: true, value: 0.01, per: 'resourcePoint', perValue: 10, resourceId: 'bd_b1' }],
  },
  {
    buffId: 'control_dorm_bd[000]',
    note: '三角初华：效果在控制中枢，但计数域是「宿舍内」，必须显式记录',
    expect: [{ _any: true, type: 'specialResource', per: 'operator', countScope: { room: 'DORMITORY' } }],
  },
  {
    buffId: 'manu_token_prod_spd[000]',
    note: '阿兰娜：作业平台要数「进驻发电站」的，计数域不能丢',
    expect: [{ _any: true, type: 'productivity', tagId: 'op', countScope: { room: 'POWER' } }],
  },
  {
    buffId: 'control_mp_cost&bd_up[000]',
    note: '重岳：「每个岁干员」按阵营成员计数，排除的只有宿舍（活动室＝PRIVATE 不可进驻，训练室不算）',
    expect: [{
      _any: true, type: 'specialResource', resourceId: 'bd_b1', cap: 5,
      per: 'factionMember', factionId: 'sui', countScope: { excludeRooms: ['DORMITORY'] },
    }],
  },
  {
    buffId: 'manu_prod_spd_bd_n1[000]',
    note: '迷迭香：转化句要同时记产出（bd_A）与转化源（bd_a1）',
    expect: [{
      _any: true, type: 'specialResource',
      resourceId: 'bd_A', sourceResourceId: 'bd_a1', per: 'resourcePoint', perValue: 1,
    }],
  },
  {
    buffId: 'trade_ord_limit_count[000]',
    note: '孑：订单上限有「最少为1」的下限，删条件时不能把下限一起丢掉',
    expect: [{ _any: true, type: 'orderLimit', value: -1, min: 1 }],
  },
  {
    buffId: 'trade_ord_spd&formula[000]',
    note: '石英：数的是配方类别，不是干员人数',
    expect: [{ _any: true, type: 'orderEfficiency', per: 'formulaType', countScope: { room: 'MANUFACTURE' } }],
  },
  {
    buffId: 'dorm_rec_all&tired[000]',
    note: '刺玫：「心情18以下的干员各+0.1」是目标过滤，不是按人数计数',
    expect: [
      { value: 0.15, condition: null },
      { value: 0.1, condition: { type: 'targetMoodBelow', threshold: 18 } },
    ],
  },
  {
    buffId: 'workshop_formula_dorm[000]',
    note: '「宿舍内每有1名心情4以下的干员」才是计数，仍需 dormLowMoodCount',
    expect: [{ _any: true, condition: { type: 'dormLowMoodCount', threshold: 4 }, countScope: { room: 'DORMITORY' } }],
  },
  {
    buffId: 'control_mp_aegir1[000]',
    note: '歌蕾蒂娅：「宿舍以外」的范围要落到条件上，threshold 与 per 重复要去掉',
    expect: [{
      _any: true, type: 'moodCost',
      condition: { type: 'factionInFacility', excludeRooms: ['DORMITORY'], threshold: null },
    }],
  },
  {
    buffId: 'manu_formula_spd&bd[001]',
    note: '怒潮凛冬：同房间的是「阵营」不是具名干员，不能塞进 char',
    expect: [{
      _any: true, value: 10,
      condition: { type: 'withFactionInRoom', factionId: 'ussg', room: 'MANUFACTURE', char: null },
    }],
  },
  {
    buffId: 'control_meeting&mp_cost[000]',
    note: '摆渡人：萨尔贡是阵营，char 字段必须为空',
    expect: [{
      _any: true, type: 'moodCost',
      condition: { type: 'withFactionInRoom', factionId: 'sargon', room: 'CONTROL', char: null },
    }],
  },
  {
    buffId: 'control_token_prod_spd2[000]',
    note: '怪物猎人小队是 tag 标记（$cc.tag.mh），不是阵营',
    expect: [{ _any: true, condition: { type: 'withTagInRoom', tagId: 'mh', room: 'CONTROL' } }],
  },
  {
    buffId: 'trade_ord_spd&tag[010]',
    note: '真言：「每有一间进驻精英干员的设施」按设施数叠加，不是按人',
    expect: [{ _any: true, type: 'orderEfficiency', per: 'facilityCount', cap: 10, factionId: 'elite' }],
  },
  {
    buffId: 'meet_spd_bd[000]',
    note: '双月：「每1点情报储备额外提升5%」是线索搜集速度，不是产出情报储备',
    expect: [
      { value: 5, condition: null },
      { value: 5, type: 'clueSpeed', per: 'resourcePoint', resourceId: 'bd_ash' },
    ],
  },
  {
    buffId: 'workshop_formula_frost[000]',
    note: '霜华：三条都是副产品概率（50/5/15），且 15% 带「乌萨斯特饮达到4瓶」条件',
    expectLength: 3,
    expect: [
      { type: 'workshopByproduct', value: 50 },
      { type: 'workshopByproduct', value: 5, resourceId: 'bd_ash', per: 'resourcePoint' },
      { type: 'workshopByproduct', value: 15, condition: { type: 'resourceAtLeast', threshold: 4 } },
    ],
  },
  // ── 第五轮：阵营/标签名不再塞进 char（含「其他」= 排除自身） ──────────────
  {
    buffId: 'meet_spd&sami[000]',
    note: '提丰：「与其他萨米干员进驻会客室一起工作」是阵营条件 + 排除自身',
    expect: [{
      _any: true, value: 5,
      condition: { type: 'withFactionInRoom', factionId: 'sm', room: 'MEETING', char: null, excludeSelf: true },
    }],
  },
  {
    buffId: 'meet_spd&sami[100]',
    note: '寻澜：黑钢国际是阵营（标记文本自带「干员」后缀，字段只留派系名）',
    expect: [{
      _any: true, value: 15,
      condition: { type: 'withFactionInRoom', factionId: 'bs', factionName: '黑钢国际', char: null, excludeSelf: true },
    }],
  },
  {
    buffId: 'power_rec_spd_ext&faction[000]',
    note: 'CONFESS-47：「如果其他拉特兰干员进驻在发电站」是阵营条件',
    expect: [{
      _any: true, condition: { type: 'withFactionInRoom', factionId: 'laterano', room: 'POWER', char: null, excludeSelf: true },
    }],
  },
  {
    buffId: 'power_rec_spd_ext&tag[000]',
    note: 'GALLUS²：「其他作业平台」是装置标签，用 withTagInRoom',
    expect: [{
      _any: true, condition: { type: 'withTagInRoom', tagId: 'op', room: 'POWER', char: null, excludeSelf: true },
    }],
  },
  {
    buffId: 'hire_spd_tag[000]',
    note: '凯尔希·思衡托：按设施数叠加时，精英干员的约束口径与真言一致，落在效果级 factionId；override 重建后仍要带 excludeAssist',
    expect: [{
      _any: true, value: 4, per: 'facilityCount', cap: 5, factionId: 'elite', condition: null,
      excludeAssist: true,
    }],
  },
  {
    buffId: 'trade_ord_pepe[000]',
    note: '佩佩：固定获取 <$cc.tra.pepe> 特别独占订单，且该类订单不受订单效率影响',
    expect: [{
      _any: true, type: 'fixedOrder', orderTypeId: 'pepe', orderTypeName: '特别独占订单', ignoreOrderEfficiency: true,
    }],
  },
  {
    buffId: 'trade_ord_closure[000]',
    note: '可露希尔：同样要落 orderTypeId，但原文没有「不受订单效率影响」，不能标 ignore',
    expect: [{
      _any: true, type: 'fixedOrder', orderTypeId: 'closure', ignoreOrderEfficiency: null,
    }],
  },
  {
    buffId: 'trade_ord_law[000]',
    note: '但书：「下笔赤金订单交付数小于4则视为违约订单」只对赤金订单生效',
    expect: [{ _any: true, type: 'fixedOrder', product: '贵金属' }],
  },
  {
    buffId: 'trade_ord_par&per[001]',
    note: '赫德雷：「当伊内丝、W入驻工作场所时…分别额外+5%」是两人各 +5%，不能合并成一条',
    expectLength: 3,
    expect: [
      { value: 30, condition: null },
      { value: 5, condition: { type: 'charInRoom', char: '伊内丝', room: 'TRADING', excludeAssist: true } },
      { value: 5, condition: { type: 'charInRoom', char: 'W', room: 'TRADING', excludeAssist: true } },
    ],
  },
  {
    buffId: 'train_spd_bd&reduceTime[000]',
    note: '左乐：「协助近卫干员训练专精技能至1级立即完成」：职业与等级不能丢',
    expect: [{
      _any: true, type: 'trainingSpeed', subtype: 'instantComplete',
      profession: '近卫', condition: { type: 'trainToLevel', level: 1 },
    }],
  },
]
