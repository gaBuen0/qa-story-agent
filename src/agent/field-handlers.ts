import path from 'node:path';
import type { Page } from '@playwright/test';
import { dateParts, formatInputDate, monthName } from '../targets/dates';
import { FILES_DIR } from '../targets/normalize';
import type { CanonicalValue, FieldKind, FieldSpec } from '../targets/types';

/**
 * Como operar cada tipo de componente.
 * - fill: interage com a tela como um usuário faria.
 * - read: lê de volta o que ficou na tela, para o agente conferir o próprio trabalho.
 * - display: como o valor esperado aparece na tela (para comparar com `read`).
 */
export interface FieldHandler {
  fill(page: Page, field: FieldSpec, value: CanonicalValue): Promise<void>;
  read(page: Page, field: FieldSpec): Promise<CanonicalValue>;
  display?(value: CanonicalValue): CanonicalValue;
}

const asList = (v: CanonicalValue) => (Array.isArray(v) ? v : [v]);
const asText = (v: CanonicalValue) => (Array.isArray(v) ? v.join(', ') : v);

const textInput: FieldHandler = {
  fill: (page, field, value) => page.locator(field.selector).fill(asText(value)),
  read: (page, field) => page.locator(field.selector).inputValue(),
};

/** Lê os rótulos das opções marcadas dentro de um grupo de radio/checkbox. */
async function checkedLabels(page: Page, field: FieldSpec): Promise<string[]> {
  return page.locator(field.selector).evaluate((group) =>
    [...group.querySelectorAll<HTMLInputElement>('input:checked')].map(
      (input) => group.querySelector(`label[for="${input.id}"]`)?.textContent?.trim() ?? input.value,
    ),
  );
}

export const handlers: Record<FieldKind, FieldHandler> = {
  text: textInput,
  textarea: textInput,

  'radio-group': {
    // O input real fica escondido atrás do label estilizado: clicamos no texto, como o usuário.
    fill: (page, field, value) => page.locator(field.selector).getByText(asText(value), { exact: true }).click(),
    read: async (page, field) => (await checkedLabels(page, field))[0] ?? '',
  },

  'checkbox-group': {
    fill: async (page, field, value) => {
      for (const option of asList(value)) {
        await page.locator(field.selector).getByText(option, { exact: true }).click();
      }
    },
    read: (page, field) => checkedLabels(page, field),
  },

  'react-datepicker': {
    fill: async (page, field, value) => {
      const { year, month, day } = dateParts(asText(value));
      await page.locator(field.selector).click();
      await page.locator('.react-datepicker__year-select').selectOption(String(year));
      await page.locator('.react-datepicker__month-select').selectOption({ label: monthName(month) });
      await page
        .locator(`.react-datepicker__day--${String(day).padStart(3, '0')}:not(.react-datepicker__day--outside-month)`)
        .click();
    },
    read: (page, field) => page.locator(field.selector).inputValue(),
    display: (value) => formatInputDate(asText(value)),
  },

  'autocomplete-multi': {
    fill: async (page, field, value) => {
      const input = page.locator(field.selector);
      for (const option of asList(value)) {
        await input.fill(option);
        await page.locator('[class*="auto-complete__option"]', { hasText: option }).first().click();
      }
    },
    read: (page, field) =>
      page
        .locator(field.selector)
        .locator('xpath=ancestor::div[contains(@class,"auto-complete__control")]')
        .locator('[class*="multi-value__label"]')
        .allTextContents(),
  },

  'react-select': {
    fill: async (page, field, value) => {
      await page.locator(`${field.selector} input`).fill(asText(value));
      await page.locator('[id^="react-select"][id*="-option-"]', { hasText: asText(value) }).first().click();
    },
    read: async (page, field) => {
      const single = page.locator(`${field.selector} [class*="singleValue"]`);
      return (await single.count()) ? ((await single.textContent()) ?? '').trim() : '';
    },
  },

  file: {
    fill: (page, field, value) => page.locator(field.selector).setInputFiles(path.join(FILES_DIR, asText(value))),
    read: (page, field) =>
      page.locator(field.selector).evaluate((el) => (el as HTMLInputElement).files?.[0]?.name ?? ''),
  },
};
