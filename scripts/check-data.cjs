/**
 * Быстрая проверка данных: количество карточек по командам/раундам,
 * универсальные и бонусные карты, варианты-запросы на изменение,
 * а также сумма статей бюджета в проектах.
 */
const fs = require('fs');
const c = fs.readFileSync('src/data/cards.ts', 'utf8');

const teams = ['catering', 'stage', 'entertainment', 'merch', 'logistics', 'afterparty'];
let total = 0;
for (const t of teams) {
  // карточки новой колоды: card(\n  'team',\n  1,\n ...
  const re = new RegExp("card\\(\\s*'" + t + "',\\s*\\d", 'g');
  const n = (c.match(re) || []).length;
  total += n;
  console.log(t.padEnd(15), n);
}

console.log('UNIVERSAL cards'.padEnd(15), (c.match(/'UNIVERSAL'/g) || []).length);
console.log('TEAM TOTAL'.padEnd(15), total);
console.log('CR options'.padEnd(15), (c.match(/isChangeRequest:\s*true/g) || []).length);

const p = fs.readFileSync('src/data/projects.ts', 'utf8');
const items = [...p.matchAll(/cost:\s*([\d_]+)/g)].map((m) => Number(m[1].replace(/_/g, '')));
const sum = items.reduce((a, b) => a + b, 0);
console.log('budget lines:', items.length, 'sum:', sum.toLocaleString('ru-RU'));
