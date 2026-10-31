import { demoqaPracticeForm } from './demoqa-practice-form';
import type { FormTarget } from './types';

const TARGETS: Record<string, FormTarget> = {
  [demoqaPracticeForm.id]: demoqaPracticeForm,
};

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
