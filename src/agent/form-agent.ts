import { expect, type Page, type TestInfo } from '@playwright/test';
import type { FieldEntry } from '../story/model';
import { normalizeEntries, resolveFieldLabels } from '../targets/normalize';
import { getTarget } from '../targets/registry';
import type { CanonicalValue, FilledValues, FormTarget } from '../targets/types';
import { handlers } from './field-handlers';
import { AGENT_ATTACHMENT, formatFailures, sameValue, type AgentLog, type CheckPhase, type FieldCheck } from './checks';
import { confirmationHandler } from './confirmations';

const show = (v: CanonicalValue) => (Array.isArray(v) ? v.join(', ') : v);

/**
 * O agente de QA: abre o formulário, preenche cada campo como um usuário,
 * confere o que ficou na tela e valida o resultado campo a campo — tudo pela interface,
 * sem depender de API do sistema.
 */
export class FormAgent {
  private target?: FormTarget;
  private values: FilledValues = {};
  private readonly log: AgentLog = { target: '', actions: [], checks: [] };

  constructor(
    private readonly page: Page,
    private readonly testInfo: TestInfo,
  ) {}

  private get form(): FormTarget {
    if (!this.target) throw new Error('Nenhum formulário aberto. Use o passo "Dado que estou no formulário ...".');
    return this.target;
  }

  /** Abre um formulário registrado (pelo id) ou um alvo passado direto, como nos autotestes do agente. */
  async open(target: string | FormTarget): Promise<void> {
    this.target = typeof target === 'string' ? getTarget(target) : target;
    this.log.target = this.target.id;
    const blocked = this.target.blockRequests;
    if (blocked) {
      await this.page.route('**/*', (route) => (blocked.test(route.request().url()) ? route.abort() : route.continue()));
    }
    await this.page.goto(this.target.url, { waitUntil: 'domcontentloaded' });
    await this.target.afterLoad?.(this.page);
  }

  async fill(entries: FieldEntry[]): Promise<void> {
    const { values, errors } = normalizeEntries(this.form, entries);
    if (errors.length) throw new Error(`Dados do cenário inválidos:\n- ${errors.join('\n- ')}`);
    this.values = values;

    // Preenche na ordem da tela (garante, por exemplo, Estado antes de Cidade).
    for (const field of this.form.fields) {
      const value = values[field.key];
      if (value === undefined) continue;
      const handler = handlers[field.kind];

      const started = Date.now();
      await handler.fill(this.page, field, value);
      this.log.actions.push({ field: field.label, value: show(value), durationMs: Date.now() - started });

      const expected = show(handler.display?.(value) ?? value);
      const actual = show(await handler.read(this.page, field));
      const multi = Array.isArray(value);
      this.record('preenchimento', field.label, expected, actual, multi ? 'unordered-list' : 'exact');
    }
    this.assertPhase('preenchimento');
  }

  async submit(): Promise<void> {
    const button = this.page.locator(this.form.submitSelector);
    await button.scrollIntoViewIfNeeded();
    await button.click();
  }

  async expectSubmitted(): Promise<void> {
    try {
      // Visível, não só presente: há telas que já trazem a confirmação escondida na página.
      await expect(this.confirmation()).toBeVisible();
    } catch {
      // Não basta dizer "não enviou": o agente investiga quais campos a tela recusou.
      const invalid: string[] = [];
      for (const field of this.form.fields) {
        const element = this.page.locator(field.validitySelector ?? field.selector).first();
        if (!(await element.count())) continue;
        const valid = await element.evaluate((el) =>
          'checkValidity' in el ? (el as HTMLInputElement).checkValidity() : true,
        );
        if (!valid) {
          invalid.push(field.label);
          this.record('validação', field.label, 'válido', 'inválido');
        }
      }
      throw new Error(
        invalid.length
          ? `O formulário não foi enviado. Campos marcados como inválidos pela tela: ${invalid.join(', ')}.`
          : 'O formulário não foi enviado e nenhum campo foi marcado como inválido (a tela de confirmação não apareceu).',
      );
    }
  }

  /** Compara cada linha do resumo exibido com o que foi preenchido. Coleta tudo antes de falhar. */
  async validateSummary(): Promise<void> {
    const { confirmation } = this.form;
    const shown = await confirmationHandler(confirmation).read(this.page, confirmation, this.expectedSummary());

    for (const row of this.form.summary) {
      const expected = row.expected(this.values);
      if (expected === undefined) continue;
      const actual = shown.get(row.label);
      this.record('resumo', row.label, expected, actual ?? '(linha ausente)', row.match);
    }
    this.assertPhase('resumo');
  }

  async expectBlocked(): Promise<void> {
    // O envio é síncrono no cliente: se a confirmação não aparece logo, o formulário foi barrado.
    try {
      await expect(this.confirmation()).toBeHidden({ timeout: 3_000 });
    } catch {
      throw new Error('O formulário foi enviado (a tela de confirmação apareceu), mas a história esperava que fosse bloqueado.');
    }
  }

  async expectInvalid(labels: string[]): Promise<void> {
    const { fields, errors } = resolveFieldLabels(this.form, labels);
    if (errors.length) throw new Error(errors.join('\n'));

    for (const field of fields) {
      const element = this.page.locator(field.validitySelector ?? field.selector).first();
      const valid = await element.evaluate((el) => (el as HTMLInputElement).checkValidity());
      this.record('validação', field.label, 'inválido', valid ? 'válido' : 'inválido');
    }
    this.assertPhase('validação');
  }

  /** Chamado ao fim de cada cenário: anexa o log do agente e a tela final ao resultado. */
  async finish(): Promise<void> {
    await this.testInfo.attach(AGENT_ATTACHMENT, {
      body: JSON.stringify(this.log),
      contentType: 'application/json',
    });
    if (this.target && !this.page.isClosed()) {
      await this.testInfo.attach('tela-final', {
        body: await this.page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });
    }
  }

  /** Valores esperados na confirmação, por rótulo (ou coluna). */
  private expectedSummary(): Map<string, string> {
    const expected = new Map<string, string>();
    for (const row of this.form.summary) {
      const value = row.expected(this.values);
      if (value !== undefined) expected.set(row.label, value);
    }
    return expected;
  }

  /** O elemento que só aparece quando o envio deu certo. */
  private confirmation() {
    const { confirmation } = this.form;
    return confirmationHandler(confirmation).locate(this.page, confirmation, this.expectedSummary());
  }

  private record(phase: CheckPhase, field: string, expected: string, actual: string, match?: 'exact' | 'unordered-list') {
    const check: FieldCheck = { phase, field, expected, actual, passed: sameValue(expected, actual, match) };
    this.log.checks.push(check);
  }

  private assertPhase(phase: CheckPhase) {
    const checks = this.log.checks.filter((c) => c.phase === phase);
    if (checks.some((c) => !c.passed)) throw new Error(formatFailures(checks));
  }
}
