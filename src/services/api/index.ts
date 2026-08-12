// ─── Единая точка доступа к API ──────────────────────────────────────────────
// Функции разбиты по разделам сайта в src/services/api/.
// Этот файл реэкспортирует их, чтобы существующие импорты
// `import { ... } from '../services/api'` продолжали работать.

export { api } from './client';

export * from './settings';
export * from './notifications';
export * from './profile';
export * from './booking';
export * from './team';
export * from './publicProfile';
export * from './admin';
export * from './vkBot';
