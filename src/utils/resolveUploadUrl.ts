/**
 * Приводит путь к загруженному файлу к корректному URL.
 * Загруженные файлы физически лежат в api/uploads, поэтому к путям вида
 * /uploads/... добавляется префикс /api, чтобы они отдавались через API-прокси.
 * Абсолютные ссылки (http/https, vk.com и т.д.) возвращаются без изменений.
 */
export function resolveUploadUrl(url?: string | null): string {
  if (!url) return '';
  if (/^(https?:)?\/\//.test(url)) return url;
  if (url.startsWith('/uploads/')) {
    return `/api${url}`;
  }
  return url;
}