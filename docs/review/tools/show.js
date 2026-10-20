// 排查脚本：打印指定 buffId 的原始描述与当前解析结果，用于人工核对。
// 用法：node docs/review/tools/show.js <buffId> [...]
import fs from 'node:fs';

const bd = JSON.parse(fs.readFileSync('../arknights-research/raw/building_data.json', 'utf8'));
const out = JSON.parse(fs.readFileSync('public/data/v5/operators.json', 'utf8'));

const owners = new Map();
for (const c of Object.values(out.characters)) {
  for (const s of c.skills || []) {
    for (const e of s.effects || []) {
      const src = String(e.source || s.buffId || '');
      if (!owners.has(src)) owners.set(src, new Set());
      owners.get(src).add(c.name);
    }
  }
}

const ids = process.argv.slice(2);
for (const id of ids) {
  const buff = bd.buffs[id];
  console.log(`\n=== ${id} ===`);
  console.log('原文:', buff ? buff.description : '（不存在）');
  console.log('持有:', [...(owners.get(id) || [])].join('、') || '（无）');
  const ops = Object.values(out.characters).filter((c) =>
    (c.skills || []).some((s) => (s.effects || []).some((e) => String(e.source || '') === id)),
  );
  for (const c of ops) {
    for (const s of c.skills || []) {
      for (const e of s.effects || []) {
        if (String(e.source || '') !== id) continue;
        console.log(`  ${c.name} / ${s.buffId} / ${s.name || ''}`);
        console.log('   ', JSON.stringify(e));
      }
    }
  }
}
