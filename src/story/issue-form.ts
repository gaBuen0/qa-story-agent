/**
 * Converte uma issue do formulário "Nova história" (.github/ISSUE_TEMPLATE/historia.yml)
 * no arquivo Markdown de uma história.
 *
 * O texto da issue é entrada não confiável: tudo o que vai para o cabeçalho (frontmatter)
 * ou para o nome do arquivo é validado por formato, nunca copiado direto.
 */
import { listTargets } from '../targets/registry';

/** Rótulos dos campos do formulário da issue, na ordem em que aparecem no corpo. */
export const ISSUE_FIELDS = {
  id: 'ID da história',
  target: 'Formulário-alvo',
  requirement: 'Requisito (Xray)',
  tags: 'Tags',
  narrative: 'Narrativa',
  scenarios: 'Cenários',
} as const;

type FieldName = keyof typeof ISSUE_FIELDS;

export interface IssueInput {
  number: number;
  title: string;
  body: string;
  url: string;
}

export interface IssueStory {
  id: string;
  fileName: string;
  markdown: string;
}

export class IssueStoryError extends Error {
  constructor(readonly problems: string[]) {
    super(`A issue não pôde virar história:\n- ${problems.join('\n- ')}`);
  }
}

const STORY_ID = /^[A-Z]{2,10}-\d{1,6}$/;
const ISSUE_KEY = /^[A-Z][A-Z0-9]{1,9}-\d{1,7}$/;
const ISSUE_URL = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/issues\/\d+$/;
const NO_RESPONSE = '_No response_';

/** O GitHub monta o corpo da issue como "### <rótulo>" seguido da resposta. */
export function parseIssueSections(body: string): Map<FieldName, string> {
  const labels = new Map<string, FieldName>(
    Object.entries(ISSUE_FIELDS).map(([name, label]) => [label, name as FieldName]),
  );
  const sections = new Map<FieldName, string>();
  let current: FieldName | undefined;
  let lines: string[] = [];

  const flush = () => {
    if (!current) return;
    const text = lines.join('\n').trim();
    sections.set(current, text === NO_RESPONSE ? '' : text);
  };

  for (const line of body.replace(/\r\n/g, '\n').split('\n')) {
    // Só os rótulos conhecidos abrem seção: um "###" dentro dos cenários continua sendo texto.
    const heading = /^###\s+(.+?)\s*$/.exec(line);
    const field = heading ? labels.get(heading[1]!) : undefined;
    if (field) {
      flush();
      current = field;
      lines = [];
    } else {
      lines.push(line);
    }
  }
  flush();
  return sections;
}

const slugify = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/, '');

const cleanTag = (tag: string) =>
  slugify(tag.replace(/^@/, ''))
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 30);

export function issueToStory(issue: IssueInput): IssueStory {
  const sections = parseIssueSections(issue.body);
  const problems: string[] = [];
  const get = (name: FieldName) => sections.get(name)?.trim() ?? '';

  const id = get('id').toUpperCase();
  if (!STORY_ID.test(id))
    problems.push(`"${ISSUE_FIELDS.id}" deve seguir o formato US-005 (recebido: "${get('id')}").`);

  const targetIds = listTargets().map((t) => t.id);
  const target = get('target');
  if (!targetIds.includes(target)) {
    problems.push(`"${ISSUE_FIELDS.target}" desconhecido: "${target}". Opções: ${targetIds.join(', ')}.`);
  }

  const requirement = get('requirement').toUpperCase();
  if (requirement && !ISSUE_KEY.test(requirement)) {
    problems.push(`"${ISSUE_FIELDS.requirement}" deve ser uma chave do Jira, como QA-14 (recebido: "${requirement}").`);
  }

  // Separadas por vírgula, como diz o formulário; "Cadastro Rápido" vira a tag cadastro-rapido.
  const tags = [
    ...new Set(
      get('tags')
        .split(/[,;\n]+/)
        .map(cleanTag)
        .filter(Boolean),
    ),
  ];

  // Tira o ID do começo do título. Um ID inválido nunca entra na expressão regular.
  const idPattern = STORY_ID.test(id) ? id : '[A-Z]{2,10}-\\d{1,6}';
  const title = issue.title.replace(new RegExp(`^\\s*${idPattern}\\s*[·:\\-–—]?\\s*`, 'i'), '').trim();
  if (!title) problems.push('O título da issue precisa descrever a história (ex.: "US-005 · Cadastro de estagiário").');

  const narrative = get('narrative');
  if (!narrative) problems.push(`"${ISSUE_FIELDS.narrative}" é obrigatória.`);

  const scenarios = get('scenarios');
  if (!/^##\s+cen[áa]rio\s*:/im.test(scenarios)) {
    problems.push(`"${ISSUE_FIELDS.scenarios}" precisa de ao menos um "## Cenário: <nome>".`);
  }

  if (!ISSUE_URL.test(issue.url)) problems.push(`URL da issue inesperada: "${issue.url}".`);

  if (problems.length) throw new IssueStoryError(problems);

  const frontmatter = [
    '---',
    `id: ${id}`,
    `alvo: ${target}`,
    ...(requirement ? [`requisito: ${requirement}`] : []),
    ...(tags.length ? [`tags: [${tags.join(', ')}]`] : []),
    `origem: ${issue.url}`,
    '---',
  ];

  const markdown = [
    ...frontmatter,
    '',
    `# ${id} · ${title}`,
    '',
    narrative,
    '',
    `<!-- Gerada a partir da issue #${issue.number}. -->`,
    '',
    scenarios,
    '',
  ].join('\n');

  return { id, fileName: `${id}-${slugify(title) || 'historia'}.md`, markdown };
}
