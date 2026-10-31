import { defineConfig, devices } from '@playwright/test';
import { cucumberReporter, defineBddConfig } from 'playwright-bdd';

const testDir = defineBddConfig({
  features: 'features/generated/*.feature',
  steps: 'src/steps/*.ts',
  language: 'pt',
  outputDir: '.features-gen',
});

const isCI = !!process.env.CI;

export default defineConfig({
  testDir,
  fullyParallel: true,
  forbidOnly: isCI,
  // DemoQA é um site público e às vezes instável: 1 retry no CI evita falso negativo.
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [
    ['list'],
    ['./src/reporting/qa-reporter.ts', { outputDir: 'reports' }],
    cucumberReporter('json', { outputFile: 'reports/cucumber.json' }),
    ['html', { open: 'never', outputFolder: 'reports/playwright' }],
  ],
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1366, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
  },
});
