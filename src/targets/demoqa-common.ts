import type { Page } from '@playwright/test';
import type { FilledValues } from './types';

/** Anúncios e analytics do DemoQA: bloqueados para o teste não depender deles. */
export const DEMOQA_BLOCKED_REQUESTS =
  /googlesyndication|doubleclick|adservice|googletagmanager|google-analytics|adplus|ezoic|amazon-adsystem|pubmatic|criteo/;

/** Banners fixos do site cobrem botões em telas menores. */
export async function removeDemoqaBanners(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.querySelectorAll('#fixedban, footer, #adplus-anchor, iframe').forEach((el) => {
      el.remove();
    });
  });
}

export const str = (v: FilledValues[string] | undefined): string =>
  v === undefined ? '' : Array.isArray(v) ? v.join(', ') : v;
