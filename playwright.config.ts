import { defineConfig, devices } from '@playwright/test';
import { cucumberReporter, defineBddConfig } from 'playwright-bdd';

const testDir = defineBddConfig({
  features: 'features/generated/*.feature',
  steps: 'src/steps/*.ts',
  language: 'pt',
  outputDir: '.features-gen',
});

const isCI = !!process.env.CI;

// `npm run test:headed`: navegador visível, um cenário por vez e cada ação desacelerada,
// para dar tempo de acompanhar o preenchimento. SLOW_MO muda o atraso (em ms).
// O npm repassa o nome do script aos processos filhos, então os workers também enxergam.
const watching = process.env.npm_lifecycle_event === 'test:headed';
const slowMo = watching ? Number(process.env.SLOW_MO ?? 300) : 0;

export default defineConfig({
  testDir,
  fullyParallel: true,
  forbidOnly: isCI,
  // DemoQA é um site público e às vezes instável: 1 retry no CI evita falso negativo.
  retries: isCI ? 1 : 0,
  workers: watching ? 1 : isCI ? 2 : undefined,
  timeout: watching ? 300_000 : 60_000,
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
    headless: !watching,
    launchOptions: { slowMo },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
  },
});
