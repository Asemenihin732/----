import { readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const DECK_SOURCE = 'src/data/deck.json';

/**
 * Базовая колода — отдельный файл /deck.json рядом с сайтом: игра загружает его
 * при запуске, поэтому на сервере колоду можно подменить без пересборки.
 * Источник один — src/data/deck.json: в dev он отдаётся по /deck.json,
 * при сборке кладётся в dist/deck.json.
 */
function deckFile(): Plugin {
  return {
    name: 'deck-file',
    configureServer(server) {
      server.middlewares.use('/deck.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.end(readFileSync(DECK_SOURCE));
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'deck.json', source: readFileSync(DECK_SOURCE) });
    },
  };
}

/**
 * Серверная часть входа по ссылке — работает в dev и `vite preview`:
 *   POST /api/join                 — вход участника в тенант (server/join.ts);
 *   /api/admin/join-tenants        — админка: куда открыт вход (server/admin.ts).
 * Модули грузятся при первом запросе — когда окружение из .env уже прочитано.
 */
function joinApi(): Plugin {
  const join = async (req: IncomingMessage, res: ServerResponse) => {
    const { handleJoinRequest } = await import('./server/join');
    await handleJoinRequest(req, res);
  };
  const admin = async (req: IncomingMessage, res: ServerResponse) => {
    const { handleAdminJoinTenants } = await import('./server/admin');
    await handleAdminJoinTenants(req, res);
  };
  const mount = (middlewares: { use: (path: string, fn: typeof join) => unknown }) => {
    middlewares.use('/api/admin/join-tenants', admin);
    middlewares.use('/api/join', join);
  };
  return {
    name: 'join-api',
    configureServer(server) {
      mount(server.middlewares);
    },
    configurePreviewServer(server) {
      mount(server.middlewares);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // .env → process.env для серверного /api/join (в бандл попадают только VITE_*)
  Object.assign(process.env, { ...loadEnv(mode, process.cwd(), ''), ...process.env });
  return {
    plugins: [react(), tailwindcss(), deckFile(), joinApi()],
    server: {
      port: 5173,
      open: true,
    },
  };
});
