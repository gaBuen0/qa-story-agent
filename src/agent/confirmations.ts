import { expect, type Locator, type Page } from '@playwright/test';
import type { ConfirmationSpec } from '../targets/types';

type SpecOf<K extends ConfirmationSpec['kind']> = Extract<ConfirmationSpec, { kind: K }>;

/**
 * Como cada formato de confirmação é lido.
 * - locate: o elemento que só aparece quando o envio deu certo.
 * - read: o que a tela mostra, como rótulo (ou coluna) → valor.
 * `expected` traz os valores esperados por rótulo, para achar o registro certo quando há vários.
 */
export interface ConfirmationHandler<K extends ConfirmationSpec['kind']> {
  locate(page: Page, spec: SpecOf<K>, expected: Map<string, string>): Locator;
  read(page: Page, spec: SpecOf<K>, expected: Map<string, string>): Promise<Map<string, string>>;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Célula cujo texto é exatamente o valor (ignorando espaços nas pontas). */
const cellWithText = (page: Page, text: string) =>
  page.locator('td').filter({ hasText: new RegExp(`^\\s*${escapeRegex(text)}\\s*$`) });

const labelValueTable: ConfirmationHandler<'label-value-table'> = {
  locate: (page, spec) => page.locator(spec.title.selector).filter({ hasText: spec.title.text }),
  read: async (page, spec) => {
    const rows = page.locator(spec.rowsSelector);
    await expect(rows.first()).toBeVisible();
    const pairs = await rows.evaluateAll((trs) =>
      trs.map((tr) => [tr.children[0]?.textContent?.trim() ?? '', tr.children[1]?.textContent?.trim() ?? ''] as const),
    );
    return new Map(pairs);
  },
};

const tableRow: ConfirmationHandler<'table-row'> = {
  locate: (page, spec, expected) => {
    let rows = page.locator(spec.tableSelector).locator('tbody tr');
    const key = expected.get(spec.keyColumn);
    // Pela chave, a linha é achada mesmo com outras colunas erradas, e o agente aponta quais.
    const filters = key ? [key] : [...expected.values()].filter(Boolean);
    for (const value of filters) rows = rows.filter({ has: cellWithText(page, value) });
    return rows.first();
  },
  read: async (page, spec, expected) => {
    const row = tableRow.locate(page, spec, expected);
    await expect(row).toBeVisible();
    const headers = await page
      .locator(spec.tableSelector)
      .locator('thead th')
      .evaluateAll((ths) => ths.map((th) => th.textContent?.trim() ?? ''));
    const cells = await row.locator('td').evaluateAll((tds) => tds.map((td) => td.textContent?.trim() ?? ''));
    return new Map(headers.map((header, i) => [header, cells[i] ?? '']));
  },
};

const confirmationHandlers: { [K in ConfirmationSpec['kind']]: ConfirmationHandler<K> } = {
  'label-value-table': labelValueTable,
  'table-row': tableRow,
};

export function confirmationHandler(spec: ConfirmationSpec): ConfirmationHandler<ConfirmationSpec['kind']> {
  return confirmationHandlers[spec.kind] as ConfirmationHandler<ConfirmationSpec['kind']>;
}
