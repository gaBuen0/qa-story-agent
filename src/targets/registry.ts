import { demoqaPracticeForm } from './demoqa-practice-form';
import { demoqaWebTables } from './demoqa-web-tables';
import type { FormTarget } from './types';

const TARGETS: Record<string, FormTarget> = Object.fromEntries(
  [demoqaPracticeForm, demoqaWebTables].map((target) => [target.id, target]),
);

export function getTarget(id: string): FormTarget {
  const target = TARGETS[id];
  if (!target) {
    throw new Error(`Formulário-alvo desconhecido: "${id}". Disponíveis: ${Object.keys(TARGETS).join(', ')}`);
  }
  return target;
}

export function listTargets(): FormTarget[] {
  return Object.values(TARGETS);
}
