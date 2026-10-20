// 只读取数/诊断工具：保持 <@cc.*> 标记结构，逐项改动描述，打印 parseBuff 结果，用于二分定位。
// 脚本只打印数据，不做判断。
import fs from 'node:fs';
import { parseBuff } from '../../../scripts/lib/effects.mjs';

const bd = JSON.parse(fs.readFileSync('../arknights-research/raw/building_data.json', 'utf8'));
const base = bd.buffs['trade_ord_wt&cost[000]'];

const V = {
  'D0 原文': base.description,
  'D1 去掉括号': '进驻贸易站时，<@cc.kw>小幅提升</>当前贸易站<@cc.kw>高品质贵金属订单</>的出现概率，心情每小时消耗<@cc.vup>-0.25</>',
  'D2 去掉两个kw标记': '进驻贸易站时，小幅提升当前贸易站高品质贵金属订单的出现概率（工作时长影响概率），心情每小时消耗<@cc.vup>-0.25</>',
  'D3 只留订单cls': '进驻贸易站时，<@cc.kw>高品质贵金属订单</>的出现概率<@cc.kw>提升</>，心情每小时消耗<@cc.vup>-0.25</>',
  'D4 对照orderEfficiency': '进驻贸易站时，订单获取效率<@cc.vup>+10%</>，心情每小时消耗<@cc.vup>-0.25</>',
  'D5 订单cls+数值': '进驻贸易站时，<@cc.kw>高品质贵金属订单</>的出现概率<@cc.vup>+10%</>，心情每小时消耗<@cc.vup>-0.25</>',
};
for (const [name, desc] of Object.entries(V)) {
  const r = parseBuff({ ...base, description: desc });
  console.log(`\n### ${name}`);
  console.log('  desc:', desc);
  console.log('  eff :', JSON.stringify(r.effects));
  if (r.manualReview) console.log('  manual:', JSON.stringify(r.manualReview.segments));
}
