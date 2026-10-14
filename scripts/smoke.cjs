/**
 * Смоук-тест рендеринга: дампит DOM маршрутов в headless Edge (Windows)
 * и проверяет маркеры контента. Запускать на фоне `vite preview`.
 * Базовый URL: переменная окружения SMOKE_URL (по умолчанию http://localhost:4173).
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = process.env.SMOKE_URL || 'http://localhost:4173';

// Без входа любой защищённый маршрут показывает экран авторизации.
const loginMarks = ['Вход в систему', 'Email', 'Пароль', 'Войти', 'preview.x-lance.ru'];
const routes = [
  ['home→login', '/', loginMarks],
  ['login', '/login', loginMarks],
  ['setup→login', '/setup', loginMarks],
  ['team→login', '/team/merch', loginMarks],
  ['results→login', '/results', loginMarks],
];

if (!fs.existsSync(EDGE)) {
  console.log('Edge не найден — смоук-тест пропущен (нужен Windows + Edge).');
  process.exit(0);
}

// свежий профиль = чистый localStorage, поведение детерминировано
const profile = path.join(os.tmpdir(), 'msedge-smoke');
fs.rmSync(profile, { recursive: true, force: true });

let failed = 0;
for (const [name, route, marks] of routes) {
  try {
    const out = execFileSync(
      EDGE,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        `--user-data-dir=${profile}`,
        '--virtual-time-budget=12000',
        '--dump-dom',
        BASE + route,
      ],
      { maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] },
    );
    const text = out.toString('utf8');
    const missing = marks.filter((m) => !text.includes(m));
    if (missing.length) {
      failed++;
      console.log(`FAIL ${route} — нет: ${missing.join(' | ')}`);
    } else {
      console.log(`OK   ${route} — ${marks.length} маркеров, ${text.length} симв.`);
    }
  } catch (e) {
    failed++;
    console.log(`FAIL ${route} — ${e.message}`);
  }
}
console.log(failed === 0 ? 'ALL ROUTES OK' : `FAILED: ${failed}`);
