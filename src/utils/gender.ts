export type Gender = 'M' | 'F';

/**
 * Определяет пол по окончанию фамилии.
 * Логика скопирована из PHP-функции detectGenderByLastName в api/index.php
 * @returns 'M' | 'F' если пол определён, иначе null
 */
export function detectGenderByLastName(lastName: string): Gender | null {
  const name = lastName.trim().toLowerCase();
  if (!name) return null;

  // Женские окончания
  if (
    name.endsWith('ая') ||
    name.endsWith('яя') ||
    name.endsWith('ова') ||
    name.endsWith('ева') ||
    name.endsWith('ина') ||
    name.endsWith('ына') ||
    name.endsWith('ская') ||
    name.endsWith('цкая')
  ) {
    return 'F';
  }

  // Мужские окончания
  if (
    name.endsWith('ов') ||
    name.endsWith('ев') ||
    name.endsWith('ин') ||
    name.endsWith('ын') ||
    name.endsWith('ий') ||
    name.endsWith('ый') ||
    name.endsWith('ский') ||
    name.endsWith('цкий')
  ) {
    return 'M';
  }

  const lastChar = name.charAt(name.length - 1);
  if (lastChar === 'а' || lastChar === 'я') {
    return 'F';
  }

  if ('бвгджзклмнпрстфхцчшщй'.includes(lastChar)) {
    return 'M';
  }

  return null;
}