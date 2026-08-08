// Функция форматирует ввод номера телефона в формат +7 (XXX) XXX-XX-XX
// Поддерживает:
// - ввод с 7 или 8 (8 автоматически заменяется на 7)
// - ввод без кода страны (например, 999... -> 7 999...)
// - любые разделители (пробелы, скобки, дефисы) игнорируются
export function formatPhoneInput(input: string): string {
  // Извлекаем только цифры
  let digits = input.replace(/\D/g, '');

  if (digits.length === 0) return '';

  // Если начинается с 8 — заменяем на 7 (код России)
  if (digits[0] === '8') {
    digits = '7' + digits.slice(1);
  }

  // Если не начинается с 7 — добавляем 7 в начало (предполагаем российский номер)
  if (digits[0] !== '7') {
    digits = '7' + digits;
  }

  // Ограничиваем до 11 цифр (7 + 10 цифр номера)
  digits = digits.slice(0, 11);

  // Формируем строку постепенно
  let result = '';

  // Код страны
  result += '+7';

  // Оператор и номер
  if (digits.length > 1) {
    const part1 = digits.slice(1, 4);
    result += ' (' + part1;
  }

  if (digits.length >= 4) {
    const part2 = digits.slice(4, 7);
    result += ') ' + part2;
  }

  if (digits.length >= 7) {
    const part3 = digits.slice(7, 9);
    result += '-' + part3;
  }

  if (digits.length >= 9) {
    const part4 = digits.slice(9, 11);
    result += '-' + part4;
  }

  return result;
}