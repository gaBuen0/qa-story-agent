import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';
import type { RunResult } from '../../src/reporting/types';
import { toXrayExecution } from '../../src/reporting/xray';
import { interpretWithLLM, type LlmClient } from '../../src/story/llm-interpreter';
import { parseStoryFile } from '../../src/story/markdown-parser';
import { getTarget } from '../../src/targets/registry';

const target = getTarget('demoqa-practice-form');

/** Cliente falso: devolve respostas prontas e guarda o que foi enviado em cada chamada. */
function fakeClient(outputs: unknown[]) {
  const calls: { messages: unknown[]; model: string }[] = [];
  const client = {
    beta: {
      messages: {
        parse: async (params: { messages: unknown[]; model: string }) => {
          calls.push({ messages: structuredClone(params.messages), model: params.model });
          const output = outputs.shift();
          return {
            model: params.model,
            stop_reason: 'end_turn',
            parsed_output: output,
            content: [{ type: 'text', text: JSON.stringify(output) }],
          };
        },
      },
    },
  } as unknown as LlmClient;
  return { client, calls };
}

const validSuccess = {
  name: 'Matrícula completa',
  rationale: 'primeiro parágrafo',
  tags: ['smoke'],
  fields: [
    { field: 'firstName', value: 'Beatriz' },
    { field: 'lastName', value: 'Ramos' },
    { field: 'gender', value: 'Female' },
    { field: 'mobile', value: '3199887766' },
  ],
  expect: 'submitted',
  invalidFields: [],
};

describe('intérprete com LLM', () => {
  const story = parseStoryFile(path.resolve('stories/US-003-aluna-transferida.md'));

  it('converte a saída do modelo em cenários com rótulos em português', async () => {
    const { client, calls } = fakeClient([{ scenarios: [validSuccess] }]);
    const result = await interpretWithLLM(story, target, { client, model: 'modelo-teste' });

    assert.equal(result.attempts, 1);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.model, 'modelo-teste');
    const [scenario] = result.scenarios;
    assert.deepEqual(scenario!.fields[0], { field: 'Nome', value: 'Beatriz' });
    assert.ok(scenario!.tags.includes('gerado-por-ia'));
    assert.equal(scenario!.description, 'primeiro parágrafo');
  });

  it('devolve os erros de validação ao modelo e aceita a correção', async () => {
    const wrong = { ...validSuccess, fields: [...validSuccess.fields.slice(0, 2), { field: 'gender', value: 'Roxo' }] };
    const { client, calls } = fakeClient([{ scenarios: [wrong] }, { scenarios: [validSuccess] }]);
    const result = await interpretWithLLM(story, target, { client });

    assert.equal(result.attempts, 2);
    // 2ª chamada = conversa original + resposta do modelo + pedido de correção (append-only).
    const second = calls[1]!.messages as { role: string; content: unknown }[];
    assert.equal(second.length, 3);
    assert.equal(second[1]!.role, 'assistant');
    assert.match(String(second[2]!.content), /valor "Roxo" inválido para "Gênero"/);
    assert.match(String(second[2]!.content), /faltam campos obrigatórios: Celular/);
  });

  it('desiste depois do limite de tentativas', async () => {
    const { client } = fakeClient([{ scenarios: [] }, { scenarios: [] }]);
    await assert.rejects(interpretWithLLM(story, target, { client, maxAttempts: 2 }), /após 2 tentativas/);
  });
});

describe('exportação para o Xray', () => {
  const run: RunResult = {
    startedAt: '2026-10-30T10:00:00.000Z',
    finishedAt: '2026-10-30T10:01:00.000Z',
    durationMs: 60_000,
    status: 'failed',
    scenarios: [
      {
        id: '1',
        storyId: 'US-001',
        feature: 'US-001 · Cadastro',
        scenario: 'Completo',
        tags: ['@US-001', '@smoke', '@TEST_QA-101', '@REQ_QA-10'],
        xrayTestKey: 'QA-101',
        requirementKey: 'QA-10',
        status: 'passed',
        flaky: false,
        retries: 0,
        startTime: '2026-10-30T10:00:00.000Z',
        durationMs: 5000,
        steps: [],
      },
      {
        id: '2',
        storyId: 'US-002',
        feature: 'US-002 · Validações',
        scenario: 'Celular curto',
        tags: ['@US-002', '@negativo', '@REQ_QA-11'],
        requirementKey: 'QA-11',
        status: 'failed',
        flaky: false,
        retries: 0,
        startTime: '2026-10-30T10:00:10.000Z',
        durationMs: 3000,
        steps: [],
        error: 'O formulário foi enviado...\nstack',
        log: {
          target: 'demoqa-practice-form',
          actions: [],
          checks: [{ phase: 'validação', field: 'Celular', expected: 'inválido', actual: 'válido', passed: false }],
        },
      },
    ],
  };

  it('vincula testes existentes pela chave e cria os demais como Generic', () => {
    const xray = toXrayExecution(run, { projectKey: 'QA', testPlanKey: 'QA-1', reportsDir: 'reports' });
    assert.equal(xray.info.summary, 'QA Story Agent — 1/2 cenários aprovados');
    assert.equal(xray.info.testPlanKey, 'QA-1');

    const [linked, created] = xray.tests;
    assert.equal(linked!.testKey, 'QA-101');
    assert.equal(linked!.status, 'PASSED');
    assert.equal(linked!.testInfo, undefined);

    assert.equal(created!.status, 'FAILED');
    assert.equal(created!.finish, '2026-10-30T10:00:13.000Z');
    assert.deepEqual(created!.testInfo?.requirementKeys, ['QA-11']);
    assert.deepEqual(created!.testInfo?.labels, ['US-002', 'negativo']);
    assert.match(created!.comment, /\[validação\] Celular: esperado "inválido", obtido "válido"/);
  });
});
