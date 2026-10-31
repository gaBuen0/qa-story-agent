import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { FILES_DIR } from '../targets/normalize';
import type { FieldSpec, FormTarget } from '../targets/types';
import type { Scenario, Story } from './model';
import { validateScenario } from './validate';

export const DEFAULT_MODEL = process.env.CLAUDE_MODEL ?? 'claude-opus-5-5';
type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';
const DEFAULT_EFFORT = (process.env.CLAUDE_EFFORT as Effort | undefined) ?? 'low';

/**
 * Há alguma credencial que o SDK consiga usar? (chave, token, workload identity ou perfil do `ant auth login`)
 * Evita tentar chamar o modelo, e falhar, em máquinas e pipelines sem IA configurada.
 */
export function hasAnthropicCredentials(): boolean {
  const env = process.env;
  if (env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN || env.ANTHROPIC_PROFILE || env.ANTHROPIC_FEDERATION_RULE_ID) {
    return true;
  }
  const configHome = env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return fs.existsSync(path.join(configHome, 'anthropic'));
}

/** Só o pedaço do SDK que usamos: facilita injetar um cliente falso nos testes. */
export type LlmClient = Pick<Anthropic, 'beta'>;

export interface LlmOptions {
  client?: LlmClient;
  model?: string;
  effort?: Effort;
  maxAttempts?: number;
  log?: (message: string) => void;
}

export interface LlmResult {
  scenarios: Scenario[];
  model: string;
  attempts: number;
}

function buildSchema(target: FormTarget) {
  const keys = target.fields.map((f) => f.key) as [string, ...string[]];
  return z.object({
    scenarios: z.array(
      z.object({
        name: z.string().describe('Nome curto do cenário, em português'),
        rationale: z.string().describe('Qual trecho da história este cenário cobre'),
        tags: z.array(z.string()).describe('Tags curtas sem @, ex.: smoke, negativo'),
        fields: z.array(z.object({ field: z.enum(keys), value: z.string() })),
        expect: z.enum(['submitted', 'blocked']),
        invalidFields: z.array(z.enum(keys)).describe('Campos que devem ficar inválidos; vazio se expect=submitted'),
      }),
    ),
  });
}

function describeField(f: FieldSpec): string {
  const parts = [`- ${f.key}: "${f.label}" (${f.kind}${f.required ? ', obrigatório' : ''})`];
  if (f.options) parts.push(`opções: ${f.options.map((o) => o.value).join(' | ')}`);
  if (f.hint) parts.push(`formato: ${f.hint}`);
  if (f.dependsOn) parts.push(`depende de: ${f.dependsOn}`);
  return parts.join('; ');
}

const SYSTEM_PROMPT = `Você é um analista de QA. Sua tarefa é transformar uma história de usuário escrita em texto livre em cenários de teste executáveis para um formulário web específico.

Regras:
- Crie um cenário para cada comportamento ou critério de aceite descrito na história. Não invente comportamentos que a história não pede.
- Use somente os campos do formulário informados, referenciando-os pela chave (key).
- Para campos com opções, use exatamente um dos valores listados. Campos com várias escolhas recebem os valores separados por vírgula.
- Datas vão no formato dd/mm/aaaa.
- Cenários com expect="submitted" precisam preencher todos os campos obrigatórios com dados válidos.
- Cenários com expect="blocked" devem listar em invalidFields exatamente os campos que a validação da tela deve marcar como inválidos.
- Quando a história não fornece um dado necessário, use dados fictícios plausíveis (e-mails no domínio example.com). Nunca use dados de pessoas reais.`;

function buildPrompt(story: Story, target: FormTarget): string {
  const files = fs.existsSync(FILES_DIR) ? fs.readdirSync(FILES_DIR) : [];
  return [
    `<formulario id="${target.id}" nome="${target.name}">`,
    ...target.fields.map(describeField),
    files.length ? `Arquivos disponíveis para upload: ${files.join(', ')}` : 'Nenhum arquivo disponível para upload.',
    '</formulario>',
    '',
    `<historia id="${story.id}" titulo="${story.title}">`,
    story.body,
    '</historia>',
  ].join('\n');
}

/**
 * Interpreta uma história em texto livre com o Claude e devolve cenários estruturados.
 * A saída passa pela mesma validação dos cenários escritos à mão; se houver erro,
 * os problemas são devolvidos ao modelo para correção (até `maxAttempts`).
 */
export async function interpretWithLLM(story: Story, target: FormTarget, options: LlmOptions = {}): Promise<LlmResult> {
  const client = options.client ?? new Anthropic();
  const model = options.model ?? DEFAULT_MODEL;
  const maxAttempts = options.maxAttempts ?? 3;
  const log = options.log ?? (() => {});
  const schema = buildSchema(target);
  const labelOf = (key: string) => target.fields.find((f) => f.key === key)?.label ?? key;

  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: buildPrompt(story, target) }];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await client.beta.messages.parse({
      model,
      max_tokens: 16000,
      // Se o modelo principal recusar, a API tenta automaticamente um modelo alternativo.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: options.effort ?? DEFAULT_EFFORT, format: betaZodOutputFormat(schema) },
      system: SYSTEM_PROMPT,
      messages,
    });

    if (response.stop_reason === 'refusal') {
      throw new Error(
        `O modelo recusou interpretar ${story.id}: ${response.stop_details?.explanation ?? 'sem detalhes'}`,
      );
    }
    if (response.stop_reason === 'max_tokens') {
      throw new Error(`Resposta truncada ao interpretar ${story.id} (max_tokens).`);
    }
    const output = response.parsed_output;
    if (!output) throw new Error(`O modelo não devolveu cenários válidos para ${story.id}.`);

    const scenarios: Scenario[] = output.scenarios.map((s) => ({
      name: s.name,
      description: s.rationale,
      tags: [...new Set(['gerado-por-ia', ...s.tags.map((t) => t.replace(/^@/, '').replace(/\s+/g, '-'))])],
      fields: s.fields.map((f) => ({ field: labelOf(f.field), value: f.value })),
      expect: s.expect,
      invalidFields: s.invalidFields.map(labelOf),
    }));

    const errors = scenarios.length
      ? scenarios.flatMap((s) => validateScenario(target, s))
      : ['nenhum cenário foi gerado.'];
    if (!errors.length) return { scenarios, model: response.model, attempts: attempt };

    log(`tentativa ${attempt}: ${errors.length} problema(s) na saída do modelo`);
    if (attempt === maxAttempts) {
      throw new Error(
        `Cenários gerados para ${story.id} continuam inválidos após ${maxAttempts} tentativas:\n- ${errors.join('\n- ')}`,
      );
    }
    // Conversa só cresce (append-only): devolvemos a resposta e pedimos a correção.
    messages.push({ role: 'assistant', content: response.content });
    messages.push({
      role: 'user',
      content: `Os cenários têm problemas de validação. Corrija e devolva a lista completa:\n- ${errors.join('\n- ')}`,
    });
  }
  throw new Error('inalcançável');
}
