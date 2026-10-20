# 干员基建技能 effects 人工核对总结（763 条全量）

- 核对对象：`public/data/v5/operators.json` 的 `characters[].skills[].effects`（929 条技能 / **763 个唯一 buffId**）
- 权威来源：`arknights-research/raw/building_data.json` 的 `buffs[].description`（中文原文）
- 分工：按唯一 buffId 切成 10 批（763 = 77×9 + 70），10 名审核员并行，每人只核自己的批
- 方法：统一使用 `docs/review/tools/dump.js` **分批取数打印**（每批 8~12 条），**每条判定由审核员读中文原文后人工做出**；明令禁止自动比对/自动打分
- 全程**只读**，未修改任何数据文件或代码

## 总统计

| 项目 | 数量 | 占比 |
| --- | --- | --- |
| 核对条数 | **763** | 100% |
| 正确 | **534** | 70.0% |
| 错误 | **180** | 23.6% |
| 存疑 | **49** | 6.4% |

三档合计 = 763，与核对总数一致。

## 分批明细

| 批次 | 房间范围 | 核对 | 正确 | 错误 | 存疑 | 错误率 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | CONTROL | 77 | 45 | 26 | 6 | 33.8% |
| 2 | CONTROL + MANUFACTURE | 77 | 64 | 8 | 5 | 10.4% |
| 3 | MANUFACTURE + TRADING | 77 | 54 | 15 | 8 | 19.5% |
| 4 | TRADING | 77 | 47 | 28 | 2 | 36.4% |
| 5 | WORKSHOP | 77 | 59 | 12 | 6 | 15.6% |
| 6 | WORKSHOP + DORMITORY | 77 | 60 | 2 | 15 | 2.6% |
| 7 | DORMITORY + TRAINING | 77 | 46 | 31 | 0 | 40.3% |
| 8 | TRAINING + MEETING | 77 | 40 | 30 | 7 | 39.0% |
| 9 | MEETING + HIRE | 77 | 62 | 15 | 0 | 19.5% |
| 10 | HIRE + POWER + RECYCLE | 70 | 57 | 13 | 0 | 18.6% |
| **合计** | | **763** | **534** | **180** | **49** | **23.6%** |

逐条明细见 [核对-1.md](核对-1.md) ~ [核对-10.md](核对-10.md)。

---

## 跨批次系统性问题（按影响面排序）

以下 8 类由**多个审核员在不同房间批次中独立发现并互相印证**，覆盖了 180 条错误的绝大多数。建议按此顺序修复。

### S1. condition 错挂 / 互换（最严重，跨 6 个批次，约 46 条）

「A；如果 C，则额外 B」句式中，本应只限定 B 的条件 C 被同时挂到无条件的 A 上，导致**基础加成被误判为需满足条件才生效**，排班严重低估收益。

更危险的是**条件整体互换**的子类——效果被应用到完全错误的场景。

- 印证：批1（9 条）、批3、批4（8 条）、批7、批8（28 条）、批9（6 条）、批10
- 最坏案例：`control_prod_tra_spd[000]`（望）原文「外势≥实地→贸易站+7%；实地>外势→制造站+2%」，结果两条 effect 的 condition **完全对调**
- 典型：`meet_spd&bd[000]`、「当与提丰一起工作时额外+15%」被挂到基础 +10% 上 → 单人进驻时连基础值都失效
- 修复规则建议：解析「A；如果 C，则 B」时，**C 只挂 B，不挂 A**

### S2. 「X 转化为 Y」的 resourceId 取了消耗品 X 而非产物 Y（跨 3 批）

- `manu_bd_to_bd[000]`（截云）：应为 bd_C（巫术结晶），实为 bd_b1（人间烟火）
- `manu_prod_spd_bd_n1[000]`（迷迭香）：应为 bd_A（思维链环），实为 bd_a1（感知信息）
- `trade_ord_spd_bd_n1[000]`（黑键）：产出「无声共鸣」误用来源 id，与来源同 id 冲突
- 印证：`dorm_rec_bd_n1[000]/[100]` 同类句式**取对了产物**，确认是方向逻辑而非 ID 表缺陷

### S3. 「每 N 个 X」的 per / perValue / factionId 丢失或错配（跨 5 批，约 20 条）

- **丢失**：`control_bd_spd[000]`、「每个进驻在制造站的黑钢国际干员」→ 应为 `target=allManufacture` + `per=factionMember` + `factionId=bs`，实为 `target=room` 且无 per
- **错配**：`manu_prod_spd&power[*]`「每个发电站」应为 `per=powerStation` 实为 `efficiency`；`hire_spd_bd_n1_n1[100]/[300]`「每个招募位」应为 `hireSlot` 实为 `resourcePoint`；多处「每级」应为 `roomLevel` 实为 `resourcePoint`
- **计数维度错**：`hire_spd_tag[000]`「每有一间进驻精英干员的设施」按设施计，实为 `per=factionMember` 按人数计 → 同设施驻 2 人重复计 2 次
- 注：「每 N 点→不是 value」的取值错误只见个别条（见 S5），perValue 整体表现良好

### S4. 第二个限定词 / 第二个效果被吞掉（跨 4 批，约 22 条）

同一句里并列的第二个职业/阵营/效果整条丢失。

