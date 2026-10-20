// 只读：按类别打印变化明细（供人工逐条读原文判断）
import fs from 'node:fs';
const REPO = 'C:/Data/deepseek/arknights-scheduler';
const raw = fs.readFileSync(`${REPO}/docs/review/tools/regress-scan.txt`, 'utf8');
const blocks = raw.split(/\n(?==== )/).slice(1);
const cat = process.argv[2];
const pat = {
  target: /target /,
  count: /条数 /,
  level: /level /,
  profession: /profession /,
  per: /per |perValue /,
  clue: /faction|factionId|clueNo|clueTarget/,
  value: /value |cap |type /,
  cond: /cond/,
}[cat];
const picked = blocks.filter((b) => pat.test(b.split('\n')[0]));
console.log(`[${cat}] 命中 ${picked.length} 条\n`);
for (const b of picked) console.log(b.replace(/\n 旧: /, '\n 旧: ').replace(/\n 新: /, '\n 新: '), '\n');
