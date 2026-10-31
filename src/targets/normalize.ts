import fs from 'node:fs';
import path from 'node:path';
import type { FieldEntry } from '../story/model';
import { parseDate } from './dates';
import { type CanonicalValue, type FieldSpec, type FilledValues, type FormTarget, MULTI_VALUE_KINDS } from './types';

export const FILES_DIR = path.resolve('fixtures/files');

/** Valores que significam "deixar o campo em branco de propósito". */
const EMPTY_MARKERS = new Set(['', '(vazio)', '(em branco)', '-']);
export const isEmptyMarker = (value: string) => EMPTY_MARKERS.has(value.trim().toLowerCase());

/** Comparação tolerante: ignora maiúsculas, acentos e espaços extras. */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function findField(target: FormTarget, label: string): FieldSpec | undefined {
  const wanted = fold(label);
  return target.fields.find(
    (f) => fold(f.label) === wanted || fold(f.key) === wanted || f.aliases?.some((a) => fold(a) === wanted),
  );
}

function describeOptions(field: FieldSpec): string {
  return (field.options ?? [])
    .map((o) => (o.aliases?.length ? `${o.value} (${o.aliases.join(', ')})` : o.value))
    .join(', ');
}

function resolveOption(field: FieldSpec, raw: string): string | null {
  const wanted = fold(raw);
  const option = field.options?.find((o) => fold(o.value) === wanted || o.aliases?.some((a) => fold(a) === wanted));
  return option?.value ?? null;
}

/** Converte o valor escrito na história no valor que a tela espera. Lança erro legível se não der. */
export function normalizeValue(field: FieldSpec, raw: string): CanonicalValue {
  const value = raw.trim();

  if (MULTI_VALUE_KINDS.has(field.kind)) {
    const parts = value.split(/\s*[,;]\s*/).filter(Boolean);
    return parts.map((part) => {
      const resolved = resolveOption(field, part);
      if (!resolved) {
        throw new Error(`valor "${part}" inválido para "${field.label}". Opções: ${describeOptions(field)}`);
      }
      return resolved;
    });
  }

  switch (field.kind) {
    case 'radio-group':
    case 'react-select': {
      const resolved = resolveOption(field, value);
      if (!resolved)
        throw new Error(`valor "${value}" inválido para "${field.label}". Opções: ${describeOptions(field)}`);
      return resolved;
    }
    case 'react-datepicker': {
      const iso = parseDate(value);
      if (!iso) throw new Error(`data "${value}" inválida para "${field.label}". Use dd/mm/aaaa.`);
      return iso;
    }
    case 'file': {
      if (!fs.existsSync(path.join(FILES_DIR, value))) {
        throw new Error(`arquivo "${value}" não encontrado em fixtures/files (campo "${field.label}").`);
      }
      return value;
    }
    default:
      // Texto livre é aceito como está: cenários negativos precisam de valores "errados".
      return value;
  }
}

export interface NormalizedEntries {
  values: FilledValues;
  errors: string[];
}

/** Valida e normaliza todas as linhas de um cenário, acumulando os erros em vez de parar no primeiro. */
export function normalizeEntries(target: FormTarget, entries: FieldEntry[]): NormalizedEntries {
  const values: FilledValues = {};
  const errors: string[] = [];

  for (const entry of entries) {
    const field = findField(target, entry.field);
    if (!field) {
      errors.push(
        `campo "${entry.field}" não existe em "${target.name}". Campos: ${target.fields.map((f) => f.label).join(', ')}`,
      );
      continue;
    }
    if (field.key in values) {
      errors.push(`campo "${field.label}" aparece mais de uma vez.`);
      continue;
    }
    if (isEmptyMarker(entry.value)) continue;
    try {
      values[field.key] = normalizeValue(field, entry.value);
    } catch (err) {
      errors.push((err as Error).message);
    }
  }

  errors.push(...(target.crossValidate?.(values) ?? []));
  return { values, errors };
}

/** Garante que cada campo listado como "inválido" existe no formulário. */
export function resolveFieldLabels(target: FormTarget, labels: string[]): { fields: FieldSpec[]; errors: string[] } {
  const fields: FieldSpec[] = [];
  const errors: string[] = [];
  for (const label of labels) {
    const field = findField(target, label);
    if (field) fields.push(field);
    else errors.push(`campo inválido esperado "${label}" não existe em "${target.name}".`);
  }
  return { fields, errors };
}
