const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export interface DateParts {
  year: number;
  month: number; // 1-12
  day: number;
}

/** Aceita dd/mm/aaaa (formato das histórias) ou aaaa-mm-dd. Retorna ISO ou null. */
export function parseDate(raw: string): string | null {
  const text = raw.trim();
  const br = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  let parts: DateParts | null = null;
  if (br) parts = { day: Number(br[1]), month: Number(br[2]), year: Number(br[3]) };
  else if (iso) parts = { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) };
  if (!parts) return null;

  const d = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const valid =
    d.getUTCFullYear() === parts.year && d.getUTCMonth() === parts.month - 1 && d.getUTCDate() === parts.day;
  if (!valid) return null;
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function dateParts(iso: string): DateParts {
  const [year, month, day] = iso.split('-').map(Number);
  return { year: year!, month: month!, day: day! };
}

export function monthName(month: number): string {
  return MONTHS[month - 1]!;
}

/** "15 May,1990" — formato da tela de confirmação do DemoQA. */
export function formatSummaryDate(iso: string): string {
  const { year, month, day } = dateParts(iso);
  return `${String(day).padStart(2, '0')} ${monthName(month)},${year}`;
}

/** "15 May 1990" — formato exibido no campo depois de escolher a data. */
export function formatInputDate(iso: string): string {
  const { year, month, day } = dateParts(iso);
  return `${String(day).padStart(2, '0')} ${monthName(month).slice(0, 3)} ${year}`;
}
