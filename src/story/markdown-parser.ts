import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { marked, type Tokens } from 'marked';
import {
  type ExpectedOutcome,
  type InterpretationMode,
  type Narrative,
  type Scenario,
  type Story,
  StoryError,
} from './model';

const SCENARIO_HEADING = /^cen[áa]rio\s*:\s*(.+)$/i;
const NARRATIVE_LINE = /^\*\*(como|quero|para)\*\*\s+(.+)$/i;
const KEY_VALUE_LINE = /^\*\*([^*]+?):\*\*\s*(.*)$/;

const SUBMITTED = ['enviado', 'enviado com sucesso', 'sucesso', 'aceito'];
const BLOCKED = ['bloqueado', 'nao enviado', 'não enviado', 'erro', 'rejeitado'];

export function hashSource(content: string): string {
  return crypto.createHash('sha256').update(content.replace(/\r\n/g, '\n')).digest('hex').slice(0, 12);
}

function parseOutcome(raw: string, file: string, scenario: string): ExpectedOutcome {
  const value = raw.trim().toLowerCase().replace(/\.$/, '');
  if (SUBMITTED.includes(value)) return 'submitted';
  if (BLOCKED.includes(value)) return 'blocked';
  throw new StoryError(
    file,
    `cenário "${scenario}": resultado esperado "${raw}" não reconhecido. Use "enviado" ou "bloqueado".`,
  );
}

const splitList = (raw: string) =>
  raw
    .split(/\s*[,;]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);

const cleanTag = (tag: string) => tag.trim().replace(/^@/, '').replace(/\s+/g, '-');

interface ScenarioDraft extends Omit<Scenario, 'expect'> {
  expect?: ExpectedOutcome;
  descriptionLines: string[];
}

export function parseStory(content: string, sourcePath: string): Story {
  const file = path.basename(sourcePath);
  const { data, content: raw } = matter(content);
  // Comentários HTML são notas para quem lê o arquivo: não entram nos cenários nem no prompt.
  const body = raw.replace(/<!--[\s\S]*?-->/g, '');

  const id = String(data.id ?? '').trim();
  if (!id) throw new StoryError(file, 'frontmatter sem "id" (ex.: id: US-001).');
  const target = String(data.alvo ?? data.target ?? '').trim();
  if (!target) throw new StoryError(file, 'frontmatter sem "alvo" (ex.: alvo: demoqa-practice-form).');

  const tokens = marked.lexer(body);
  const narrative: Narrative = {};
  const scenarios: ScenarioDraft[] = [];
  let title = '';
  let current: ScenarioDraft | undefined;

  for (const token of tokens) {
    if (token.type === 'heading') {
      const heading = token as Tokens.Heading;
      if (heading.depth === 1 && !title) {
        title = heading.text.replace(new RegExp(`^${id}\\s*[·:\\-–—]\\s*`), '').trim();
        continue;
      }
      const match = SCENARIO_HEADING.exec(heading.text.trim());
      if (match) {
        current = { name: match[1]!.trim(), tags: [], fields: [], invalidFields: [], descriptionLines: [] };
        scenarios.push(current);
      } else if (heading.depth <= 2) {
        // Outra seção (ex.: "Critérios de aceite"): encerra o cenário atual.
        current = undefined;
      }
      continue;
    }

    if (token.type === 'table' && current) {
      const table = token as Tokens.Table;
      const header = table.header.map((h) => h.text.trim().toLowerCase());
      const fieldCol = header.indexOf('campo');
      const valueCol = header.indexOf('valor');
      if (fieldCol === -1 || valueCol === -1) {
        throw new StoryError(file, `cenário "${current.name}": a tabela precisa das colunas "Campo" e "Valor".`);
      }
      for (const row of table.rows) {
        current.fields.push({ field: row[fieldCol]!.text.trim(), value: (row[valueCol]?.text ?? '').trim() });
      }
      continue;
    }

    if (token.type === 'paragraph') {
      for (const line of (token as Tokens.Paragraph).text.split('\n').map((l) => l.trim())) {
        const narrativeMatch = NARRATIVE_LINE.exec(line);
        if (narrativeMatch && !current) {
          const [, key, value] = narrativeMatch;
          const k = key!.toLowerCase();
          if (k === 'como') narrative.asA = value!.trim();
          if (k === 'quero') narrative.iWant = value!.trim();
          if (k === 'para') narrative.soThat = value!.trim();
          continue;
        }
        const kv = current ? KEY_VALUE_LINE.exec(line) : null;
        if (current && kv) {
          const key = kv[1]!.trim().toLowerCase();
          const value = kv[2]!.trim();
          if (key === 'resultado esperado') current.expect = parseOutcome(value, file, current.name);
          else if (key === 'campos inválidos' || key === 'campos invalidos' || key === 'campo inválido')
            current.invalidFields = splitList(value);
          else if (key === 'tags') current.tags.push(...value.split(/\s+/).filter(Boolean).map(cleanTag));
          else if (key === 'xray') current.xrayTestKey = value;
          else current.descriptionLines.push(line.replace(/\*\*/g, ''));
          continue;
        }
        if (current && line) current.descriptionLines.push(line);
      }
    }
  }

  const structured = scenarios.filter((s) => s.fields.length > 0);
  const forced = String(data.interpretacao ?? '').toLowerCase();
  const interpretation: InterpretationMode =
    forced === 'llm' || (forced !== 'deterministica' && structured.length === 0) ? 'llm' : 'deterministic';

  const finalScenarios: Scenario[] =
    interpretation === 'llm'
      ? []
      : scenarios.map(({ descriptionLines, ...s }) => {
          if (!s.fields.length) throw new StoryError(file, `cenário "${s.name}" não tem a tabela "Campo | Valor".`);
          if (!s.expect) {
            throw new StoryError(file, `cenário "${s.name}" sem "**Resultado esperado:** enviado|bloqueado".`);
          }
          if (s.expect === 'blocked' && !s.invalidFields.length) {
            throw new StoryError(file, `cenário "${s.name}" é bloqueado mas não lista "**Campos inválidos:**".`);
          }
          return { ...s, expect: s.expect, description: descriptionLines.join('\n') || undefined };
        });

  const tags = (Array.isArray(data.tags) ? data.tags : data.tags ? [data.tags] : []).map((t: unknown) =>
    cleanTag(String(t)),
  );

  return {
    id,
    title: title || id,
    target,
    sourcePath: path.relative(process.cwd(), sourcePath).replace(/\\/g, '/'),
    sourceHash: hashSource(content),
    narrative,
    tags,
    requirementKey: data.requisito ? String(data.requisito).trim() : undefined,
    interpretation,
    scenarios: finalScenarios,
    body: body.trim(),
  };
}

export function parseStoryFile(filePath: string): Story {
  return parseStory(fs.readFileSync(filePath, 'utf8'), filePath);
}
