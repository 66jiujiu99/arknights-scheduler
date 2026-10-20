// 只读：对照"反之"类句式在全库的写法（旧 vs 新），判断 per 是否被误加
import { execSync } from 'node:child_process';
import fs from 'node:fs';
const REPO = 'C:/Data/deepseek/arknights-scheduler';
const bd = JSON.parse(fs.readFileSync('C:/Data/deepseek/arknights-research/raw/building_data.json', 'utf8'));
const base = JSON.parse(execSync('git show efdfa7a:public/data/v5/operators.json', { cwd: REPO, maxBuffer: 1 << 28 }).toString());
const now = JSON.parse(fs.readFileSync(`${REPO}/public/data/v5/operators.json`, 'utf8'));
const clean = (s) => String(s ?? '').replace(/<@cc\.vup>([^<]*)<\/>/g, '$1').replace(/<@cc\.vdown>([^<]*)<\/>/g, '$1').replace(/<@cc\.rem>([^<]*)<\/>/g, '$1').replace(/<@cc\.kw>([^<]*)<\/>/g, '「$1」').replace(/<@cc\.lkw>([^<]*)<\/>/g, '「$1」').replace(/<@cc\.g\.[a-zA-Z0-9_]+>/g, '').replace(/<\/>/g, '').replace(/<[^>]*>/g, '').trim();
const idx = (db) => { const m = new Map(); for (const c of Object.values(db.characters)) for (const s of c.skills || []) if (!m.has(s.buffId)) m.set(s.buffId, s); return m; };
const A = idx(base), B = idx(now);
const show = (e) => { const { source, text, factionName, ...r } = e; return JSON.stringify(r); };
const ids = [...B.keys()].filter((id) => /反之/.test(clean(bd.buffs[id]?.description || '')));
console.log('描述含"反之"的 buff 共', ids.length);
for (const id of ids) {
  console.log(`\n=== ${id}\n 原文: ${clean(bd.buffs[id]?.description)}`);
  console.log(' 旧:', (A.get(id)?.effects ?? []).map(show).join('\n     '));
  console.log(' 新:', (B.get(id)?.effects ?? []).map(show).join('\n     '));
}
