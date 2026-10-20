// 只读取数工具：列出 building_data.json 中所有以指定前缀开头的 buffId 及原文。不做任何判断。
import fs from 'node:fs';
const bd = JSON.parse(fs.readFileSync('../arknights-research/raw/building_data.json', 'utf8'));
const prefix = process.argv[2] || 'trade_ord_wt';
const ids = Object.keys(bd.buffs).filter((k) => k.startsWith(prefix));
console.log(`前缀 ${prefix} 共 ${ids.length} 条:`);
for (const id of ids) {
  const b = bd.buffs[id];
  console.log(`  ${id}  [room=${b.roomType}] ${b.buffName} :: ${b.description}`);
}
