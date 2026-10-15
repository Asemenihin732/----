/** Перед прогоном: очистить строки прошлого отчёта о финансах. */
import { mkdirSync, writeFileSync } from 'node:fs';

export default function globalSetup() {
  // очищаем содержимое, а не удаляем файл: на Windows удаление бывает отложенным
  mkdirSync('e2e/results', { recursive: true });
  writeFileSync('e2e/results/finance-rows.jsonl', '');
}
