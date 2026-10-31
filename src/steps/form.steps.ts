import type { DataTable } from 'playwright-bdd';
import { Given, Then, When } from './fixtures';

// Passos genéricos: valem para qualquer formulário cadastrado em src/targets.
// O agente recebe os dados do cenário e decide como operar cada campo.

Given('que estou no formulário {string}', async ({ agent }, targetId: string) => {
  await agent.open(targetId);
});

When('preencho o formulário com:', async ({ agent }, table: DataTable) => {
  await agent.fill(table.hashes().map((row) => ({ field: row.Campo ?? '', value: row.Valor ?? '' })));
});

When('envio o formulário', async ({ agent }) => {
  await agent.submit();
});

Then('o formulário deve ser enviado com sucesso', async ({ agent }) => {
  await agent.expectSubmitted();
});

Then('o resumo deve exibir os dados informados', async ({ agent }) => {
  await agent.validateSummary();
});

Then('o formulário não deve ser enviado', async ({ agent }) => {
  await agent.expectBlocked();
});

Then('os campos {string} devem estar inválidos', async ({ agent }, fields: string) => {
  await agent.expectInvalid(fields.split(/\s*,\s*/).filter(Boolean));
});
