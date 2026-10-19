/**
 * Продакшн-сервер: раздаёт собранную игру (dist/) и серверную часть входа по ссылке —
 * то же, что плагин joinApi в vite.config.ts делает для dev и `vite preview`.
 *
 *   POST /api/join            — вход участника в тенант (server/join.ts);
 *   /api/admin/join-tenants   — админка: куда открыт вход (server/admin.ts);
 *   остальное                 — файлы из dist/, пути без файла → index.html (SPA).
 *
 * Сборка и запуск: `npm run build && npm run build:server && npm run serve`.
 * Окружение — из .env (как loadEnv в vite.config.ts), порт — PORT (по умолчанию 8080),
 * каталог сборки — DIST_DIR (по умолчанию dist). Пути считаются от текущего каталога.
 */
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';

/** .env* в порядке приоритета, как у Vite; уже заданные переменные окружения важнее */
function loadEnv(mode = process.env.NODE_ENV || 'production'): void {
  for (const file of [`.env.${mode}.local`, '.env.local', `.env.${mode}`, '.env']) {
    try {
      process.loadEnvFile(file);
    } catch {
      /* файла нет */
    }
  }
}

type Handler = (req: IncomingMessage, res: ServerResponse) => Promise<void>;

/** Модули грузятся после loadEnv — как в vite.config.ts */
const routes: [prefix: string, load: () => Promise<Handler>][] = [
  ['/api/admin/join-tenants', async () => (await import('./admin')).handleAdminJoinTenants],
  ['/api/join', async () => (await import('./join')).handleJoinRequest],
];

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf',
};

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

function sendFile(req: IncomingMessage, res: ServerResponse, path: string, cache: string): void {
  res.writeHead(200, {
    'Content-Type': MIME[extname(path).toLowerCase()] ?? 'application/octet-stream',
    'Cache-Control': cache,
  });
  if (req.method === 'HEAD') return void res.end();
  createReadStream(path)
    .on('error', (e) => {
      console.error('[serve]', e.message);
      res.destroy();
    })
    .pipe(res);
}

async function serveStatic(root: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: 'Метод не поддерживается.' });
  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
  } catch {
    return sendJson(res, 400, { error: 'Некорректный адрес.' });
  }
  const file = resolve(join(root, pathname));
  if (file !== root && !file.startsWith(root + sep)) return sendJson(res, 403, { error: 'Нет доступа.' });

  if (await isFile(file)) {
    // у файлов из assets/ хэш в имени; deck.json и прочее подменяют без пересборки
    const hashed = pathname.startsWith('/assets/');
    return sendFile(req, res, file, hashed ? 'public, max-age=31536000, immutable' : 'no-cache');
  }
  // путь с расширением — это файл, а его нет; остальное — маршрут SPA
  if (extname(pathname)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return void res.end('Не найдено');
  }
  const index = join(root, 'index.html');
  if (!(await isFile(index))) return sendJson(res, 500, { error: 'Нет сборки игры — выполните npm run build.' });
  return sendFile(req, res, index, 'no-cache');
}

function main(): void {
  loadEnv();
  const root = resolve(process.env.DIST_DIR || 'dist');
  const port = Number(process.env.PORT) || 8080;

  const server = createServer(async (req, res) => {
    try {
      const url = req.url ?? '/';
      for (const [prefix, load] of routes) {
        const rest = url.slice(prefix.length);
        if (url.startsWith(prefix) && (rest === '' || rest[0] === '/' || rest[0] === '?')) {
          // как connect: обработчик видит путь после префикса
          req.url = rest.startsWith('/') ? rest : `/${rest}`;
          return await (await load())(req, res);
        }
      }
      if (url === '/api' || url.startsWith('/api/') || url.startsWith('/api?')) {
        return sendJson(res, 404, { error: 'Не найдено.' });
      }
      await serveStatic(root, req, res);
    } catch (e) {
      console.error('[serve]', e instanceof Error ? e.message : e);
      if (!res.headersSent) sendJson(res, 500, { error: 'Внутренняя ошибка сервера.' });
      else res.end();
    }
  });

  server.listen(port, () => {
    console.log(`Игра: http://localhost:${port} (сборка: ${root})`);
  });
}

main();
