import { DEMOQA_BLOCKED_REQUESTS, removeDemoqaBanners, str } from './demoqa-common';
import type { FormTarget } from './types';

/**
 * Cadastro de funcionário do DemoQA (Web Tables).
 * Diferente do cadastro de estudante, o formulário abre numa janela e a confirmação
 * não é um resumo: o registro aparece como uma linha nova na tabela.
 * Nenhum passo BDD nem código do agente é específico desta tela.
 */
export const demoqaWebTables: FormTarget = {
  id: 'demoqa-web-tables',
  name: 'Cadastro de funcionário (DemoQA Web Tables)',
  url: 'https://demoqa.com/webtables',
  blockRequests: DEMOQA_BLOCKED_REQUESTS,
  afterLoad: async (page) => {
    await removeDemoqaBanners(page);
    // O formulário fica numa janela aberta pelo botão "Add".
    await page.locator('#addNewRecordButton').click();
    await page.locator('#userForm').waitFor();
  },

  fields: [
    { key: 'firstName', label: 'Nome', aliases: ['First Name'], kind: 'text', selector: '#firstName', required: true, hint: 'até 25 caracteres' },
    { key: 'lastName', label: 'Sobrenome', aliases: ['Last Name'], kind: 'text', selector: '#lastName', required: true, hint: 'até 25 caracteres' },
    { key: 'email', label: 'E-mail', aliases: ['Email'], kind: 'text', selector: '#userEmail', required: true, hint: 'formato nome@dominio.com' },
    { key: 'age', label: 'Idade', aliases: ['Age'], kind: 'text', selector: '#age', required: true, hint: 'só números, até 2 dígitos' },
    { key: 'salary', label: 'Salário', aliases: ['Salary'], kind: 'text', selector: '#salary', required: true, hint: 'só números, até 10 dígitos' },
    { key: 'department', label: 'Departamento', aliases: ['Department'], kind: 'text', selector: '#department', required: true, hint: 'até 25 caracteres' },
  ],

  submitSelector: '#submit',
  confirmation: { kind: 'table-row', tableSelector: 'table', keyColumn: 'Email' },
  summary: [
    { label: 'First Name', expected: (v) => str(v.firstName) },
    { label: 'Last Name', expected: (v) => str(v.lastName) },
    { label: 'Age', expected: (v) => str(v.age) },
    { label: 'Email', expected: (v) => str(v.email) },
    { label: 'Salary', expected: (v) => str(v.salary) },
    { label: 'Department', expected: (v) => str(v.department) },
  ],
};
