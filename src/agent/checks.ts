/** Em que momento a verificação foi feita. */
export type CheckPhase = 'preenchimento' | 'resumo' | 'validação';

export interface FieldCheck {
  phase: CheckPhase;
  field: string;
  expected: string;
  actual: string;
  passed: boolean;
}

export interface AgentAction {
  field: string;
  value: string;
  durationMs: number;
}

/** O que o agente registra em cada cenário — vai como anexo para o relatório. */
export interface AgentLog {
  target: string;
  actions: AgentAction[];
  checks: FieldCheck[];
}

export const AGENT_ATTACHMENT = 'qa-agent-log';

const normalizeSpaces = (s: string) => s.replace(/\s+/g, ' ').trim();
const toList = (s: string) =>
  s
    .split(',')
    .map((p) => normalizeSpaces(p))
    .filter(Boolean)
    .sort();

export function sameValue(expected: string, actual: string, match: 'exact' | 'unordered-list' = 'exact'): boolean {
  if (match === 'unordered-list') return toList(expected).join('|') === toList(actual).join('|');
  return normalizeSpaces(expected) === normalizeSpaces(actual);
}

/** Tabela legível com as divergências, usada na mensagem de erro do teste. */
export function formatFailures(checks: FieldCheck[]): string {
  const failed = checks.filter((c) => !c.passed);
  const rows = failed.map((c) => `  • ${c.field}: esperado "${c.expected}", obtido "${c.actual}"`);
  return `${failed.length} de ${checks.length} verificações falharam (${failed[0]?.phase ?? ''}):\n${rows.join('\n')}`;
}
