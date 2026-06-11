/** Общие хелперы вкладок бара. */

/** «Стол 10 + Стол 1» → отдельные плашки, чтобы текст не слипался */
export function tableChips(label: string | null | undefined): string[] {
  if (!label) return [];
  return label.split('+').map(s => s.trim()).filter(Boolean);
}
