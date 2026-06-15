import type { LucideIconInput } from '@lucide/angular';
import { LucideGlassWater, LucideUtensilsCrossed, LucideWind } from '@lucide/angular';

/** Цвет/фон/иконка по типу станции категории (bar/kitchen/hookah). */
export const CAT_TYPE_META: Record<string, { color: string; bg: string; icon: LucideIconInput }> = {
  bar:     { color: 'var(--color-bar)',     bg: 'var(--color-bar-bg)',     icon: LucideGlassWater },
  kitchen: { color: 'var(--color-kitchen)', bg: 'var(--color-kitchen-bg)', icon: LucideUtensilsCrossed },
  hookah:  { color: 'var(--color-hookah)',  bg: 'var(--color-hookah-bg)',  icon: LucideWind },
};

export function catMeta(type: string) {
  return CAT_TYPE_META[type] ?? { color: 'var(--color-muted)', bg: 'var(--color-bg)', icon: LucideGlassWater };
}