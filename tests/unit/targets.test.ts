import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatFailures, sameValue } from '../../src/agent/checks';
import { formatInputDate, formatSummaryDate, parseDate } from '../../src/targets/dates';
import { findField, normalizeEntries } from '../../src/targets/normalize';
import { getTarget } from '../../src/targets/registry';

const target = getTarget('demoqa-practice-form');

describe('normalização dos valores da história', () => {
  it('encontra campos por rótulo, apelido ou chave, ignorando acentos e caixa', () => {
    assert.equal(findField(target, 'genero')?.key, 'gender');
    assert.equal(findField(target, 'E-MAIL')?.key, 'email');
    assert.equal(findField(target, 'Disciplinas')?.key, 'subjects');
    assert.equal(findField(target, 'birthDate')?.key, 'birthDate');
  });

  it('converte apelidos em português para os valores da tela', () => {
    const { values, errors } = normalizeEntries(target, [
      { field: 'Gênero', value: 'feminino' },
      { field: 'Matérias', value: 'Matemática, Física' },
      { field: 'Hobbies', value: 'Leitura; Música' },
      { field: 'Data de nascimento', value: '05/03/2009' },
      { field: 'Estado', value: 'Rajasthan' },
      { field: 'Cidade', value: 'Jaipur' },
    ]);
    assert.deepEqual(errors, []);
    assert.deepEqual(values, {
      gender: 'Female',
      subjects: ['Maths', 'Physics'],
      hobbies: ['Reading', 'Music'],
      birthDate: '2009-03-05',
      state: 'Rajasthan',
      city: 'Jaipur',
    });
  });

  it('acumula todos os erros de uma vez', () => {
    const { errors } = normalizeEntries(target, [
      { field: 'CPF', value: '123' },
      { field: 'Gênero', value: 'Roxo' },
      { field: 'Data de nascimento', value: '31/02/2000' },
      { field: 'Foto', value: 'nao-existe.png' },
    ]);
    assert.equal(errors.length, 4);
    assert.match(errors[1]!, /Opções: Male \(Masculino, M\)/);
  });

  it('valida cidade contra o estado', () => {
    const { errors } = normalizeEntries(target, [
      { field: 'Estado', value: 'NCR' },
      { field: 'Cidade', value: 'Jaipur' },
    ]);
    assert.match(errors.join(), /não pertence ao estado "NCR"/);
  });

  it('trata "(vazio)" como campo deixado em branco de propósito', () => {
    const { values, errors } = normalizeEntries(target, [{ field: 'E-mail', value: '(vazio)' }]);
    assert.deepEqual(errors, []);
    assert.deepEqual(values, {});
  });
});

describe('datas', () => {
  it('aceita dd/mm/aaaa e ISO, recusa datas impossíveis', () => {
    assert.equal(parseDate('15/05/1998'), '1998-05-15');
    assert.equal(parseDate('1998-05-15'), '1998-05-15');
    assert.equal(parseDate('30/02/2000'), null);
    assert.equal(parseDate('ontem'), null);
  });

  it('formata como o DemoQA exibe', () => {
    assert.equal(formatSummaryDate('1998-05-05'), '05 May,1998');
    assert.equal(formatInputDate('1998-05-05'), '05 May 1998');
  });
});

describe('comparação de valores', () => {
  it('compara listas sem considerar a ordem', () => {
    assert.ok(sameValue('Maths, Physics', 'Physics, Maths', 'unordered-list'));
    assert.ok(!sameValue('Maths, Physics', 'Physics', 'unordered-list'));
    assert.ok(sameValue('Rua  A', 'Rua A'));
  });

  it('descreve as divergências de forma legível', () => {
    const text = formatFailures([
      { phase: 'resumo', field: 'Mobile', expected: '1199', actual: '1188', passed: false },
      { phase: 'resumo', field: 'Gender', expected: 'Male', actual: 'Male', passed: true },
    ]);
    assert.match(text, /1 de 2 verificações falharam/);
    assert.match(text, /Mobile: esperado "1199", obtido "1188"/);
  });
});
