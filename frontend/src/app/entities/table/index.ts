export { TableApi } from './table.api';

// Разбор строки объединённого стола («11+12»).
export { tableSegments } from './lib/segments';

// Политика депозита по зоне стола (VIP). Namespace `deposit` + именованные.
export * as deposit from './lib/deposit';
export { zoneOfTable, zoneOfTableId, zonePolicy, depositPolicy } from './lib/deposit';
export type { DepositPolicy } from './lib/deposit';