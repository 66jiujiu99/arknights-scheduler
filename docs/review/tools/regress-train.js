// 只读：检查 lead 点名的"任意职业都生效"训练室技能是否被误加 profession
import { execSync } from 'node:child_process';
import fs from 'node:fs';
const REPO = 'C:/Data/deepseek/arknights-scheduler';
const base = JSON.parse(execSync('git show efdfa7a:public/data/v5/operators.json', { cwd: REPO, maxBuffer: 1 << 28 }).toString());
const now = JSON.parse(fs.readFileSync(`${REPO}/public/data/v5/operators.json`, 'utf8'));
const bd = JSON.parse(fs.readFileSync('C:/Data/deepseek/arknights-research/raw/building_data.json', 'utf8'));
const clean = (s) => String(s ?? '').replace(/<@cc\.vup>([^<]*)<\/>/g, '$1').replace(/<@cc\.vdown>([^<]*)<\/>/g, '$1').replace(/<@cc\.rem>([^<]*)<\/>/g, '$1').replace(/<@cc\.kw>([^<]*)<\/>/g, '「$1」').replace(/<@cc\.lkw>([^<]*)<\/>/g, '「$1」').replace(/<@cc\.g\.[a-zA-Z0-9_]+>/g, '').replace(/<\/>/g, '').replace(/<[^>]*>/g, '').trim();
const idx = (db) => { const m = new Map(); for (const c of Object.values(db.characters)) for (const s of c.skills || []) if (!m.has(s.buffId)) m.set(s.buffId, s); return m; };
const A = idx(base), B = idx(now);
const show = (e) => { const { source, text, factionName, ...r } = e; return JSON.stringify(r); };
const ids = [...B.keys()].filter((id) => id.startsWith('train_spd') && !/profession/.test(id)).sort();
console.log('非 profession 型训练室 buffId 共', ids.length, '条');
let changed = 0;
for (const id of ids) {
  const a = A.get(id)?.effects ?? null, b = B.get(id)?.effects ?? null;
  const same = JSON.stringify(a) === JSON.stringify(b);
  if (!same) changed++;
  // 只打印"本轮变化"或"含 profession 字段"的（重点风险）
  const hasProf = JSON.stringify(b ?? '').includes('profession');
  if (!same || hasProf) {
    console.log(`\n${same ? '[未变]' : '[变化]'} ${id}${hasProf ? ' ★含profession' : ''}`);
    console.log(' 原文:', clean(bd.buffs[id]?.description));
    console.log(' 旧:', (a ?? []).map(show).join(' | '));
    console.log(' 新:', (b ?? []).map(show).join(' | '));
  }
}
console.log('\n其中本轮变化', changed, '条');
