import type { AgentLog } from '../agent/checks';

export type ScenarioStatus = 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted';

export interface StepResult {
  title: string;
  status: 'passed' | 'failed' | 'skipped';
  durationMs: number;
  error?: string;
}

export interface ScenarioResult {
  id: string;
  storyId: string;
  feature: string;
  scenario: string;
  tags: string[];
  xrayTestKey?: string;
  requirementKey?: string;
  status: ScenarioStatus;
  /** Passou só depois de um retry. */
  flaky: boolean;
  retries: number;
  startTime: string;
  durationMs: number;
  error?: string;
  steps: StepResult[];
  log?: AgentLog;
  /** Caminho relativo a reports/. */
  screenshot?: string;
}

export interface RunResult {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  status: 'passed' | 'failed' | 'timedout' | 'interrupted';
  scenarios: ScenarioResult[];
}
