import { test, expect } from '@playwright/test';

// UI-смоук: реальный вход по PIN и загрузка ключевых экранов официанта.
// Требует поднятых фронта (4200) и e2e-бэкенда (8000) — поднимаются webServer'ом
// из playwright.config.ts (запускать с выключенными dev-серверами).

test('PIN-вход → приложение официанта (план зала)', async ({ page }) => {
  await page.goto('/pin');
  await page.keyboard.type('1111');                                  // numpad слушает клавиатуру
  await page.waitForURL(u => !u.pathname.endsWith('/pin'), { timeout: 15_000 });

  await page.goto('/waiter/tables');
  await expect(page.getByRole('heading', { name: 'Заказы' })).toBeVisible();
});

test('План зала: открытие стола показывает зоны/столы из бэкенда', async ({ page }) => {
  await page.goto('/pin');
  await page.keyboard.type('1111');
  await page.waitForURL(u => !u.pathname.endsWith('/pin'), { timeout: 15_000 });

  await page.goto('/waiter/tables');
  // Кнопка «+» (открыть стол) → шторка со столами из сида (зоны не «расходуются» тестами).
  const fab = page.locator('button[title="Открыть стол"]');
  await expect(fab).toBeVisible();
  await fab.click();
  // Зона VIP из сида внутри шторки открытия стола (берём первое совпадение — strict mode).
  await expect(page.locator('new-table-sheet').getByText('VIP', { exact: true }).first()).toBeVisible();
});