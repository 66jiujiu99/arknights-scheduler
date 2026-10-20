// 只读：紧凑打印所有 condition 相关变化（id + 变化签名 + 原文），供人工判断
import fs from 'node:fs';
const REPO = 'C:/Data/deepseek/arknights-scheduler';
const raw = fs.readFileSync(`${REPO}/docs/review/tools/regress-scan.txt`, 'utf8');
const blocks = raw.split(/\n(?==== )/).slice(1);
for (const b of blocks) {
  const lines = b.split('\n');
  const head = lines[0].replace('=== ', '');
  if (!/cond/.test(head)) continue;
  const desc = (lines.find((l) => l.includes('原文:')) || '').replace(/^\s*原文:\s*/, '');
  console.log(head);
  console.log('   ' + desc);
}
