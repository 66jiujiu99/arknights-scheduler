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
| 阵营 | 文本 | factionId + per=factionMember，角色侧落 `characters[].factions` |
| 覆盖 | 部分 | 929/929 条技能都有 effects |

## 角色字段：`factions`

效果里的 `factionId` 用的是描述标记 `<$cc.g.*>` 的取值（`rh` / `bs` / `R6` / `ussg` …），
与角色表官方的 `nationId` / `groupId` / `teamId` **不是同一套命名**（角色表里是 `rhine` / `blacksteel`）。
生成阶段把它们翻译成 `characters[].factions`（数组，可同时属于多个标记），下游判断写：

\`\`\`js
(x.char.factions || []).includes(effect.factionId)
\`\`\`

映射表在 [scripts/lib/factions.mjs](../scripts/lib/factions.mjs)，逐条都有原始数据依据，注意两点：

- `karlan` 在描述里配的中文是「谢拉格」，按官方 `nationId=kjerag` 匹配，**不是** `groupId=karlan`（喀兰贸易）。
- `Defence` / `Attack`（彩虹小队攻防）在角色表里没有任何字段，只能靠外部 R6S 常识补，表内已注明依据。

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
| `target` | self / room / roomMembers / control / dormitory / otherFacilities / partialFacilities / allManufacture / allTrading / allDormitory / meeting / hire / trainingRoom / trainee / facilityCount / **char（配 `char` 字段，表示点名某名干员）** |
| `char` | 与 `target: "char"` 配对：效果只作用于该名干员（例：丰川祥子、阿米娅） |
| `value` | 数值。心情类恒为正、方向由 type 表达；orderLimit 可正可负；flag 类为 1 |
| `unit` | percent / perHour / orders / slots / count / mood / probability / points / flat / flag |
| `product` | 产物筛选：贵金属 / 作战记录 / 源石 / 技巧概要 / 精英材料 / 基建材料 / 芯片 / 晶体 / 任意类材料 / 装置 / 异铁 / 异铁组 / 聚酸酯 / 源岩 / 酮凝集 / 炽合金块 / 手性屈光体 / 重相位对映体（**保证单值**：「A 或 B」已拆成两条效果） |
| `notDefaultOrder` | 「（不视作违约订单）」：该类订单不属于违约订单 |
| `per` | 叠加单位：factionMember / tagMember / operator / resourcePoint / powerStation / tradingStation / hireSlot（**不含初始招募位**）/ goldLine / token / skillClass（配 `skillClass` 类名）/ capacity / orderLimit / droneCap / efficiency / roomLevel / formulaType（每种配方类别）/ facilityCount（每间满足条件的设施）/ accumulate / **orderCount（每笔订单）/ orderGap（订单数与上限的差额）** |
| `skillClass` | 与 `per: "skillClass"` 配对：标准化 / 莱茵科技 / 红松骑士团 / 金属工艺 |
| `exclude` | 计量基数要排除的部分：`facilityCountBonus`（「不包含根据设施数量提供加成的生产力」） |
| `distribution` | 数值分配方式：`average`（原文「平均分配到总计 +N」，总额在目标间均摊，不能按每人 +N 计算） |
| `count` | 与 `distribution` 同类场景的次数语义（例：恢复一次心情 → `count: 1`） |
| `recipeMoodCostExact` / `recipeMoodCostAtLeast` | 配方心情消耗阈值的两种口径：**精确 N** / **≥N**（原文「心情消耗为 N」vs「为 N 以上」），与 `condition.recipeMoodCost.op`（`eq`/`gte`）一致 |
| `perValue` | “每 N”里的 N，缺省 1 |
| `factionId` / `tagId` / `profession` | 触发主体筛选 |
| `resourceId` / `resourceName` | 分母口径里按哪种特殊资源结算（例：每 1 点**情报储备** +5% 联络速度） |
| `sourceResourceId` / `sourceResourceName` | 转化类：被消耗的资源（例：每 1 点**感知信息** → 1 点思维链环，`resourceId` 记产物、本字段记来源） |
| `countScope` | 计数域：`{ room }` 表示“在哪个房间里数”（例：宿舍内每有 1 名干员 → `{room:"DORMITORY"}`）；`{ excludeRooms }` 表示“排除哪些房间”（例：进驻在宿舍以外的设施 → `{excludeRooms:["DORMITORY"]}`） |
| `min` | 数值下限（例：订单上限 -1，但「订单最少为1」→ `min: 1`） |
| `excludeAssist` | `true` = 该计数不含副手与活动室使用者（原文「基建内（不包含副手及活动室使用者）」；两者本仓库未建模，只能用标志位表达） |
| `orderTypeId` / `orderTypeName` | 固定获取的订单类型（来自 `<$cc.tra.*>` 标记：`pepe` 特别独占订单、`closure` 可露希尔特别订单） |
| `ignoreOrderEfficiency` | `true` = 该类订单不受订单获取效率影响（佩佩「不受任何订单获取效率的影响」） |
| `cap` | 叠加上限（最多 N / 上限 N） |
| `condition` | { type, text, threshold?, op?, char?, room?, faction? / factionId?, tagId? / tagIds?+tagNames?, excludeRooms?, branch?, level?, hours?, per?, perValue?, extra? } |

### 条件里的身份字段（`char` / `factionId` / `tagIds`）

条件的“目标是谁”必须结构化，不能只留在 `condition.text` 里，否则下游无法判定：

| 原文 | 字段 |
| --- | --- |
| 如果目标是**锡兰** | `{ type: "targetIs", char: "锡兰" }` |
| 如果目标是**萨米干员** | `{ type: "targetIs", factionId: "sm", factionName: "萨米" }` |
| 如果目标是**莱欧斯小队干员** | `{ type: "targetIs", tagIds: ["dungeon"], tagNames: ["莱欧斯小队"] }` |
| 当前贸易站内**存在格拉斯哥帮干员**时 | `{ type: "factionInRoom", room: "TRADING", factionId: "glasgow", factionName: "格拉斯哥帮" }` |
| **野鬃所在的**制造站 | `{ type: "charInRoom", char: "野鬃", room: "MANUFACTURE" }` |
| 伊内丝入驻**工作场所**时 | `{ type: "charInRoom", char: "伊内丝", workplace: true }`（`workplace` 表示任意工作设施，不能收窄成效果自身房间） |
| 有 2 台以上**作业平台**进驻在**发电站** | `{ type: "tokenCountAtLeast", threshold: 2, tagId: "op", countScope: { room: "POWER" } }` |

条件的 `op` 字段统一表达比较方向：`eq`（为 N）/ `gte`（N 以上）/ `lte`（N 以下**含 N**）/ `gt`（大于 N）。
`capacityBelow` 与 `capacityAbove` 必带 `op`，避免「正好 16 格两档都不生效」。

订单类条件：`nextOrderAbove` / `nextOrderBelow` / `nextOrderIsDefault`（下笔是违约订单）；
`fixedOrder` 的 `subtype: "treatAsDefault"` 表示「交付数不足则**视为**违约订单」，与「固定获取某类订单」区分。
效果上的 `priority: true` 表示原文「优先生效」（与同种效果取最高之外还优先于其它来源）。
| `stacking` | stack（叠加）/ max（同种取最高）/ maxPerTarget / unique / special |
| `addition` | 暖机类：{ initial, step, final } |
| `source` / `text` | 来源 buffId 与中文片段，便于人工核对 |

### 关于 `countScope` / `resourceId` / `min` / `excludeAssist`

分母从句（「每有 N 点 X」「宿舍内每有 1 名干员」）不写成 `condition`——否则下游会把“每 N”再当成一层触发条件。
但删掉 condition 后，这几类信息没有别处承载，必须显式落字段：

- **在哪个房间数** → `countScope.room`。效果房间与计数房间经常不同（三角初华在控制中枢、按宿舍人数加热情值）。
  `per` 本身就是房间单位时（`powerStation`/`facilityCount`）不再重复记。
- **按哪种资源结算** → `resourceId`；转化类还要写 `sourceResourceId`，否则只剩产物、转化率算不出来。
- **边界值** → `min`。孑「订单上限 -1（订单最少为1）」少了下限就会被算成 0 或负数。
- **谁不算进计数** → `excludeAssist`。副手与活动室使用者在本仓库未建模，只能做标志位。

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
