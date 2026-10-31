import { defineConfig, devices } from '@playwright/test';

/**
 * Autotestes do agente: rodam contra um formulário local com defeitos plantados.
 * Não dependem de internet nem do DemoQA, e ficam fora dos relatórios de QA e do Xray.
 */
export default defineConfig({
  testDir: 'tests/agent',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  timeout: 30_000,
  // Curto de propósito: os cenários de defeito esperam a confirmação que nunca aparece.
  expect: { timeout: 2_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'reports/agent-self-test' }]],
  use: {
    ...devices['Desktop Chrome'],
    trace: 'retain-on-failure',
  },
});
