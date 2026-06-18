import { defineConfig, devices } from '@playwright/test';

// PW_NO_SERVER=1 — не поднимать серверы автоматически (когда backend/ng serve уже запущены вручную).
const NO_SERVER = !!process.env.PW_NO_SERVER;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: false,   // общий сид в e2e-БД → гоняем последовательно
  workers: 1,
  retries: 0,
  reporter: [['list']],

  projects: [
    {
      name: 'api',
      testDir: './e2e/api',
      use: { baseURL: 'http://127.0.0.1:8000' },
    },
    {
      name: 'ui',
      testDir: './e2e/ui',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4200' },
    },
  ],

  webServer: NO_SERVER ? undefined : [
    {
      command: 'bash e2e/backend.sh',
      port: 8000,
      reuseExistingServer: false,
      timeout: 90_000,
    },
    {
      command: 'npm start -- --host 127.0.0.1 --port 4200',
      port: 4200,
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});