// 只读分类脚本：把 244 条变化按"改了哪些字段"归类，并按风险排序输出（不做任何判定）
import { execSync } from 'node:child_process';
import fs from 'node:fs';
const REPO = 'C:/Data/deepseek/arknights-scheduler';
const base = JSON.parse(execSync('git show efdfa7a:public/data/v5/operators.json', { cwd: REPO, maxBuffer: 1 << 28 }).toString());
const now = JSON.parse(fs.readFileSync(`${REPO}/public/data/v5/operators.json`, 'utf8'));
const bd = JSON.parse(fs.readFileSync('C:/Data/deepseek/arknights-research/raw/building_data.json', 'utf8'));
const clean = (s) => String(s ?? '').replace(/<@cc\.vup>([^<]*)<\/>/g, '$1').replace(/<@cc\.vdown>([^<]*)<\/>/g, '$1').replace(/<@cc\.rem>([^<]*)<\/>/g, '$1').replace(/<@cc\.kw>([^<]*)<\/>/g, '「$1」').replace(/<@cc\.lkw>([^<]*)<\/>/g, '「$1」').replace(/<@cc\.g\.[a-zA-Z0-9_]+>/g, '').replace(/<\/>/g, '').replace(/<[^>]*>/g, '').trim();
const index = (db) => { const m = new Map(); for (const c of Object.values(db.characters)) for (const s of c.skills || []) if (!m.has(s.buffId)) m.set(s.buffId, s); return m; };
const A = index(base), B = index(now);
const strip = (e) => { const { source, text, factionName, ...r } = e; return r; };
const rows = [];
for (const id of new Set([...A.keys(), ...B.keys()])) {
  const a = A.get(id)?.effects ?? null, b = B.get(id)?.effects ?? null;
  if (JSON.stringify(a) === JSON.stringify(b)) continue;
  const A2 = (a ?? []).map(strip), B2 = (b ?? []).map(strip);
  const sig = [];
  if ((a?.length ?? 0) !== (b?.length ?? 0)) sig.push(`条数 ${a?.length ?? 0}->${b?.length ?? 0}`);
  const n = Math.max(A2.length, B2.length);
  for (let i = 0; i < n; i++) {
    const x = A2[i], y = B2[i];
    if (!x || !y) continue;
    for (const k of ['type', 'target', 'value', 'unit', 'per', 'perValue', 'level', 'scope', 'faction', 'factionId', 'clueNo', 'clueTarget', 'profession', 'branch', 'cap', 'scale', 'product', 'resourceId', 'resourceName', 'stacking', 'level']) {
      if (JSON.stringify(x[k]) !== JSON.stringify(y[k])) sig.push(`e${i}.${k} ${JSON.stringify(x[k])}->${JSON.stringify(y[k])}`);
    }
    const cx = x.condition ?? null, cy = y.condition ?? null;
    if (JSON.stringify(cx) !== JSON.stringify(cy)) {
      if ((cx?.type ?? null) !== (cy?.type ?? null)) sig.push(`e${i}.cond.type ${cx?.type}->${cy?.type}`);
      else sig.push(`e${i}.cond 细节`);
    }
  }
  rows.push({ id, room: (B.get(id) || A.get(id)).room, sig, a: A2, b: B2, desc: clean(bd.buffs[id]?.description) });
}
const RISK = /target |per |perValue |cond\.type|条数 |level |faction|clueNo|clueTarget|profession |branch |cap |value /;
rows.sort((p, q) => (RISK.test(q.sig.join(';')) ? 1 : 0) - (RISK.test(p.sig.join(';')) ? 1 : 0));
const out = [];
out.push(`变化 ${rows.length} 条`);
for (const r of rows) {
  out.push(`\n=== ${r.id} [${r.room}]  {${r.sig.join('; ')}}`);
  out.push(` 原文: ${r.desc}`);
  out.push(` 旧: ${JSON.stringify(r.a)}`);
  out.push(` 新: ${JSON.stringify(r.b)}`);
}
fs.writeFileSync(`${REPO}/docs/review/tools/regress-scan.txt`, out.join('\n'), 'utf8');
// 统计
const cnt = {};
for (const r of rows) for (const s of r.sig) { const k = s.split(' ')[0].replace(/^e\d+\./, ''); cnt[k] = (cnt[k] || 0) + 1; }
console.log('字段变化计数:', JSON.stringify(cnt, null, 1));
console.log('高风险的 target 变化:');
for (const r of rows) for (const s of r.sig) if (/target /.test(s)) console.log(' ', r.id, '|', s, '|', r.desc.slice(0, 60));
