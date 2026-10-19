# 任务提示词：干员基建技能 effects 全量审核

> 用途：明天用免费 token 跑；先完成数据审核，再让排班算法完全依赖 effects。
> 仓库：`C:/Data/deepseek/arknights-scheduler`

## 背景

当前 v5 已经能读取 `public/data/v5/operators.json`，里面 432 名干员、929 条基建技能。
每条技能已经有基础字段（room、phase、level、subcategory、value、mood、orderLimit、capacity、conditional）和 v1 `effects`，但：

- 部分技能的 effects 仍是按描述正则粗分；
- 阵营、条件、全局加成、特殊叠加规则没有全部结构化；
- 排班算法仍混用旧字段（`mood`、`value`）和 effects。

## 目标

把 432 名干员 / 929 条技能的基建机制整理成程序可读、可测试的 `effects`，让排班只依赖 effects，不靠中文描述猜。

## 必须先读

1. `docs/operator-skill-schema.md`：v1 schema、effect 类型、target、per、faction 约定。
2. `scripts/build-base-data.mjs`：从 `building_data.json` / `character_table.json` 生成 operators.json。
3. `src/core/optimizer.js`：当前排班与心情逻辑。
4. `public/data/v5/operators.json`：当前输出数据。

## 数据源

- 游戏数据（本地）：
  - `C:/Data/deepseek/arknights-research/raw/building_data.json`
  - `C:/Data/deepseek/arknights-research/raw/character_table.json`
- 生成命令：

```bash
node scripts/build-base-data.mjs \
  --building ../arknights-research/raw/building_data.json \
  --characters ../arknights-research/raw/character_table.json
```

## 审核范围

逐条检查 929 条技能，至少覆盖：

1. **制造站产物匹配**：贵金属 / 作战记录 / 源石 / 通用 / 仓库；不匹配不得进入加成。
2. **贸易站**：订单效率、订单上限、订单质量、特殊订单；不同策略（龙门商法 / 开采协力）适用范围。
3. **控制中枢**：
   - 制造加成、贸易加成、心情恢复、心情消耗；
   - 阵营人数叠加：陈/龙门近卫局、岁、深海猎人、异格、彩虹小队、乌萨斯学生自治团、米诺斯、谢拉格等；
   - “控制中枢内所有干员”“其他设施”“宿舍”等 target 区分。
4. **特殊/条件技能**：
   - 当自身心情 >12 / <12；
   - 与特定干员同房间；
   - 心情消耗为代价、恢复为正收益；
   - 特殊叠加规则、上限、取最高。
5. **发电站、会客室、办公室、训练室、加工站、回收站、宿舍** 的数值与目标。
6. **精英化/等级要求**：phase/level 是否正确；建议同时保留 `evolveCosts`。

## 输出 schema（v2 建议）

每条 skill：

```json
{
  "buffId": "...",
  "room": "CONTROL",
  "name": "德才兼备",
  "phase": 0,
  "level": 1,
  "effects": [
    {
      "type": "moodRecovery",
      "target": "control",
      "per": "factionMember",
      "factionId": "lgd",
      "value": 0.05,
      "unit": "perHour",
      "condition": null,
      "stacking": "stack",
      "source": "control_mp_cost&faction[000]"
    }
  ],
  "manualReview": null
}
```

要求：

- 每条 skill 必须有 `effects` 数组；无法结构化的写 `effects: []` 并在 `manualReview` 写原因。
- 不再只靠 `skill.mood` 判断正负；`moodRecovery` 是恢复，`moodCost` 是消耗。
- 阵营用 `factionId`（如 `lgd`、`sui`、`abyssal`、`sp`、`R6`、`ussg`、`minos`、`karlan`），并用 `per: "factionMember"` 表示按人数叠加。
- 条件技能写 `condition: { type, text, threshold }`，不要只留中文。
- 保留旧字段兼容，但排班计算逐步改为读 effects。

## 验收标准

1. `operators.json` 中每条 skill 都有 `effects` 数组。
2. 陈的「德才兼备」解析为 `moodRecovery / control / factionMember / lgd / 0.05`。
3. 控制中枢能按同房间 lgd 人数叠加陈的恢复；控制中枢心情统计正确。
4. 制造站不会把源石/作战记录技能放进赤金产物（已有回归用例）。
5. 所有现有测试通过，并新增至少 10 条特殊机制用例。
6. 输出审核报告：总技能数、已完整结构化数、`manualReview` 数、未覆盖机制清单。
7. 构建通过；不提交任何凭证或本地缓存。

## 实施顺序

1. 先跑现有测试基线。
2. 扩充 `effectsOf` 解析器，优先覆盖控制中枢心情/阵营、贸易、制造产物。
3. 逐房间抽查 + 自动校验脚本：缺 effects、未知 type、factionId 未知、value 异常。
4. 修改 optimizer 只读 effects 计算；保留旧字段 fallback 一个版本。
5. 加测试、构建、部署 Cloudflare，真实账号 E2E。
6. 中文提交，正文写验证结果。

## 非目标

- 不重做 UI。
- 不改变当前目标/瓶颈/搓玉逻辑，除非 effects 明确要求。
- 不引入新依赖，除非必要。
