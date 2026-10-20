// 只读取数/诊断工具：打印 tokenize 的 plain 文本、以及 orderQuality 相关正则在 plain 上的匹配位置。
// 脚本只打印数据，不做判断。
import fs from 'node:fs';
import { tokenize } from '../../../scripts/lib/effects.mjs';

const bd = JSON.parse(fs.readFileSync('../arknights-research/raw/building_data.json', 'utf8'));
const b = bd.buffs['trade_ord_wt&cost[000]'];
const t = tokenize(b.description);
console.log('description :', JSON.stringify(b.description));
console.log('plain       :', JSON.stringify(t.plain));

const table = [
  ['orderQuality', /高品质订单|高品质贵金属订单|订单质量/],
  ['clueBias(出现概率)', /出现概率|产出概率/],
  ['orderEfficiency', /订单获取效率|订单效率/],
];
for (const [name, re] of table) {
  const m = t.plain.match(re);
  console.log(`  ${name.padEnd(20)} match=${m ? JSON.stringify({ index: m.index, text: m[0] }) : 'null'}`);
}
// 逐字符打印 plain 的前 40 个字符码点，确认是否有隐藏标记
console.log('前40字符码点:', [...t.plain.slice(0, 40)].map((c) => c).join(''));
