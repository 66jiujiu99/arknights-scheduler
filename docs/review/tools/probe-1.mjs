// 只读取数/诊断工具：对同一句话做变体，打印 parseBuff 结果，用于定位 orderQuality 规则为何不触发。
// 脚本只打印数据，不做判断。
import fs from 'node:fs';
import { parseBuff } from '../../../scripts/lib/effects.mjs';

const bd = JSON.parse(fs.readFileSync('../arknights-research/raw/building_data.json', 'utf8'));
const base = bd.buffs['trade_ord_wt&cost[000]'];

const variants = {
  '原文': base.description,
  'v1 去掉「小幅提升当前贸易站」': '进驻贸易站时，高品质贵金属订单的出现概率提升，心情每小时消耗-0.25',
  'v2 只留订单质量': '进驻贸易站时，订单质量提升，心情每小时消耗-0.25',
  'v3 保留小幅提升': '进驻贸易站时，小幅提升订单质量，心情每小时消耗-0.25',
  'v4 保留当前贸易站': '进驻贸易站时，提升当前贸易站订单质量，心情每小时消耗-0.25',
  'v5 去掉括号': '进驻贸易站时，提升当前贸易站高品质贵金属订单的出现概率，心情每小时消耗-0.25',
  'v6 无心情从句': '进驻贸易站时，提升当前贸易站高品质贵金属订单的出现概率（工作时长影响概率）',
};
for (const [name, desc] of Object.entries(variants)) {
  const r = parseBuff({ ...base, description: desc });
  console.log(`\n### ${name}`);
  console.log('  desc:', desc);
  console.log('  eff :', JSON.stringify(r.effects));
  if (r.manualReview) console.log('  manualReview:', JSON.stringify(r.manualReview.segments));
}
