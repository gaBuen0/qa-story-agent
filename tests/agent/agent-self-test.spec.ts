/**
 * Quem testa o testador?
 *
 * Um agente de QA que nunca falha não prova nada. Estes testes rodam o agente contra um
 * formulário local com defeitos plantados e exigem que ele acuse cada um, com a mensagem certa.
 * Também rodam o formulário sem defeito, para garantir que o agente não acusa bug onde não há.
 */
import { expect, test } from '@playwright/test';
import { FormAgent } from '../../src/agent/form-agent';
import type { FieldEntry } from '../../src/story/model';
import { type LabDefect, type LabFormat, labTarget } from './lab-target';

const aluna: FieldEntry[] = [
  { field: 'Nome', value: 'Beatriz' },
  { field: 'Sobrenome', value: 'Ramos' },
  { field: 'E-mail', value: 'beatriz.ramos@example.com' },
  { field: 'Gênero', value: 'Feminino' },
  { field: 'Celular', value: '3199887766' },
  { field: 'Hobbies', value: 'Esportes, Leitura' },
  { field: 'Endereço', value: 'Rua das Palmeiras, 45' },
];

const celularCurto: FieldEntry[] = [
  { field: 'Nome', value: 'Rafael' },
  { field: 'Sobrenome', value: 'Teixeira' },
  { field: 'Gênero', value: 'Masculino' },
  { field: 'Celular', value: '319876' },
];

type Page = import('@playwright/test').Page;

async function openLab(page: Page, format: LabFormat, defects: LabDefect[]) {
  const agent = new FormAgent(page, test.info());
  await agent.open(labTarget(defects, format));
  return agent;
}

/** Confirmação em forma de resumo (como o cadastro de estudante). */
const agentOn = (page: Page, ...defects: LabDefect[]) => openLab(page, 'resumo', defects);
/** Confirmação como linha nova numa tabela que já tem outro registro (como o Web Tables). */
const agentOnTable = (page: Page, ...defects: LabDefect[]) => openLab(page, 'tabela', defects);

test.describe('sem defeito: o agente não acusa bug onde não há', () => {
  test('envio com sucesso e resumo conferido campo a campo', async ({ page }) => {
    const agent = await agentOn(page);
    await agent.fill(aluna);
    await agent.submit();
    await agent.expectSubmitted();
    await agent.validateSummary();
  });

  test('dado inválido é barrado e o campo certo fica inválido', async ({ page }) => {
    const agent = await agentOn(page);
    await agent.fill(celularCurto);
    await agent.submit();
    await agent.expectBlocked();
    await agent.expectInvalid(['Celular']);
  });
});

test.describe('com defeito plantado: o agente precisa acusar', () => {
  test('resumo com sobrenome trocado', async ({ page }) => {
    const agent = await agentOn(page, 'resumo-sobrenome-trocado');
    await agent.fill(aluna);
    await agent.submit();
    await agent.expectSubmitted();
    await expect(agent.validateSummary()).rejects.toThrow(
      'Nome completo: esperado "Beatriz Ramos", obtido "Beatriz Silva"',
    );
  });

  test('resumo sem um dos itens de uma lista', async ({ page }) => {
    const agent = await agentOn(page, 'resumo-sem-hobby');
    await agent.fill(aluna);
    await agent.submit();
    await agent.expectSubmitted();
    await expect(agent.validateSummary()).rejects.toThrow('Hobbies: esperado "Esportes, Leitura", obtido "Esportes"');
  });

  test('resumo sem uma linha inteira', async ({ page }) => {
    const agent = await agentOn(page, 'resumo-sem-endereco');
    await agent.fill(aluna);
    await agent.submit();
    await agent.expectSubmitted();
    await expect(agent.validateSummary()).rejects.toThrow(
      'Endereço: esperado "Rua das Palmeiras, 45", obtido "(linha ausente)"',
    );
  });

  test('várias divergências são reportadas juntas, não só a primeira', async ({ page }) => {
    const agent = await agentOn(page, 'resumo-sobrenome-trocado', 'resumo-sem-hobby');
    await agent.fill(aluna);
    await agent.submit();
    await agent.expectSubmitted();
    const error = await agent.validateSummary().catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('2 de 6 verificações falharam (resumo)');
    expect((error as Error).message).toContain('Nome completo');
    expect((error as Error).message).toContain('Hobbies');
  });

  test('campo que não guarda o valor digitado', async ({ page }) => {
    const agent = await agentOn(page, 'celular-corta-digito');
    await expect(agent.fill(aluna)).rejects.toThrow('Celular: esperado "3199887766", obtido "319988776"');
  });

  test('formulário válido que não envia', async ({ page }) => {
    const agent = await agentOn(page, 'nao-envia');
    await agent.fill(aluna);
    await agent.submit();
    await expect(agent.expectSubmitted()).rejects.toThrow('nenhum campo foi marcado como inválido');
  });

  test('formulário que aceita dado inválido', async ({ page }) => {
    const agent = await agentOn(page, 'aceita-invalido');
    await agent.fill(celularCurto);
    await agent.submit();
    await expect(agent.expectBlocked()).rejects.toThrow('a história esperava que fosse bloqueado');
  });

  test('envio barrado é explicado pelos campos que a tela recusou', async ({ page }) => {
    const agent = await agentOn(page);
    await agent.fill(celularCurto);
    await agent.submit();
    await expect(agent.expectSubmitted()).rejects.toThrow('Campos marcados como inválidos pela tela: Celular.');
  });

  test('expectativa errada na história também é acusada', async ({ page }) => {
    const agent = await agentOn(page);
    await agent.fill(celularCurto);
    await agent.submit();
    await agent.expectBlocked();
    await expect(agent.expectInvalid(['Nome'])).rejects.toThrow('Nome: esperado "inválido", obtido "válido"');
  });
});

test.describe('confirmação em tabela: o agente acha a linha certa entre outros registros', () => {
  test('sem defeito: a linha nova é encontrada e conferida coluna a coluna', async ({ page }) => {
    const agent = await agentOnTable(page);
    await agent.fill(aluna);
    await agent.submit();
    await agent.expectSubmitted();
    await agent.validateSummary();
  });

  test('linha gravada com um dado errado', async ({ page }) => {
    const agent = await agentOnTable(page, 'resumo-sobrenome-trocado');
    await agent.fill(aluna);
    await agent.submit();
    await agent.expectSubmitted();
    await expect(agent.validateSummary()).rejects.toThrow(
      'Nome completo: esperado "Beatriz Ramos", obtido "Beatriz Silva"',
    );
  });

  test('nenhuma linha nova: o registro que já existia não conta como envio', async ({ page }) => {
    const agent = await agentOnTable(page, 'nao-envia');
    await agent.fill(aluna);
    await agent.submit();
    await expect(agent.expectSubmitted()).rejects.toThrow('nenhum campo foi marcado como inválido');
  });

  test('dado inválido não gera linha nova', async ({ page }) => {
    const agent = await agentOnTable(page);
    await agent.fill(celularCurto);
    await agent.submit();
    await agent.expectBlocked();
    await agent.expectInvalid(['Celular']);
  });
});
