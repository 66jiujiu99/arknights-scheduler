// 只读：核查 clueNo / factionId / clueTarget 全库一致性，以及 manualReview 是否保留丢失的条件
import fs from 'node:fs';
const REPO = 'C:/Data/deepseek/arknights-scheduler';
const now = JSON.parse(fs.readFileSync(`${REPO}/public/data/v5/operators.json`, 'utf8'));
const effs = [];
for (const c of Object.values(now.characters)) for (const s of c.skills || []) for (const e of s.effects || []) effs.push({ ...e, _b: s.buffId });
const pairs = new Map();
for (const e of effs) if (e.type === 'clueBias') {
  const k = `${e.clueNo ?? '-'} | ${e.factionId ?? '-'} | ${e.clueTarget ?? '-'} | ${e.level ?? '-'}`;
  pairs.set(k, (pairs.get(k) || 0) + 1);
}
console.log('--- clueBias 的 clueNo|factionId|clueTarget|level 组合 ---');
console.log([...pairs.entries()].map(([k, v]) => `${v} 次  ${k}`).join('\n'));
console.log('\n--- 仍带 faction(中文名) 的 clueBias ---', effs.filter((e) => e.type === 'clueBias' && e.faction).length);
console.log(effs.filter((e) => e.type === 'clueBias' && e.faction).slice(0, 6).map((e) => `${e._b}: ${e.faction}`).join('\n'));
console.log('\n--- 相关条目的 manualReview ---');
const idx = new Map();
for (const c of Object.values(now.characters)) for (const s of c.skills || []) if (!idx.has(s.buffId)) idx.set(s.buffId, s);
for (const id of ['meet_spd&bd[999]', 'meet_spd_notOwned&exchange[000]', 'meet_spd&bd[010]', 'meet_spd_notOwned_P[000]', 'workshop_formula_cost&dorm[000]', 'control_token_prod_spd[000]', 'control_mp_aegir1[000]', 'control_tra_limit&spd3[000]']) {
  console.log(id, '=>', JSON.stringify(idx.get(id)?.manualReview));
}
