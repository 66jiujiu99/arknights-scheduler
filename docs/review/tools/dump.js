// 只读取数工具：按清单文件批量打印「原始 description + 解析后 effects」，不做任何判定。
// 用法：node dump.js <清单编号 1-10> [起始行] [条数]
// 输出同时写入 tools/dump-out-<编号>.txt，便于分批阅读。
import fs from 'node:fs';
import path from 'node:path';

const REPO = 'C:/Data/deepseek/arknights-scheduler';
const no = process.argv[2];
const start = Number(process.argv[3] || 1);
const count = Number(process.argv[4] || 25);

const bd = JSON.parse(fs.readFileSync(path.join(REPO, '../arknights-research/raw/building_data.json'), 'utf8'));
const ops = JSON.parse(fs.readFileSync(path.join(REPO, 'public/data/v5/operators.json'), 'utf8'));

const clean = (s) => String(s ?? '')
  .replace(/<@cc\.vup>([^<]*)<\/>/g, '$1')
  .replace(/<@cc\.vdown>([^<]*)<\/>/g, '$1')
  .replace(/<@cc\.rem>([^<]*)<\/>/g, '$1')
  .replace(/<@cc\.kw>([^<]*)<\/>/g, '「$1」')
  .replace(/<@cc\.lkw>([^<]*)<\/>/g, '「$1」')
  .replace(/<@cc\.g\.[a-zA-Z0-9_]+>/g, '')
  .replace(/<\/>/g, '')
  .replace(/<[^>]*>/g, '')
  .trim();

// 清单 -> buffId 列表
const list = fs.readFileSync(path.join(REPO, `docs/review/清单-${no}.md`), 'utf8');
const buffIds = [...list.matchAll(/^- `([^`]+)`/gm)].map((m) => m[1]);

// buffId -> 用到的干员
const users = new Map();
for (const c of Object.values(ops.characters)) {
  for (const s of c.skills || []) {
    if (!users.has(s.buffId)) users.set(s.buffId, new Set());
    users.get(s.buffId).add(c.name);
  }
}
// buffId ->技能对象（同一 buffId 各干员 effects 应一致，取第一个）
const skillOf = new Map();
for (const c of Object.values(ops.characters)) {
  for (const s of c.skills || []) if (!skillOf.has(s.buffId)) skillOf.set(s.buffId, s);
}

const lines = [];
const slice = buffIds.slice(start - 1, start - 1 + count);
lines.push(`=== 清单-${no}  第 ${start}~${start + slice.length - 1} 条（本批共 ${buffIds.length} 条）===`);
for (let i = 0; i < slice.length; i++) {
  const idx = start + i;
  const id = slice[i];
  const b = bd.buffs[id];
  const s = skillOf.get(id);
  lines.push('');
  lines.push(`--- [${idx}] ${id}  涉及：${[...(users.get(id) || [])].join('、')}`);
  if (!b) { lines.push('  !! building_data.json 中无此 buff'); continue; }
  lines.push(`  房间: ${b.roomType}   技能名: ${b.buffName}`);
  lines.push(`  原文: ${clean(b.description)}`);
  if (!s) { lines.push('  !! operators.json 中无此 buffId'); continue; }
  lines.push(`  text: ${clean(s.text)}`);
  lines.push(`  effects (${(s.effects || []).length}):`);
  for (const e of s.effects || []) {
    const { source, text, factionName, ...rest } = e;
    lines.push(`    - ${JSON.stringify(rest)}`);
  }
  if (s.manualReview) lines.push(`  manualReview: ${clean(s.manualReview)}`);
}

const out = lines.join('\n');
const outPath = path.join(REPO, `docs/review/tools/dump-out-${no}.txt`);
fs.writeFileSync(outPath, out, 'utf8');
console.log(out);
console.log(`\n[已写入] ${outPath}`);
