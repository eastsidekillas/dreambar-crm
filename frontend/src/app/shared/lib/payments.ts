import type { LucideIconInput } from '@lucide/angular';
import {
  LucideBanknote, LucideCreditCard, LucideSmartphone, LucideShuffle,
} from '@lucide/angular';
import { PaymentMethod } from '../../core/models';

export const PAY_ICON: Record<string, LucideIconInput> = {
  cash:     LucideBanknote,
  card:     LucideCreditCard,
  transfer: LucideSmartphone,
  mixed:    LucideShuffle,
};

/** Способы оплаты, доступные при закрытии счёта. */
export const PAY_OPTIONS: { value: PaymentMethod; label: string; icon: LucideIconInput }[] = [
  { value: 'cash',     label: 'Наличные', icon: LucideBanknote },
  { value: 'card',     label: 'Карта',    icon: LucideCreditCard },
  { value: 'transfer', label: 'Перевод',  icon: LucideSmartphone },
];