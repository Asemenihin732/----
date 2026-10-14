/**
 * CLI-развёртывание игрового пространства X-Lance (без UI).
 *
 * Запуск (esbuild → node):
 *   XL_EMAIL=… XL_PASSWORD=… node .tmp-test/provision.mjs
 *
 * Переменные: XL_EMAIL, XL_PASSWORD, XL_TENANT, XL_TENANT_KEY, XL_TEAMS.
 */
import { requestSignIn } from '../src/api/authStore';
import { provisionGame } from '../src/api/provision';
import type { TeamId } from '../src/data/projects';

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};

const email = env.XL_EMAIL;
const password = env.XL_PASSWORD;
const tenantName = env.XL_TENANT ?? 'Игра';
const tenantKey = env.XL_TENANT_KEY ?? 'IG';
const teams = (env.XL_TEAMS ?? 'catering,stage,entertainment,merch,logistics,afterparty')
  .split(',')
  .map((t) => t.trim())
  .filter(Boolean) as TeamId[];

async function main(): Promise<void> {
  if (!email || !password) throw new Error('Задайте XL_EMAIL и XL_PASSWORD');
  await requestSignIn(email, password);
  const result = await provisionGame({
    tenantName,
    tenantKey,
    teamIds: teams,
    onProgress: (message) => console.log('•', message),
  });
  console.log('\nРезультат:\n' + JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error('FAILED:', e instanceof Error ? e.message : e);
  throw e;
});
