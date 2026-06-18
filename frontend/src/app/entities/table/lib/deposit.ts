import { Zone } from '../../../core/models';
import { tableSegments } from './segments';

/** Политика депозита для конкретного стола (выводится из его зоны). */
export interface DepositPolicy {
  /** Брать ли депозит на этом столе (VIP-зона). */
  enabled: boolean;
  /** Минимальная сумма депозита, ₽ (0 — без минимума). */
  min: number;
}

/** Зона стола по НОМЕРУ. Объединённые столы («11+12») — берём первый сегмент
 * (главный стол заказа). null, если не найдено. */
export function zoneOfTable(zones: Zone[], tableNumber: string): Zone | null {
  const num = tableSegments(tableNumber)[0];
  if (!num) return null;
  return zones.find(z => z.tables.some(t => t.number === num)) ?? null;
}

/** Зона стола по ID (формы броней выбирают стол по id). null, если не найдено. */
export function zoneOfTableId(zones: Zone[], tableId: number | null): Zone | null {
  if (tableId == null) return null;
  return zones.find(z => z.tables.some(t => t.id === tableId)) ?? null;
}

/** Политика депозита по зоне — без хардкода, всё из флага зоны. */
export function zonePolicy(zone: Zone | null): DepositPolicy {
  return { enabled: !!zone?.requires_deposit, min: zone ? +zone.min_deposit : 0 };
}

/** Политика депозита для стола по НОМЕРУ (заказ/чек). */
export function depositPolicy(zones: Zone[], tableNumber: string): DepositPolicy {
  return zonePolicy(zoneOfTable(zones, tableNumber));
}