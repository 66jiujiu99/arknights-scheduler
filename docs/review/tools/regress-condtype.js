// 只读：列出所有 cond.type 变化的 buffId（含旧->新），供覆盖核对
import fs from 'node:fs';
const REPO = 'C:/Data/deepseek/arknights-scheduler';
const raw = fs.readFileSync(`${REPO}/docs/review/tools/regress-scan.txt`, 'utf8');
const blocks = raw.split(/\n(?==== )/).slice(1);
for (const b of blocks) {
  const lines = b.split('\n');
  const head = lines[0].replace('=== ', '');
  const m = head.match(/^(\S+) \[(\S+)\]\s+\{(.*)\}$/);
  if (!m) continue;
  const sig = m[3];
  if (!/cond\.type/.test(sig)) continue;
  const desc = (lines.find((l) => l.includes('原文:')) || '').replace(/^\s*原文:\s*/, '');
  const conds = sig.split('; ').filter((s) => /cond\.type/.test(s)).join(' ; ');
  console.log(`${m[2]}\t${m[1]}\t${conds}\t${desc.slice(0, 70)}`);
}