- **双职业**：`train_spd_doubleProf*` 13 条——「近卫**与**狙击」只产出 `profession: 近卫`
- **被吞效果**：`trade_ord_wt&cost[*]` 8 条——「（小幅）提升高品质贵金属订单出现概率」完全未结构化；`hire_spd&clue2[*]` 3 条——线索概率未生成 effect
- **分支条件**：训练室分支名（驭法铁卫/速射手/行医…）全库 **0 处**使用 `branch` 字段，只存在于 `condition.text`

### S5. 「最大值 / 上限 / cap」处理不一致（跨 2 批）

- `manu_prod_spd_variable2[000]`（槐琥）：「最多40%」被拆成**独立的 {value:40} effect**，会被当作额外 +40% 重复累加
- 对照：贸易站雪雉同类技能正确处理为 cap=40
- 同类风险：所有「最多+N%」句式都需复查是否多生成了一条带 value 的 effect

### S6. 「除自身以外」漏 excludeSelf（跨 2 批，约 9 条）

- 批7：宿舍「额外+X」第二段 5 条
- 批4：贸易站 `trade_ord_spd&share[000~002]` 3 条
- 批10：`power_rec_rhine[000]` 1 条 → **说明不限于宿舍，需全局修复**

### S7. 加工站材料子类被泛化为大类（批5，11 条）

`detectProduct()`（`scripts/lib/effects.mjs:478-487`）优先采用 buff 官方 `targets`（多为 `F_EVOLVE`→精英材料），而**回退到描述关键词**被跳过。

- 后果：熔泉「加工**异铁**类材料时+90%」被写成 `product: 精英材料` → 排班会把它套用到**全部精英材料**配方，覆盖面被显著放大
- 修复建议：WORKSHOP 房间改为「先取描述关键词，取不到再用 targets」

### S8. 「加工心情消耗为 N 的配方」阈值丢失（批6，2 条）

- `workshop_formula_rub[000]`（休谟斯，阈值 2）、`workshop_proc_cost[000]`（罗小黑，阈值 8）
- 解析器已有可用字段（`recipeMoodCostAtLeast`，全库 13+ 条在用），只是没对 `workshopByproduct` 走这条路

---

## 单独高危错误（虽非系统性，但后果严重）

| buffId | 问题 | 后果 |
| --- | --- | --- |
| `control_mp_bd_cost_expand[000]` | 阈值 20 被直接写成 `value: 20` | 算出**每小时恢复 +20 心情**的荒谬值 |
| `train_spd_reduceTime[000]/[001]` | 「训练所需**时间**-50%」写成 `trainingSpeed value=-50` | 提速被算成**训练变慢 50%** |
| `workshop_formula_cost[010]`（年） | `moodCost + perHour`（全库唯一 WORKSHOP 下 moodCost） | 加工心情被误算成每小时心情 |
| `workshop_formula_cost5[000]` | 同上 + type 应为 workshopMoodCost 实为 moodCostReduction | 方向反转 + 单位错误 |
| `dorm_recExcludeOther[000]` | `moodRecoveryBlock` value=0（flag 类应为 1） | 0 被当作无效果，机制失效 |
| `trade_ord_spd_variable3[000]`（锏） | 「每5个订单上限」被解析成独立 `orderLimit+5` | **凭空真的加了 5 个订单上限** |

---

## 需 lead 拍板的项目口径问题（审核员未据此判错）

1. **`unit: percent` vs `probability`**：schema 文档写 `workshopByproduct` 应为 `probability`，但全库 91 条一律 `percent`，且 `probability` 出现 0 次。是否全库改名？
2. **flag 类 `value`**：schema 写「flag 类为 1」，但如 `control_facCostReset[000]`、`moodRecoveryBlock` 实际为 0，且全表多条例一致。以哪边为准？
3. **`target: room` vs `self`**：`manu_skill_spd1[*]` 等「为自身」记为 `room`，而全库 `productivity` 类 `target=self` 出现 0 次。是否统一？
4. **`profession` 能否存分支名**：「每名**行医**干员」——「行医」是分支不是八职业，能否直接存进 `profession`？还是必须引入 `branch`（当前全库 0 处使用）？
5. **`condition.type: other` 泛滥**：多批指出「当 X 进驻在 Y」这类条件应当落成 `withCharInRoom` + `char` + `room` 等结构化字段，全库已有成熟范式却在部分条中未使用。是否统一收敛？

---

## 已验证为「非问题」的担忧项

- **宿舍心情方向写反**：批7 确认 28 条宿舍技能 `moodRecovery`/`moodCost` 方向全部正确
- **加工心情消耗误写 perHour**：全库 29 条 `workshopMoodCost` 中 28 条 `unit=mood` 正确，仅 1 条漏判
- **「每N个X」的 N 被误写成 value**：批10 确认 42 条分支技能 perValue/cap 全部正确
- **暖机 addition**：多数 `{initial, step, final}` 与原文吻合，仅个别漏结构化

## 修复优先级建议

1. **P0**：S1 condition 错挂/互换（约 46 条，直接导致排班算错）
2. **P0**：单独高危错误表中 6 条（数值荒谬或方向反转）
3. **P1**：S2 转化方向、S7 材料泛化、S8 阈值丢失（均有明确对照样例，可批量修）
4. **P2**：S3 per 错配、S4 第二限定词丢失、S5 cap 不一致、S6 excludeSelf
5. **P3**：54 条存疑 + 上述 5 项口径问题，需统一口径后再处理
