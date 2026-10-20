# 干员基建技能数据 schema（v2）

目标：让排班程序能直接读取「技能数值 + 生效对象 + 生效条件 + 阵营/心情机制」，不靠中文描述猜。

- 解析器：[scripts/lib/effects.mjs](../scripts/lib/effects.mjs)
- 生成脚本：`node scripts/build-base-data.mjs`
- 校验脚本：`node scripts/check-effects.mjs`
- 审核报告：[docs/effects-audit-2026-10.md](effects-audit-2026-10.md)

## 与 v1 的区别

| 维度 | v1 | v2 |
| --- | --- | --- |
| 来源 | 按中文描述正则粗分 | 解析官方标记 + 官方产物 targets |
| 产物匹配 | 靠描述关键词 | 用官方 buff.targets（F_GOLD / F_EXP / F_DIAMOND 等） |
| 心情 | 单个 mood 字段，正负靠描述猜 | moodRecovery / moodCost / moodCostReduction 分开 |
| 条件 | 布尔 conditional | condition: { type, threshold, ... } |
| 阵营 | 文本 | factionId + per=factionMember |
| 覆盖 | 部分 | 929/929 条技能都有 effects |

## 技能字段

\`\`\`json
{
  "buffId": "control_mp_cost&faction[000]",
  "room": "CONTROL",
  "name": "德才兼备",
  "phase": 0,
  "level": 1,
  "text": "进驻控制中枢时，控制中枢内每个龙门近卫局干员可使控制中枢内所有干员的心情每小时恢复+0.05",
  "rawText": "进驻控制中枢时，控制中枢内每个<@cc.g.lgd><@cc.kw>龙门近卫局</></>干员…",
  "effects": [ /* 见下 */ ],
  "manualReview": null
}
\`\`\`

- `phase` / `level`：解锁所需的精英化阶段与干员等级。
- `effects`：机器可读的效果列表，排班应只读这里。
- `manualReview`：描述中仍有无法从句式归类的补充从句时才非 null；主效果已解析。
- `percent` / `mood` / `orderLimit` / `capacity` / `value`：由 effects 反推的兼容字段，
  保留给旧代码过渡用，新代码请用 `effects`。

## effect 字段

\`\`\`json
{
  "type": "moodRecovery",
  "room": "CONTROL",
  "unit": "perHour",
  "target": "control",
  "value": 0.05,
  "per": "factionMember",
  "factionId": "lgd",
  "factionName": "龙门近卫局",
  "stacking": "stack",
  "source": "control_mp_cost&faction[000]",
  "text": "控制中枢内每个龙门近卫局干员可使控制中枢内所有干员的心情每小时恢复+0.05"
}
\`\`\`

| 字段 | 含义 |
| --- | --- |
| `type` | 见下节；moodRecovery 是恢复，moodCost 是消耗，moodCostReduction 是消耗减少（收益） |
| `room` | 生效设施：MANUFACTURE / TRADING / POWER / CONTROL / DORMITORY / MEETING / HIRE / TRAINING / WORKSHOP / RECYCLE |
| `target` | self / room / roomMembers / control / dormitory / otherFacilities / partialFacilities / allManufacture / allTrading / allDormitory / meeting / hire / trainingRoom / trainee / facilityCount |
| `value` | 数值。心情类恒为正、方向由 type 表达；orderLimit 可正可负；flag 类为 1 |
| `unit` | percent / perHour / orders / slots / count / mood / probability / points / flat / flag |
| `product` | 产物筛选：贵金属 / 作战记录 / 源石 / 技巧概要 / 精英材料 / 基建材料 / 芯片 |
| `per` | 叠加单位：factionMember / tagMember / operator / resourcePoint / powerStation / hireSlot / goldLine / token / skillClass / capacity / orderLimit / droneCap / efficiency / roomLevel |
| `perValue` | “每 N”里的 N，缺省 1 |
| `factionId` / `tagId` / `profession` | 触发主体筛选 |
| `cap` | 叠加上限（最多 N / 上限 N） |
| `condition` | { type, text, threshold?, char?, room?, branch?, level?, hours? } |
| `stacking` | stack（叠加）/ max（同种取最高）/ maxPerTarget / unique / special |
| `addition` | 暖机类：{ initial, step, final } |
| `source` / `text` | 来源 buffId 与中文片段，便于人工核对 |

## effect type 一览

产能类：`productivity`、`orderEfficiency`、`orderLimit`、`capacity`、`goldLine`、`orderQuality`、`orderValue`、`fixedOrder`

心情类：`moodRecovery`、`moodCost`、`moodCostReduction`、`moodCostReset`、`moodRecoveryBlock`、`moodExchange`

设施类：`droneCharge`、`clueSpeed`、`clueBias`、`hireSpeed`、`trainingSpeed`、`recycleEfficiency`、`facilityCount`

加工站：`workshopByproduct`、`workshopMoodCost`、`workshopLmdFree`、`workshopByproductGuarantee`

特殊：`specialResource`、`specialBonus`、`skillClassConvert`、`unknown`（specialResource 含人间烟火 / 感知信息 / 情报储备等）

## 已可支持的计算

- 制造站：按 `product` 与房间产物严格匹配；不匹配不进入加成，不会出现“源石技能加到赤金”。
- 控制中枢：`moodRecovery` / `moodCost` 按 `target` 与 `per=factionMember` 叠加；
  陈的龙门近卫局恢复按同房间 `lgd` 人数计。
- 加工站：心情消耗按配方结算（`workshopMoodCost`，`unit: mood`），不会误当成每小时心情。
- 条件技能：`condition.type` 已分类（`selfMoodAbove`、`withCharInRoom`、`trainToLevel` 等），可按实时状态分支。

## 尚未接入排班（数据已就绪）

- `specialResource` 等特殊资源联动（人间烟火 → 生产力等）。
- `stacking: "max"` 的同种取最高规则，排班仍需按 buffId 去重取最高。
- 跨设施 global 加成的精确叠加上限。
