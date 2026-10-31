import type { Page } from '@playwright/test';

/**
 * Tipos de componente que o agente sabe operar.
 * Suportar um novo componente = escrever um handler em src/agent/field-handlers.ts.
 */
export type FieldKind =
  | 'text'
  | 'textarea'
  | 'radio-group'
  | 'checkbox-group'
  | 'react-datepicker'
  | 'autocomplete-multi'
  | 'react-select'
  | 'file';

export const MULTI_VALUE_KINDS: ReadonlySet<FieldKind> = new Set(['checkbox-group', 'autocomplete-multi']);

export interface OptionSpec {
  /** Valor exatamente como aparece na tela. */
  value: string;
  /** Outras formas aceitas na história (ex.: em português). */
  aliases?: string[];
  /** Para listas dependentes: valor da opção-pai (ex.: cidade → estado). */
  parent?: string;
}

export interface FieldSpec {
  key: string;
  /** Nome canônico do campo nas histórias (pt-BR). */
  label: string;
  aliases?: string[];
  kind: FieldKind;
  /** Seletor do campo (ou do grupo, para radio/checkbox). */
  selector: string;
  options?: OptionSpec[];
  required?: boolean;
  /** Elemento consultado com checkValidity() quando o campo deve estar inválido. */
  validitySelector?: string;
  /** Dica de formato, mostrada ao LLM e nas mensagens de erro. */
  hint?: string;
  dependsOn?: string;
}

/** Valor já normalizado: string para campos simples, lista para multivalorados. */
export type CanonicalValue = string | string[];
export type FilledValues = Record<string, CanonicalValue>;

export interface SummaryRow {
  /** Rótulo da linha na tela de confirmação. */
  label: string;
  /** Valor esperado a partir do que foi preenchido. `undefined` = não verificar. */
  expected: (values: FilledValues) => string | undefined;
  /** Listas podem aparecer em qualquer ordem. */
  match?: 'exact' | 'unordered-list';
}

export interface FormTarget {
  id: string;
  name: string;
  url: string;
  fields: FieldSpec[];
  /** Requisições bloqueadas (anúncios, analytics) para deixar o teste estável. */
  blockRequests?: RegExp;
  /** Ajustes depois de carregar a página (ex.: remover banners que cobrem botões). */
  afterLoad?: (page: Page) => Promise<void>;
  submitSelector: string;
  success: { selector: string; text: string };
  /** Linhas da tabela de confirmação: 1ª célula = rótulo, 2ª = valor. */
  summaryRowsSelector: string;
  summary: SummaryRow[];
  /** Regras entre campos (ex.: cidade precisa pertencer ao estado). */
  crossValidate?: (values: FilledValues) => string[];
}
