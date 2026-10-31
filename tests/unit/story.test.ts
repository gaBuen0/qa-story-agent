import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';
import { readSourceHash, writeFeature } from '../../src/story/gherkin-writer';
import { parseStory, parseStoryFile } from '../../src/story/markdown-parser';
import { validateScenario } from '../../src/story/validate';
import { getTarget } from '../../src/targets/registry';

const target = getTarget('demoqa-practice-form');

const story = (body: string) => `---\nid: US-100\nalvo: demoqa-practice-form\n---\n# US-100 · Teste\n\n${body}`;

describe('parser de histórias', () => {
  it('lê a história de exemplo US-001 com narrativa, tags e chave do Xray', () => {
    const s = parseStoryFile(path.resolve('stories/US-001-cadastro-de-estudante.md'));
    assert.equal(s.id, 'US-001');
    assert.equal(s.title, 'Cadastro de estudante');
    assert.equal(s.target, 'demoqa-practice-form');
    assert.equal(s.requirementKey, 'QA-10');
    assert.equal(s.interpretation, 'deterministic');
    assert.equal(s.narrative.asA, 'secretaria acadêmica');
    assert.equal(s.scenarios.length, 2);
    assert.equal(s.scenarios[0]!.xrayTestKey, 'QA-101');
    assert.deepEqual(s.scenarios[0]!.tags, ['smoke']);
    assert.equal(s.scenarios[0]!.fields.length, 12);
    assert.equal(s.scenarios[0]!.expect, 'submitted');
  });

  it('marca histórias sem tabela como texto livre (modo LLM) e ignora comentários HTML', () => {
    const s = parseStoryFile(path.resolve('stories/US-003-aluna-transferida.md'));
    assert.equal(s.interpretation, 'llm');
    assert.equal(s.scenarios.length, 0);
    assert.match(s.body, /Beatriz Ramos/);
    assert.doesNotMatch(s.body, /Comentários HTML/);
  });

  it('lê campos inválidos de um cenário bloqueado', () => {
    const s = parseStory(
      story(
        '## Cenário: X\n\n| Campo | Valor |\n|---|---|\n| Nome | A |\n\n**Resultado esperado:** bloqueado\n**Campos inválidos:** Celular, Gênero\n',
      ),
      'US-100.md',
    );
    assert.equal(s.scenarios[0]!.expect, 'blocked');
    assert.deepEqual(s.scenarios[0]!.invalidFields, ['Celular', 'Gênero']);
  });

  it('recusa resultado esperado desconhecido', () => {
    assert.throws(
      () =>
        parseStory(
          story('## Cenário: X\n\n| Campo | Valor |\n|---|---|\n| Nome | A |\n\n**Resultado esperado:** talvez\n'),
          'x.md',
        ),
      /não reconhecido/,
    );
  });

  it('exige campos inválidos quando o cenário é bloqueado', () => {
    assert.throws(
      () =>
        parseStory(
          story('## Cenário: X\n\n| Campo | Valor |\n|---|---|\n| Nome | A |\n\n**Resultado esperado:** bloqueado\n'),
          'x.md',
        ),
      /Campos inválidos/,
    );
  });

  it('exige id e alvo no frontmatter', () => {
    assert.throws(() => parseStory('# Sem frontmatter', 'x.md'), /id/);
  });
});

describe('validação do cenário contra o formulário', () => {
  it('aponta campos obrigatórios ausentes em cenário de sucesso', () => {
    const errors = validateScenario(target, {
      name: 'Incompleto',
      tags: [],
      fields: [{ field: 'Nome', value: 'Ana' }],
      expect: 'submitted',
      invalidFields: [],
    });
    assert.equal(errors.length, 1);
    assert.match(errors[0]!, /Sobrenome, Gênero, Celular/);
  });

  it('aponta campo inválido esperado que não existe', () => {
    const errors = validateScenario(target, {
      name: 'X',
      tags: [],
      fields: [{ field: 'Nome', value: 'Ana' }],
      expect: 'blocked',
      invalidFields: ['CPF'],
    });
    assert.match(errors.join(), /"CPF" não existe/);
  });
});

describe('gerador de Gherkin', () => {
  it('gera feature em português com tags do Xray, tabela escapada e hash da origem', () => {
    const s = parseStoryFile(path.resolve('stories/US-001-cadastro-de-estudante.md'));
    const scenario = { ...s.scenarios[0]!, fields: [{ field: 'Endereço', value: 'Rua A | fundos' }] };
    const feature = writeFeature(s, [scenario], { interpreter: 'teste' });

    assert.match(feature, /^# language: pt\n/);
    assert.match(feature, /@US-001 @cadastro @REQ_QA-10\nFuncionalidade: US-001 · Cadastro de estudante/);
    assert.match(feature, /@smoke @TEST_QA-101\n {2}Cenário:/);
    assert.match(feature, /Rua A \\\| fundos/);
    assert.equal(readSourceHash(feature), s.sourceHash);
  });

  it('não deixa uma descrição começando com "E" virar passo', () => {
    const s = parseStoryFile(path.resolve('stories/US-001-cadastro-de-estudante.md'));
    const feature = writeFeature(s, [{ ...s.scenarios[0]!, description: 'E isso é só uma descrição' }], {
      interpreter: 'teste',
    });
    assert.match(feature, /— E isso é só uma descrição/);
  });
});
