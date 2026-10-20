// 一次性排查脚本：从 building_data.json 的 buffs 描述中提取 <$cc.g.ID><中文名></></> 配对，
// 用于建立「阵营中文名 -> factionId」映射，解决 clueBias 等效果 faction 字段缺失中文名的问题。
import fs from 'node:fs';

const bd = JSON.parse(fs.readFileSync('../arknights-research/raw/building_data.json', 'utf8'));
const RE = /<\$cc\.g\.([A-Za-z0-9_]+)>(.*?)<\/><\/>/g;
const map = new Map();
for (const b of Object.values(bd.buffs)) {
  const d = b.description || '';
  RE.lastIndex = 0;
  let m;
  while ((m = RE.exec(d))) {
    const name = m[2].replace(/<[^>]*>/g, '');
    if (!map.has(m[1])) map.set(m[1], new Set());
    map.get(m[1]).add(name);
  }
}
if (map.size === 0) console.log('（无结果）');
for (const [id, names] of map) console.log(`${id} => ${[...names].join(' | ')}`);

// 额外：列出所有出现过的中文阵营关键词（<@cc.kw> 中疑似阵营名的），便于比对缺失项
const KW = /<@cc\.kw>(.*?)<\/>/g;
const kws = new Map();
for (const b of Object.values(bd.buffs)) {
  const d = b.description || '';
  KW.lastIndex = 0;
  let m;
  while ((m = KW.exec(d))) {
    const t = m[1];
    if (/线索/.test(t)) continue;
    kws.set(t, (kws.get(t) || 0) + 1);
  }
}
const candidates = [...kws].filter(([t]) => /生命|自治团|贸易|帮|局|谢拉格|叙拉古|米诺斯|萨尔贡|罗德岛|黑钢|莱塔尼亚|维多利亚|乌萨斯|玻利瓦尔|拉特兰|东国|卡西米尔|伊比利亚|阿戈尔|萨卡兹|企鹅物流|喀兰/.test(t));
console.log('\n--- kw 候选阵营名 ---');
console.log(candidates.map(([t, c]) => `${t} x${c}`).join('\n'));
