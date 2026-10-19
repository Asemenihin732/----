import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
var DECK_SOURCE = 'src/data/deck.json';
/**
 * Базовая колода — отдельный файл /deck.json рядом с сайтом: игра загружает его
 * при запуске, поэтому на сервере колоду можно подменить без пересборки.
 * Источник один — src/data/deck.json: в dev он отдаётся по /deck.json,
 * при сборке кладётся в dist/deck.json.
 */
function deckFile() {
    return {
        name: 'deck-file',
        configureServer: function (server) {
            server.middlewares.use('/deck.json', function (_req, res) {
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.setHeader('Cache-Control', 'no-store');
                res.end(readFileSync(DECK_SOURCE));
            });
        },
        generateBundle: function () {
            this.emitFile({ type: 'asset', fileName: 'deck.json', source: readFileSync(DECK_SOURCE) });
        },
    };
}
// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react(), tailwindcss(), deckFile()],
    server: {
        port: 5173,
        open: true,
    },
});
