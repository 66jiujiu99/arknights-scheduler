// 只读：核查"每个进驻在X站的Y干员"这类控制中枢技能的 target 约定（对照未改动条目）
import { execSync } from 'node:child_process';
import fs from 'node:fs';
const REPO = 'C:/Data/deepseek/arknights-scheduler';
const base = JSON.parse(execSync('git show efdfa7a:public/data/v5/operators.json', { cwd: REPO, maxBuffer: 1 << 28 }).toString());
const now = JSON.parse(fs.readFileSync(`${REPO}/public/data/v5/operators.json`, 'utf8'));
const idx = (db) => { const m = new Map(); for (const c of Object.values(db.characters)) for (const s of c.skills || []) if (!m.has(s.buffId)) m.set(s.buffId, s); return m; };
const A = idx(base), B = idx(now);
const show = (e) => { const { source, text, factionName, ...r } = e; return JSON.stringify(r); };
const picked = [];
for (const [id, s] of B) {
  if (!['CONTROL'].includes(s.room)) continue;
  const hit = (s.effects || []).some((e) => /每个进驻在(制造站|贸易站|会客室|宿舍|发电站)/.test(e.condition?.text || ''));
  if (hit) picked.push({ id, s, changed: JSON.stringify(A.get(id)?.effects) !== JSON.stringify(s.effects) });
}
console.log('控制中枢中"每个进驻在X站"类技能共', picked.length, '条，其中本轮变化', picked.filter((p) => p.changed).length);
for (const p of picked) {
  console.log(`\n${p.changed ? '[变化]' : '[未变]'} ${p.id}`);
  console.log(' 新:', p.s.effects.map(show).join(' | '));
  if (p.changed) console.log(' 旧:', (A.get(p.id)?.effects ?? []).map(show).join(' | '));
}
