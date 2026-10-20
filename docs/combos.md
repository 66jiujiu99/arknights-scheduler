# 组合（`public/data/v5/combos.json`）

组合只做两件事：**让优化器优先把这些人放在一起**，以及**在计划里标出命中的组合**。
数值本身来自 `operators.json` 的 `effects`，不是这份文件。

## 数据流

```
scripts/combos.source.json   （手写，成员用中文名）
        │
        ├─ build 时解析成 charId
        └─ 同时从 effects 派生「同房间具名干员」配对
                    ↓
public/data/v5/combos.json
```

`npm run build:data` 每次重建，`meta` 里会写 `handwritten` / `derived` 两个计数。

## 两种来源

| 来源 | 标记 | 数值怎么算 | 例子 |
| --- | --- | --- | --- |
| 自动派生 | `appliedByEffects: true` | 由 `effects` 的 `condition` 求值（`optimizer.js` 的 `companionEfficiency` / `companionMoodDelta`），combos 里**不再加数值** | 德克萨斯 + 拉普兰德（`withCharInRoom`）、摩根 + 推进之王、蕾缪安 + 能天使 |
| 手写 | 无该标记 | `effect.tradeEfficiency` 等直接加到房间效率上 | Mujica 五人（热情值体系）、彩虹小队、令/夕/重岳、巫恋 + 柏喙、菲亚梅塔 + 巫恋 |

**派生规则**：某条 `effects` 的 `condition.type` 是 `charInRoom` / `withCharInRoom` 且带具名干员，
就在该效果所在房间生成「本人 + 该干员」组合。
`factionInRoom`（「当前贸易站内存在某阵营干员」）没有固定成员表，不生成两人组合；
`charInBase`（「在基建内」）不是同房间条件，也不生成。

## 为什么要有 `appliedByEffects`

条件型效果（「当与 X 同站时 +65%」）**不会**进入静态值 `percent`/`mood`
（见 `scripts/lib/effects.mjs` 的 `COMPANION_CONDITION_TYPES`），
否则等于无条件生效。既然如此，数值只能在编制确定后求值一次；
combos 里若再叠加一次，就是德克萨斯 65% + 65% = 130% 的重复计数。

派生组合仍然会被标成"命中"（`score.combos`），只是不加数值，界面照常展示。

## 校验

```bash
node scripts/check-combos.mjs     # 或 npm run check:combos
```

两个方向都查：

1. `effects` 里每个「具名干员同房间」条件，`combos.json` 必须有对应组合（防止漏组合）；
2. 每个 `appliedByEffects` 组合必须真能在 `effects` 里找到依据（防止留下过期条目）。

当前规模：**37 条**（手写 6 + 派生 31），阵营型条件 9 条（不生成两人组合）。
