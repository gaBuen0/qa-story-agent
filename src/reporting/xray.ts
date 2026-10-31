import fs from 'node:fs';
import path from 'node:path';
import type { RunResult, ScenarioResult } from './types';

/**
 * Formato "Xray JSON" de importação de execução (Xray Cloud — POST /api/v2/import/execution).
 * Cenários com @TEST_<chave> atualizam o teste existente; os demais são criados como testes
 * "Generic", identificados de forma estável pela `definition` (história + cenário).
 */
export interface XrayEvidence {
  data: string;
  filename: string;
  contentType: string;
}

export interface XrayTest {
  testKey?: string;
  testInfo?: {
    projectKey: string;
    summary: string;
    type: 'Generic';
    definition: string;
    requirementKeys?: string[];
    labels?: string[];
  };
  start: string;
  finish: string;
  status: 'PASSED' | 'FAILED' | 'TODO';
  comment: string;
  evidence?: XrayEvidence[];
}

export interface XrayExecution {
  info: {
    summary: string;
    description: string;
    startDate: string;
    finishDate: string;
    testPlanKey?: string;
    testEnvironments?: string[];
  };
  tests: XrayTest[];
}

export interface XrayOptions {
  projectKey: string;
  testPlanKey?: string;
  environment?: string;
  reportsDir: string;
}

const STATUS: Record<ScenarioResult['status'], XrayTest['status']> = {
  passed: 'PASSED',
  failed: 'FAILED',
  timedOut: 'FAILED',
  interrupted: 'FAILED',
  skipped: 'TODO',
};

function comment(s: ScenarioResult): string {
  const checks = s.log?.checks ?? [];
  const failed = checks.filter((c) => !c.passed);
  const lines = [
    `Cenário: ${s.scenario}`,
    `Verificações de campo: ${checks.length - failed.length}/${checks.length} ok`,
  ];
  if (failed.length) {
    lines.push('', 'Divergências:');
    for (const c of failed) lines.push(`- [${c.phase}] ${c.field}: esperado "${c.expected}", obtido "${c.actual}"`);
  }
  if (s.error) lines.push('', `Erro: ${s.error.split('\n')[0]}`);
  return lines.join('\n');
}

export function toXrayExecution(run: RunResult, options: XrayOptions): XrayExecution {
  const passed = run.scenarios.filter((s) => s.status === 'passed').length;

  const tests = run.scenarios.map((s): XrayTest => {
    const finish = new Date(new Date(s.startTime).getTime() + s.durationMs).toISOString();
    const labels = s.tags
      .map((t) => t.replace(/^@/, ''))
      .filter((t) => !t.startsWith('TEST_') && !t.startsWith('REQ_'));

    const test: XrayTest = {
      start: s.startTime,
      finish,
      status: STATUS[s.status],
      comment: comment(s),
    };
    if (s.xrayTestKey) {
      test.testKey = s.xrayTestKey;
    } else {
      test.testInfo = {
        projectKey: options.projectKey,
        summary: `${s.storyId} · ${s.scenario}`,
        type: 'Generic',
        definition: `qa-story-agent::${s.storyId}::${s.scenario}`,
        requirementKeys: s.requirementKey ? [s.requirementKey] : undefined,
        labels,
      };
    }
    if (s.screenshot) {
      const file = path.join(options.reportsDir, s.screenshot);
      if (fs.existsSync(file)) {
        test.evidence = [
          { data: fs.readFileSync(file).toString('base64'), filename: path.basename(file), contentType: 'image/png' },
        ];
      }
    }
    return test;
  });

  return {
    info: {
      summary: `QA Story Agent — ${passed}/${run.scenarios.length} cenários aprovados`,
      description: 'Execução automatizada gerada a partir de histórias de usuário em Markdown (Playwright + BDD).',
      startDate: run.startedAt,
      finishDate: run.finishedAt,
      testPlanKey: options.testPlanKey,
      testEnvironments: options.environment ? [options.environment] : undefined,
    },
    tests,
  };
}

/** Envia a execução para o Xray Cloud. Retorna a resposta da API (chave da Test Execution criada). */
export async function uploadToXray(
  execution: XrayExecution,
  credentials: { clientId: string; clientSecret: string; baseUrl?: string },
): Promise<unknown> {
  const baseUrl = credentials.baseUrl ?? 'https://xray.cloud.getxray.app';
  const auth = await fetch(`${baseUrl}/api/v2/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: credentials.clientId, client_secret: credentials.clientSecret }),
  });
  if (!auth.ok) throw new Error(`Falha ao autenticar no Xray: HTTP ${auth.status} ${await auth.text()}`);
  const token = (await auth.json()) as string;

  const response = await fetch(`${baseUrl}/api/v2/import/execution`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(execution),
  });
  if (!response.ok) throw new Error(`Falha ao importar no Xray: HTTP ${response.status} ${await response.text()}`);
  return response.json();
}
