# 干员基建技能数据 schema（v1）

目标：让排班程序能直接读取「技能数值 + 生效对象 + 生效条件 + 阵营/心情机制」，而不是只靠中文描述。

## 干员字段

```json
{
  "id": "char_010_chen",
  "name": "陈",
  "rarity": 6,
  "nation": "lungmen",
  "group": "lgd",
  "faction": { "nation": "lungmen", "group": "lgd" },
  "evolveCosts": [
    null,
    [{ "id": "3251", "count": 3, "type": "MATERIAL" }],
    [{ "id": "3253", "count": 3, "type": "MATERIAL" }]
  ],
  "skills": []
}
```

- `evolveCosts[phase]`：从上一阶段升到该精英化阶段所需材料；`phase=1/2` 对应精一/精二。
- `faction.group`：阵营/派系 id，例如 `lgd` 表示龙门近卫局。

## 技能字段

```json
{
  "buffId": "control_mp_cost&faction[000]",
  "room": "CONTROL",
  "name": "德才兼备",
  "phase": 0,
  "level": 1,
  "category": "FUNCTION",
  "subcategory": "心情",
  "mood": 0.05,
  "effects": [
    {
      "type": "moodRecovery",
      "target": "control",
      "value": 0.05,
      "unit": "perHour",
      "per": "factionMember",
      "factionId": "lgd"
    }
  ]
}
```

- `phase` / `level`：技能解锁需要的精英化阶段与干员等级。
- `effects`：机器可读的实际效果列表。

## effect 约定

| 字段 | 含义 |
| --- | --- |
| `type` | `efficiency` / `moodRecovery` / `moodCost` / `orderLimit` / `capacity` / `flat` |
| `target` | `room` / `control` / `dormitory` / `otherFacilities` |
| `value` | 数值；心情单位为每小时 |
| `unit` | `percent` / `perHour` / `orders` / `slots` / `flat` |
| `per` | 可选，`factionMember` 表示按同房间该阵营人数叠加 |
| `factionId` | 与 `per=factionMember` 搭配，例如 `lgd` |
| `conditional` | 可选，表示该效果有触发条件，文本见 `text` |

## 已接入计算

- 制造站产物与技能子类严格匹配：赤金只吃贵金属，作战记录只吃作战记录，源石碎片只吃源石；不匹配不会进入技能加成。
- 控制中枢：`moodRecovery` / `moodCost` 会按 `target` 和 `per=factionMember` 计入控制中枢心情；陈的龙门近卫局心情恢复按同房间 lgd 人数叠加。
- 其他设施：目前使用 `efficiency` / `orderLimit` / `capacity` 等已有字段；`otherFacilities` 的全局心情效果尚未全部接入，schema 已保留。

## 尚未完全接入的机制

- 条件技能（如「当自身心情低于 12」）已标记 `conditional`，但尚未按实时心情分支计算。
- 跨设施 global 加成、特殊叠加上限、阵营专属增益还需要逐条补 `effects` 后再接入。
- 下一步应先把 432 名干员、929 条技能的 `effects` 审核一遍，再让排班完全依赖 effect，而不是描述正则。
