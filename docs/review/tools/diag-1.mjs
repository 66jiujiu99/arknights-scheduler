// 只读取数/诊断工具：调用解析器，打印 8 条 buff 当前解析结果，以及去掉括号说明后的对照结果。
// 脚本只打印数据，不做任何判断。
import fs from 'node:fs';
import { parseBuff } from '../../../scripts/lib/effects.mjs';

const bd = JSON.parse(fs.readFileSync('../arknights-research/raw/building_data.json', 'utf8'));
const ids = Object.keys(bd.buffs).filter((k) => k.startsWith('trade_ord_wt'));

for (const id of ids) {
  const b = bd.buffs[id];
  const out = parseBuff(b);
  console.log(`\n=== ${id} (${b.buffName}) ===`);
  console.log('原文:', b.description);
  console.log('parseBuff 结果:', JSON.stringify(out));
  // 对照实验：去掉「（工作时长影响概率）」
  const alt = { ...b, description: b.description.replace(/（工作时长影响概率）/g, '') };
  console.log('去掉括号后:', JSON.stringify(parseBuff(alt)));
  // 对照实验：把「小幅提升/提升」去掉，只留订单质量从句
  const alt2 = { ...b, description: b.description.replace(/^进驻贸易站时，/, '') };
  console.log('去掉前置从句:', JSON.stringify(parseBuff(alt2)));
}
