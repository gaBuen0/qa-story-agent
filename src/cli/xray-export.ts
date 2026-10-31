/**
 * Converte reports/results.json no formato de importação do Xray.
 *
 *   npm run xray:export                 gera reports/xray-execution.json (não precisa de Jira)
 *   npm run xray:export -- --upload     também envia para o Xray Cloud
 *
 * Variáveis: XRAY_PROJECT_KEY (padrão QA), XRAY_TEST_PLAN_KEY, XRAY_ENVIRONMENT,
 *            XRAY_CLIENT_ID, XRAY_CLIENT_SECRET (só para --upload), XRAY_BASE_URL.
 */
import './env';
import fs from 'node:fs';
import path from 'node:path';
import type { RunResult } from '../reporting/types';
import { toXrayExecution, uploadToXray } from '../reporting/xray';

const REPORTS_DIR = path.resolve('reports');

async function main() {
  const resultsFile = path.join(REPORTS_DIR, 'results.json');
  if (!fs.existsSync(resultsFile)) {
    console.error('reports/results.json não encontrado. Rode "npm run test:e2e" antes.');
    process.exit(1);
  }
  const run = JSON.parse(fs.readFileSync(resultsFile, 'utf8')) as RunResult;

  const execution = toXrayExecution(run, {
    projectKey: process.env.XRAY_PROJECT_KEY ?? 'QA',
    testPlanKey: process.env.XRAY_TEST_PLAN_KEY || undefined,
    environment: process.env.XRAY_ENVIRONMENT || undefined,
    reportsDir: REPORTS_DIR,
  });

  const outFile = path.join(REPORTS_DIR, 'xray-execution.json');
  fs.writeFileSync(outFile, JSON.stringify(execution, null, 2));
  const linked = execution.tests.filter((t) => t.testKey).length;
  console.log(
    `Xray: ${execution.tests.length} resultado(s) → ${path.relative(process.cwd(), outFile)} ` +
      `(${linked} vinculado(s) a testes existentes, ${execution.tests.length - linked} a criar)`,
  );

  if (!process.argv.includes('--upload')) return;

  const clientId = process.env.XRAY_CLIENT_ID;
  const clientSecret = process.env.XRAY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error('Para --upload, defina XRAY_CLIENT_ID e XRAY_CLIENT_SECRET.');
    process.exit(1);
  }
  const response = await uploadToXray(execution, { clientId, clientSecret, baseUrl: process.env.XRAY_BASE_URL });
  console.log('Xray: execução importada.', JSON.stringify(response));
}

main().catch((err) => {
  console.error((err as Error).message);
  process.exit(1);
});
