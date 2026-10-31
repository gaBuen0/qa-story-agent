import { findField, isEmptyMarker, normalizeEntries, resolveFieldLabels } from '../targets/normalize';
import type { FormTarget } from '../targets/types';
import type { Scenario } from './model';

/** Checa um cenário contra o formulário-alvo antes de virar teste. Retorna a lista de problemas. */
export function validateScenario(target: FormTarget, scenario: Scenario): string[] {
  const { values, errors } = normalizeEntries(target, scenario.fields);
  const invalid = resolveFieldLabels(target, scenario.invalidFields);
  errors.push(...invalid.errors);

  if (scenario.expect === 'submitted') {
    // Campo informado com valor errado já gerou erro acima; aqui só contam os que não foram informados.
    const informed = new Set(
      scenario.fields.filter((e) => !isEmptyMarker(e.value)).map((e) => findField(target, e.field)?.key),
    );
    const missing = target.fields
      .filter((f) => f.required && !(f.key in values) && !informed.has(f.key))
      .map((f) => f.label);
    if (missing.length) {
      errors.push(`espera envio com sucesso, mas faltam campos obrigatórios: ${missing.join(', ')}.`);
    }
    if (scenario.invalidFields.length) errors.push('espera envio com sucesso, mas lista campos inválidos.');
  } else if (!scenario.invalidFields.length) {
    errors.push('espera bloqueio, mas não informa quais campos devem ficar inválidos.');
  }

  return errors.map((e) => `cenário "${scenario.name}": ${e}`);
}
