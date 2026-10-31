import fs from 'node:fs';
import path from 'node:path';
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
  TestStep,
} from '@playwright/test/reporter';
import { AGENT_ATTACHMENT, type AgentLog } from '../agent/checks';
import { renderHtmlReport } from './html-report';
import type { RunResult, ScenarioResult, StepResult } from './types';

// biome-ignore lint/suspicious/noControlCharactersInRegex: remove de propósito os códigos de cor (ANSI) das mensagens do Playwright.
const ANSI = /\x1b\[[0-9;]*m/g;
const GHERKIN_STEP = /^(Dado|Dada|Quando|Então|Entao|E|Mas)\s/;

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

function collectSteps(steps: TestStep[]): StepResult[] {
  const out: StepResult[] = [];
  for (const step of steps) {
    if (step.category === 'test.step' && GHERKIN_STEP.test(step.title)) {
      out.push({
        title: step.title,
        status: step.error ? 'failed' : 'passed',
        durationMs: step.duration,
        error: step.error?.message?.replace(ANSI, ''),
      });
    } else {
      out.push(...collectSteps(step.steps));
    }
  }
  return out;
}

/**
 * Reporter próprio: junta o resultado de cada cenário com o log do agente
 * (verificações campo a campo) e gera reports/results.json + reports/qa-report.html.
 */
export default class QaReporter implements Reporter {
  private readonly outputDir: string;
  private readonly results = new Map<string, ScenarioResult>();
  private startedAt = new Date();

  constructor(options: { outputDir?: string } = {}) {
    this.outputDir = path.resolve(options.outputDir ?? 'reports');
  }

  printsToStdio() {
    return false;
  }

  onBegin(_config: FullConfig, _suite: Suite) {
    this.startedAt = new Date();
    fs.rmSync(path.join(this.outputDir, 'screenshots'), { recursive: true, force: true });
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const tags = test.tags;
    const plain = tags.map((t) => t.replace(/^@/, ''));
    const storyId = plain.find((t) => /^[A-Z]+-\d+$/.test(t)) ?? 'sem-id';

    const logAttachment = result.attachments.find((a) => a.name === AGENT_ATTACHMENT);
    const log = logAttachment?.body ? (JSON.parse(logAttachment.body.toString('utf8')) as AgentLog) : undefined;

    let screenshot: string | undefined;
    const shot = result.attachments.find((a) => a.name === 'tela-final' && (a.body || a.path));
    if (shot) {
      const file = path.join('screenshots', `${storyId}-${slug(test.title)}.png`);
      fs.mkdirSync(path.join(this.outputDir, 'screenshots'), { recursive: true });
      const data = shot.body ?? fs.readFileSync(shot.path!);
      fs.writeFileSync(path.join(this.outputDir, file), data);
      screenshot = file.replace(/\\/g, '/');
    }

    const outcome = test.outcome();
    // Com retry, o último resultado sobrescreve os anteriores.
    this.results.set(test.id, {
      id: test.id,
      storyId,
      feature: test.parent.title,
      scenario: test.title,
      tags,
      xrayTestKey: plain.find((t) => t.startsWith('TEST_'))?.slice(5),
      requirementKey: plain.find((t) => t.startsWith('REQ_'))?.slice(4),
      status: result.status,
      flaky: outcome === 'flaky',
      retries: result.retry,
      startTime: result.startTime.toISOString(),
      durationMs: result.duration,
      error: result.errors[0]?.message?.replace(ANSI, ''),
      steps: collectSteps(result.steps),
      log,
      screenshot,
    });
  }

  onEnd(result: FullResult) {
    const finishedAt = new Date();
    const run: RunResult = {
      startedAt: this.startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - this.startedAt.getTime(),
      status: result.status,
      scenarios: [...this.results.values()].sort(
        (a, b) => a.storyId.localeCompare(b.storyId) || a.scenario.localeCompare(b.scenario),
      ),
    };
    fs.mkdirSync(this.outputDir, { recursive: true });
    fs.writeFileSync(path.join(this.outputDir, 'results.json'), JSON.stringify(run, null, 2));
    fs.writeFileSync(path.join(this.outputDir, 'qa-report.html'), renderHtmlReport(run, this.outputDir));
    console.log(`\nRelatório do agente: ${path.relative(process.cwd(), path.join(this.outputDir, 'qa-report.html'))}`);
  }
}
