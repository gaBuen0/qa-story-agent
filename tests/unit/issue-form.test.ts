import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'node:test';
import { IssueStoryError, issueToStory, parseIssueSections } from '../../src/story/issue-form';
import { parseStory } from '../../src/story/markdown-parser';
import { validateScenario } from '../../src/story/validate';
import { getTarget, listTargets } from '../../src/targets/registry';

const URL = 'https://github.com/gaBuen0/qa-story-agent/issues/7';

/** Corpo como o GitHub monta a partir do formulário .github/ISSUE_TEMPLATE/historia.yml. */
function issueBody(overrides: Partial<Record<string, string>> = {}): string {
  const fields: Record<string, string> = {
    'ID da história': 'US-005',
    'Formulário-alvo': 'demoqa-web-tables',
    'Requisito (Xray)': 'QA-14',
    Tags: 'estagio, Cadastro Rápido',
    Narrativa: '**Como** RH da escola\n**Quero** cadastrar estagiários\n**Para** controlar a bolsa',
    Cenários: [
      '## Cenário: Estagiário com todos os dados',
      '',
      '| Campo | Valor |',
      '| ----- | ----- |',
      '| Nome | Davi |',
      '| Sobrenome | Nunes |',
      '| E-mail | davi.nunes@example.com |',
      '| Idade | 19 |',
      '| Salário | 1500 |',
      '| Departamento | Biblioteca |',
      '',
      '**Resultado esperado:** enviado',
      '',
      '### Observação que não é um campo do formulário',
    ].join('\n'),
    ...overrides,
  };
  return Object.entries(fields)
    .map(([label, value]) => `### ${label}\r\n\r\n${value}`)
    .join('\r\n\r\n');
}

const issue = (body = issueBody(), title = 'US-005 · Cadastro de estagiário') => ({ number: 7, title, body, url: URL });

describe('issue do GitHub → história', () => {
  it('lê as seções do formulário, inclusive "_No response_" e "###" que não é campo', () => {
    const sections = parseIssueSections(issueBody({ 'Requisito (Xray)': '_No response_' }));
    assert.equal(sections.get('id'), 'US-005');
    assert.equal(sections.get('requirement'), '');
    assert.match(sections.get('scenarios') ?? '', /### Observação que não é um campo/);
  });

  it('gera uma história que o parser aceita e que passa na validação do formulário', () => {
    const story = issueToStory(issue());
    assert.equal(story.id, 'US-005');
    assert.equal(story.fileName, 'US-005-cadastro-de-estagiario.md');
    assert.match(story.markdown, /^origem: https:\/\/github\.com\/gaBuen0\/qa-story-agent\/issues\/7$/m);
    assert.match(story.markdown, /^tags: \[estagio, cadastro-rapido\]$/m);

    const parsed = parseStory(story.markdown, `stories/${story.fileName}`);
    assert.equal(parsed.title, 'Cadastro de estagiário');
    assert.equal(parsed.requirementKey, 'QA-14');
    assert.equal(parsed.narrative.asA, 'RH da escola');
    assert.equal(parsed.scenarios.length, 1);
    assert.deepEqual(validateScenario(getTarget('demoqa-web-tables'), parsed.scenarios[0]!), []);
  });

  it('junta todos os problemas numa mensagem só, para comentar na issue', () => {
    const body = issueBody({
      'ID da história': 'história 5',
      'Formulário-alvo': 'formulario-inexistente',
      Narrativa: '_No response_',
      Cenários: 'só texto, sem cenário',
    });
    assert.throws(
      () => issueToStory(issue(body, 'US-005 · ')),
      (err: unknown) => err instanceof IssueStoryError && err.problems.length === 5,
    );
  });

  it('não deixa a issue escrever fora do frontmatter nem do diretório de histórias', () => {
    const attempts = ['../../etc/passwd', 'US-005\nalvo: outro', 'US-005: x', 'US-005/../../x'];
    for (const id of attempts) {
      assert.throws(() => issueToStory(issue(issueBody({ 'ID da história': id }))), IssueStoryError, id);
    }
    const story = issueToStory(issue(issueBody({ Tags: 'ok, "]\nalvo: x', 'Requisito (Xray)': '' })));
    assert.doesNotMatch(story.markdown, /^alvo: x$/m);
    assert.doesNotMatch(story.markdown, /^requisito:/m);
    assert.match(story.fileName, /^US-005-[a-z0-9-]+\.md$/);
  });

  it('as opções do formulário da issue são os formulários registrados no código', () => {
    const template = fs.readFileSync('.github/ISSUE_TEMPLATE/historia.yml', 'utf8');
    const block = /id: alvo[\s\S]*?options:\n((?:\s+- .+\n)+)/.exec(template)?.[1] ?? '';
    const options = block
      .split('\n')
      .map((l) => l.replace(/^\s*-\s*/, '').trim())
      .filter(Boolean);
    assert.deepEqual(
      options.sort(),
      listTargets()
        .map((t) => t.id)
        .sort(),
    );
  });
});
