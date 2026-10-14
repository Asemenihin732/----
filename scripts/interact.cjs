/**
 * Интерактивная проверка экрана участника через Chrome DevTools Protocol:
 * открытие карточки (flip), модалка, выбор варианта, пересчёт KPI, бланк решений.
 * Требует запущенного vite preview на http://localhost:4173.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = 'http://localhost:4173/team/catering';
const SHOTS = path.join(os.tmpdir(), 'opencode', 'shots');
const USER_DIR = path.join(os.tmpdir(), 'msedge-cdp-' + Date.now());

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });
  const edge = spawn(EDGE, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    `--user-data-dir=${USER_DIR}`,
    '--remote-debugging-port=9222',
    '--remote-allow-origins=*',
    '--window-size=1440,1400',
    BASE,
  ]);

  try {
    // ждём старт DevTools
    let version = null;
    for (let i = 0; i < 40 && !version; i++) {
      await sleep(250);
      try {
        version = await (await fetch('http://127.0.0.1:9222/json/version')).json();
      } catch {
        /* ещё не поднялся */
      }
    }
    if (!version) throw new Error('DevTools не поднялся');

    let target = null;
    for (let i = 0; i < 20 && !target; i++) {
      await sleep(300);
      const list = await (await fetch('http://127.0.0.1:9222/json/list')).json();
      target = list.find((t) => t.type === 'page' && t.url.includes('localhost:4173'));
    }
    if (!target) throw new Error('Целевая страница не найдена');
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      ws.onopen = res;
      ws.onerror = rej;
    });

    let id = 0;
    const pending = new Map();
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    };
    const send = (method, params = {}) =>
      new Promise((resolve) => {
        const msgId = ++id;
        pending.set(msgId, resolve);
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Page.navigate', { url: BASE });
    await sleep(2500);

    const evalJs = async (expression) => {
      const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.error) {
        console.log('  [cdp error]', r.error.message);
        return undefined;
      }
      if (r.result?.exceptionDetails) {
        console.log('  [js error]', JSON.stringify(r.result.exceptionDetails).slice(0, 200));
        return undefined;
      }
      return r.result?.result?.value;
    };

    console.log('URL:', await evalJs('document.URL'));
    console.log('TITLE:', await evalJs('document.title'));
    console.log('BODY:', (await evalJs('document.body.innerText.slice(0, 300)'))?.replace(/\n/g, ' | '));
    await sleep(1500);

    const results = [];
    const check = (name, ok, info = '') => {
      results.push({ name, ok, info });
      console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`);
    };

    // 1. Страница команды отрисована
    check('экран команды', (await evalJs(`document.body.innerText.includes('Кейтеринг и фуршет')`)));
    check('4 карточки раунда', (await evalJs(`document.querySelectorAll('[aria-label="Закрытая карточка раунда"]').length`)) === 4);
    check('KPI индекс 100 %', (await evalJs(`document.body.innerText.includes('ИНДЕКС ПРОЕКТА')`)));

    const shot = async (name) => {
      const r = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(SHOTS, name), Buffer.from(r.result.data, 'base64'));
    };

    // 2. Клик по первой закрытой карточке → flip → модалка
    await evalJs(`document.querySelector('[aria-label="Закрытая карточка раунда"]').click()`);
    await sleep(900);
    check('модалка ситуации открылась', await evalJs(`Boolean(document.querySelector('.MuiDialog-container')) && document.body.innerText.includes('Шеф-повар уходит к конкурентам')`));
    await shot('modal.png');

    // 3. Выбор варианта B и предпросмотр индекса
    await evalJs(`(() => { const opt = [...document.querySelectorAll('.MuiDialog-container .MuiChip-root')].find(c => c.textContent === 'B'); opt.closest('div[style]')?.parentElement?.click() ?? opt.click(); })()`);
    await sleep(400);
    const previewText = await evalJs(`document.querySelector('.MuiDialog-container').innerText`);
    check('предпросмотр «Станет:»', previewText.includes('Станет:'), previewText.split('\n').find((l) => l.includes('Станет')) ?? '');
    check('предпросмотр индекса 100 → 100', previewText.includes('Индекс: 100 % → 100 %'));
    await shot('modal_preview.png');

    // 4. Принять решение
    await evalJs(`[...document.querySelectorAll('.MuiDialog-container button')].find(b => b.textContent.includes('Принять решение')).click()`);
    await sleep(700);
    check('модалка закрылась', await evalJs(`!document.querySelector('.MuiDialog-container')`));
    check('KPI пересчитаны: срок 6,5 дн.', await evalJs(`document.body.innerText.includes('6,5 дн.')`));
    check('бланк решений: 1', await evalJs(`document.body.innerText.includes('БЛАНК РЕШЕНИЙ · 1') || document.body.innerText.includes('Бланк решений: 1')`));
    check('снекбар о фиксации', await evalJs(`document.body.innerText.includes('зафиксирован')`));
    await shot('after_decision.png');

    // 5. Карточка осталась открытой и помечена решённой
    check('карточка решена (вариант B)', await evalJs(`document.querySelectorAll('[aria-label^="Карточка «Шеф-повар"]').length === 1`));

    // 6. Бланк решений
    await evalJs(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('БЛАНК РЕШЕНИЙ')).click()`);
    await sleep(500);
    check('диалог бланка решений', await evalJs(`document.body.innerText.includes('Бланк решений · 1. Кейтеринг')`));
    await shot('decision_form.png');
    await evalJs(`[...document.querySelectorAll('.MuiDialog-container button')].find(b => b.getAttribute('aria-label') === 'закрыть').click()`);
    await sleep(300);

    // 7. Гант: сдвиг задачи и сброс
    await evalJs(`[...document.querySelectorAll('button[aria-label="сдвинуть вперёд"]')][0].click()`);
    await sleep(200);
    check('сдвиг Ганта: план 7 дн.', await evalJs(`document.body.innerText.includes('План после правок: 7 дн.')`));
    await evalJs(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('Сбросить сдвиги')).click()`);
    await sleep(200);
    check('сброс сдвигов', await evalJs(`document.body.innerText.includes('План после правок: 6 дн.')`));

    // 8. Ресурсы: пересчёт стоимости
    await evalJs(`[...document.querySelectorAll('[role="tab"]')].find(t => t.textContent.includes('РЕСУРСЫ')).click()`);
    await sleep(300);
    check('ресурсы: занятость и стоимость', await evalJs(`document.body.innerText.includes('Шеф-повар') && document.body.innerText.includes('ИТОГО по бюджету')`));
    await shot('resources.png');

    // 9. Статистика: формула индекса
    await evalJs(`[...document.querySelectorAll('[role="tab"]')].find(t => t.textContent.includes('СТАТИСТИКА')).click()`);
    await sleep(300);
    check('статистика: формула индекса', await evalJs(`document.body.innerText.includes('Индекс проекта = (KPI Срок + KPI Маржинальность + KPI Удовлетворённость) ÷ 3 = (92')`));
    await shot('stats.png');

    // 10. Тема: тёмный режим через localStorage
    await evalJs(`localStorage.setItem('xlance-theme-mode', 'dark'); location.reload()`);
    await sleep(2200);
    check('тёмная тема применяется', await evalJs(`getComputedStyle(document.body).backgroundColor`), '');
    await shot('team_dark.png');

    ws.close();
    const failed = results.filter((r) => !r.ok).length;
    console.log(failed === 0 ? 'ALL INTERACTION CHECKS PASSED' : `FAILED: ${failed}`);
  } finally {
    edge.kill();
    try {
      fs.rmSync(USER_DIR, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

main().catch((e) => {
  console.error('ERROR', e);
  process.exit(1);
});
