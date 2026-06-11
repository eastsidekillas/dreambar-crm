import type { LucideIconInput } from '@lucide/angular';
import {
  LucideCrown, LucideUser, LucideGlassWater, LucideChefHat, LucideShirt, LucideWind,
} from '@lucide/angular';

/** Человекочитаемые названия ролей (соответствуют UserProfile.ROLES на backend). */
export const ROLE_LABEL: Record<string, string> = {
  admin:     'Администратор',
  waiter:    'Официант',
  bartender: 'Бармен',
  kitchen:   'Кухня',
  wardrobe:  'Гардероб',
};

export const ROLE_COLOR: Record<string, string> = {
  admin:     '#f59e0b',
  bartender: '#3b82f6',
  waiter:    '#10b981',
  kitchen:   '#ef4444',
  hookah:    '#8b5cf6',
  wardrobe:  '#64748b',
};

export const ROLE_ICON: Record<string, LucideIconInput> = {
  admin:     LucideCrown,
  waiter:    LucideUser,
  bartender: LucideGlassWater,
  kitchen:   LucideChefHat,
  wardrobe:  LucideShirt,
  hookah:    LucideWind,
};