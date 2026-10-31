/** Uma linha "Campo | Valor" de um cenário, exatamente como escrita na história. */
export interface FieldEntry {
  field: string;
  value: string;
}

export type ExpectedOutcome = 'submitted' | 'blocked';

export interface Scenario {
  name: string;
  description?: string;
  /** Tags sem o "@". */
  tags: string[];
  /** Chave do teste no Xray (ex.: QA-101), vira a tag @TEST_QA-101. */
  xrayTestKey?: string;
  fields: FieldEntry[];
  expect: ExpectedOutcome;
  /** Rótulos dos campos que devem ficar inválidos quando o envio é bloqueado. */
  invalidFields: string[];
}

export interface Narrative {
  asA?: string;
  iWant?: string;
  soThat?: string;
}

export type InterpretationMode = 'deterministic' | 'llm';

export interface Story {
  id: string;
  title: string;
  /** Id do formulário-alvo (ver src/targets). */
  target: string;
  sourcePath: string;
  /** Hash do arquivo de origem: detecta quando o .feature gerado ficou desatualizado. */
  sourceHash: string;
  narrative: Narrative;
  tags: string[];
  /** Chave do requisito no Jira/Xray (ex.: QA-10), vira a tag @REQ_QA-10. */
  requirementKey?: string;
  interpretation: InterpretationMode;
  /** Cenários estruturados. Vazio quando a história é texto livre (modo LLM). */
  scenarios: Scenario[];
  /** Corpo da história em texto, usado como entrada do LLM. */
  body: string;
}

export class StoryError extends Error {
  constructor(
    readonly file: string,
    message: string,
  ) {
    super(`${file}: ${message}`);
    this.name = 'StoryError';
  }
}
