/** Общие хелперы вкладок бара. */
import { tableSegments } from '../../../entities/table';

/** «Стол 10 + Стол 1» → отдельные плашки, чтобы текст не слипался */
export function tableChips(label: string | null | undefined): string[] {
  return tableSegments(label ?? '');
}
