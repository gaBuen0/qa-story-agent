/**
 * Lê stories/*.md e gera features/generated/<id>.feature.
 *
 *   npm run stories:compile             gera/atualiza os .feature
 *   npm run stories:compile -- --no-llm  não chama o LLM (histórias em texto livre são puladas)
 *   npm run stories:check               não grava nada; falha se algum .feature estiver desatualizado (CI)
 */
import './env';
import fs from 'node:fs';
import path from 'node:path';
import { parseStoryFile } from '../story/markdown-parser';
import { readSourceHash, writeFeature } from '../story/gherkin-writer';
import { hasAnthropicCredentials, interpretWithLLM } from '../story/llm-interpreter';
import type { Story } from '../story/model';
import { validateScenario } from '../story/validate';
import { getTarget } from '../targets/registry';

const STORIES_DIR = path.resolve('stories');
const OUTPUT_DIR = path.resolve('features/generated');

const args = new Set(process.argv.slice(2));
const checkOnly = args.has('--check');
const llmEnabled = !args.has('--no-llm') && process.env.STORY_LLM !== 'off' && hasAnthropicCredentials();

const c = {
  ok: (s: string) => `\x1b[32m${s}\x1b[0m`,
  warn: (s: string) => `\x1b[33m${s}\x1b[0m`,
  err: (s: string) => `\x1b[31m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
};

type Outcome = 'gerado' | 'atualizado' | 'sem mudanças' | 'reaproveitado' | 'pulado' | 'desatualizado' | 'erro';

async function compile(story: Story): Promise<{ outcome: Outcome; detail: string; outputFile: string }> {
  const target = getTarget(story.target);
  const outputFile = path.join(OUTPUT_DIR, `${story.id}.feature`);
  const existing = fs.existsSync(outputFile) ? fs.readFileSync(outputFile, 'utf8').replace(/\r\n/g, '\n') : undefined;

  let feature: string;
  let detail: string;

  if (story.interpretation === 'deterministic') {
    const errors = story.scenarios.flatMap((s) => validateScenario(target, s));
    if (errors.length) return { outcome: 'erro', detail: errors.join('\n    '), outputFile };
    feature = writeFeature(story, story.scenarios, { interpreter: 'determinística (parser de Markdown)' });
    detail = `${story.scenarios.length} cenário(s), parser determinístico`;
  } else {
    // Texto livre: a interpretação do LLM fica versionada no .feature.
    // Se a história não mudou, reaproveitamos o arquivo já revisado em vez de chamar o modelo de novo.
    if (existing && readSourceHash(existing) === story.sourceHash) {
      return { outcome: 'reaproveitado', detail: 'interpretação do LLM já revisada e versionada', outputFile };
    }
    if (checkOnly || !llmEnabled) {
      if (existing) {
        return {
          outcome: 'desatualizado',
          detail: 'história em texto livre mudou; rode "npm run stories:compile" com o LLM habilitado',
          outputFile,
        };
      }
      return { outcome: 'pulado', detail: 'texto livre exige o LLM (configure ANTHROPIC_API_KEY)', outputFile };
    }
    const result = await interpretWithLLM(story, target, { log: (m) => console.log(c.dim(`    ${m}`)) });
    feature = writeFeature(story, result.scenarios, { interpreter: `llm (${result.model}) — revise antes de versionar` });
    detail = `${result.scenarios.length} cenário(s) via ${result.model}, ${result.attempts} tentativa(s)`;
  }

  if (existing === feature) return { outcome: 'sem mudanças', detail, outputFile };
  if (checkOnly) return { outcome: 'desatualizado', detail: 'rode "npm run stories:compile"', outputFile };
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(outputFile, feature);
  return { outcome: existing ? 'atualizado' : 'gerado', detail, outputFile };
}

async function main() {
  const files = fs
    .readdirSync(STORIES_DIR)
    .filter((f) => f.endsWith('.md'))
    .sort();
  console.log(`\nCompilando ${files.length} história(s) de ${path.relative(process.cwd(), STORIES_DIR)}/${checkOnly ? ' (modo --check)' : ''}\n`);

  let failures = 0;
  const produced = new Set<string>();

  for (const file of files) {
    try {
      const story = parseStoryFile(path.join(STORIES_DIR, file));
      const { outcome, detail, outputFile } = await compile(story);
      produced.add(path.basename(outputFile));
      const rel = path.relative(process.cwd(), outputFile).replace(/\\/g, '/');
      const color = outcome === 'erro' ? c.err : outcome === 'pulado' || outcome === 'desatualizado' ? c.warn : c.ok;
      const where = outcome === 'pulado' ? '(não gerado)' : rel;
      console.log(`  ${color(outcome.padEnd(13))} ${story.id.padEnd(8)} → ${where}  ${c.dim(detail.split('\n')[0]!)}`);
      if (outcome === 'erro') console.log(c.err(`    ${detail}`));
      if (outcome === 'erro' || (outcome === 'desatualizado' && checkOnly)) failures++;
    } catch (err) {
      failures++;
      console.log(`  ${c.err('erro'.padEnd(13))} ${file}\n    ${c.err((err as Error).message)}`);
    }
  }

  // Remove .feature cuja história foi apagada.
  if (fs.existsSync(OUTPUT_DIR)) {
    for (const orphan of fs.readdirSync(OUTPUT_DIR).filter((f) => f.endsWith('.feature') && !produced.has(f))) {
      if (checkOnly) {
        failures++;
        console.log(`  ${c.err('órfão'.padEnd(13))} features/generated/${orphan} não tem história correspondente`);
      } else {
        fs.rmSync(path.join(OUTPUT_DIR, orphan));
        console.log(`  ${c.warn('removido'.padEnd(13))} features/generated/${orphan}`);
      }
    }
  }

  console.log('');
  if (failures) {
    console.error(c.err(`${failures} problema(s) encontrado(s).`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
