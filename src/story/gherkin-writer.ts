import type { Scenario, Story } from './model';

export interface GenerationInfo {
  interpreter: string;
}

export const HASH_HEADER = '# source-hash:';

const escapeCell = (text: string) => text.replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
const quote = (text: string) => text.replace(/"/g, "'");

/** Uma linha de descrição que começa com palavra-chave ("E", "Dado"...) seria lida como passo. */
const STEP_KEYWORD = /^(dado|dada|dados|dadas|quando|ent[ãa]o|e|mas|cen[áa]rio|exemplos|contexto|regra)\b/i;
const safeDescription = (line: string) => (STEP_KEYWORD.test(line) ? `— ${line}` : line);

function table(rows: string[][], indent: string): string[] {
  const widths = rows[0]!.map((_, col) => Math.max(...rows.map((r) => r[col]!.length)));
  return rows.map((r) => `${indent}| ${r.map((cell, col) => cell.padEnd(widths[col]!)).join(' | ')} |`);
}

function tagLine(tags: string[], indent: string): string[] {
  const unique = [...new Set(tags.filter(Boolean))];
  return unique.length ? [`${indent}${unique.map((t) => `@${t}`).join(' ')}`] : [];
}

function scenarioLines(story: Story, scenario: Scenario): string[] {
  const tags = [...scenario.tags];
  if (scenario.xrayTestKey) tags.push(`TEST_${scenario.xrayTestKey}`);

  const lines = ['', ...tagLine(tags, '  '), `  Cenário: ${scenario.name}`];
  if (scenario.description) lines.push(...scenario.description.split('\n').map((l) => `    ${safeDescription(l)}`), '');

  lines.push(`    Dado que estou no formulário "${story.target}"`);
  lines.push('    Quando preencho o formulário com:');
  lines.push(...table([['Campo', 'Valor'], ...scenario.fields.map((f) => [escapeCell(f.field), escapeCell(f.value)])], '      '));
  lines.push('    E envio o formulário');

  if (scenario.expect === 'submitted') {
    lines.push('    Então o formulário deve ser enviado com sucesso');
    lines.push('    E o resumo deve exibir os dados informados');
  } else {
    lines.push('    Então o formulário não deve ser enviado');
    lines.push(`    E os campos "${quote(scenario.invalidFields.join(', '))}" devem estar inválidos`);
  }
  return lines;
}

/** Converte a história em um arquivo .feature (Gherkin em português), pronto para o playwright-bdd. */
export function writeFeature(story: Story, scenarios: Scenario[], info: GenerationInfo): string {
  const featureTags = [story.id, ...story.tags];
  if (story.requirementKey) featureTags.push(`REQ_${story.requirementKey}`);

  const { asA, iWant, soThat } = story.narrative;
  const narrative = [asA && `Como ${asA}`, iWant && `Quero ${iWant}`, soThat && `Para ${soThat}`].filter(
    (l): l is string => Boolean(l),
  );

  const lines = [
    '# language: pt',
    `# Gerado automaticamente a partir de ${story.sourcePath} — não edite à mão.`,
    `${HASH_HEADER} ${story.sourceHash}`,
    `# interpretação: ${info.interpreter}`,
    ...tagLine(featureTags, ''),
    `Funcionalidade: ${story.id} · ${story.title}`,
    ...narrative.map((l) => `  ${l}`),
    ...scenarios.flatMap((s) => scenarioLines(story, s)),
  ];
  return `${lines.join('\n')}\n`;
}

/** Lê o hash da história que gerou um .feature existente. */
export function readSourceHash(feature: string): string | undefined {
  const line = feature.split(/\r?\n/).find((l) => l.startsWith(HASH_HEADER));
  return line?.slice(HASH_HEADER.length).trim();
}
