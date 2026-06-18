/** Сегменты объединённого стола: «11+12» → ['11', '12']. Пустые отброшены.
 * Единая точка разбора строки `table_number` (если столы станут связью —
 * менять только здесь и в местах вызова). */
export function tableSegments(tableNumber: string): string[] {
  return (tableNumber || '').split('+').map(s => s.trim()).filter(Boolean);
}