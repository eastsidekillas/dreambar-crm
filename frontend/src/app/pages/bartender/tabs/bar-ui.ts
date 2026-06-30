/** Общие хелперы и палитра вкладок бара (тёмная KDS-тема). */
import { tableSegments } from '../../../entities/table';

/** Именованные токены тёмной палитры — чтобы не плодить хардкод-хексы по шаблонам. */
export const BAR = {
  bg:         '#0f172a',  // фон экрана
  surface:    '#1e293b',  // карточки/поверхности
  border:     '#334155',  // границы
  muted:      '#64748b',  // приглушённый текст
  textMuted:  '#94a3b8',  // вторичный текст
  text:       '#f1f5f9',  // основной текст
  amber:      '#f59e0b',  // акцент (бар)
  amberDeep:  '#422006',  // фон позиции «готовится»
  green:      '#22c55e',  // готово/успех
  greenLight: '#4ade80',
  greenDeep:  '#14532d',  // фон позиции «готово»
  red:        '#ef4444',  // ошибка/срочно
  blue:       '#3b82f6',  // бронь «пришёл»
  blueLight:  '#60a5fa',
} as const;

/** Моноширинный стек с табличными цифрами — «докетная» типографика бара
 *  (номера, количества, объёмы, таймер выравниваются по разрядам). */
export const MONO =
  "font-family:ui-monospace,'SF Mono','JetBrains Mono',Menlo,monospace;font-variant-numeric:tabular-nums";

/** Стиль хоста вкладки-списка: тёмный фон до низа + внутренний скролл
 *  (иначе при переполнении скроллится <body> и из-под низа виден светлый фон темы). */
export const LIST_TAB_HOST =
  'display:flex;flex-direction:column;flex:1 1 0;min-height:0;overflow-y:auto;background:#0f172a';

/** «Стол 10 + Стол 1» → отдельные плашки, чтобы текст не слипался. */
export function tableChips(label: string | null | undefined): string[] {
  return tableSegments(label ?? '');
}

/** Напитки готовятся быстрее блюд, поэтому пороги срочности разные. */
export type UrgencyKind = 'drink' | 'food';
const URGENCY_THRESHOLDS: Record<UrgencyKind, { warn: number; danger: number }> = {
  drink: { warn: 5, danger: 10 },
  food:  { warn: 8, danger: 15 },
};

/** Цвет рамки/таймера тикета по времени ожидания (зелёный → янтарь → красный). */
export function urgencyColor(min: number, kind: UrgencyKind = 'drink'): string {
  const { warn, danger } = URGENCY_THRESHOLDS[kind];
  if (min >= danger) return BAR.red;
  if (min >= warn)   return BAR.amber;
  return BAR.green;
}

/** Цвет статусного рейла позиции (левый кантик строки в леджере). */
export function itemRail(status: string): string {
  if (status === 'cooking') return BAR.amber;
  if (status === 'ready')   return BAR.green;
  return BAR.border;
}

/** Чип статуса позиции в мониторе кухни: «готовится» / «ожидает». */
export function kitchenItemStatusChip(status: string): string {
  return status === 'cooking'
    ? `background:${BAR.amber}22;color:${BAR.amber}`
    : `background:${BAR.surface};color:${BAR.muted}`;
}

/** Чип статуса брони. */
export function reservationStatusStyle(status: string): string {
  switch (status) {
    case 'pending':   return `background:${BAR.amber}22;color:${BAR.amber}`;
    case 'confirmed': return `background:${BAR.green}22;color:${BAR.greenLight}`;
    case 'arrived':   return `background:${BAR.blue}22;color:${BAR.blueLight}`;
    case 'cancelled': return `background:${BAR.red}22;color:${BAR.red}`;
    default:          return `background:${BAR.border};color:${BAR.textMuted}`;
  }
}