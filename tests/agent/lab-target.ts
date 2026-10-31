import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { FilledValues, FormTarget } from '../../src/targets/types';

const PAGE = pathToFileURL(path.join(__dirname, 'lab', 'formulario-lab.html')).href;
const str = (v: FilledValues[string] | undefined) => (v === undefined ? '' : Array.isArray(v) ? v.join(', ') : v);

/** Defeitos que o formulário de laboratório sabe simular (veja lab/formulario-lab.html). */
export type LabDefect =
  | 'resumo-sobrenome-trocado'
  | 'resumo-sem-hobby'
  | 'resumo-sem-endereco'
  | 'celular-corta-digito'
  | 'nao-envia'
  | 'aceita-invalido';

/** Como a tela confirma o envio: resumo (como o cadastro de estudante) ou linha nova numa tabela (como o Web Tables). */
export type LabFormat = 'resumo' | 'tabela';

/** Alvo local, sem internet, declarado do mesmo jeito que os formulários do DemoQA. */
export function labTarget(defects: LabDefect[] = [], format: LabFormat = 'resumo'): FormTarget {
  const params = new URLSearchParams();
  if (defects.length) params.set('defeito', defects.join(','));
  if (format === 'tabela') params.set('formato', 'tabela');
  const hash = params.toString();

  return {
    id: 'formulario-lab',
    name: 'Formulário de laboratório',
    url: hash ? `${PAGE}#${hash}` : PAGE,
    fields: [
      { key: 'firstName', label: 'Nome', kind: 'text', selector: '#nome', required: true },
      { key: 'lastName', label: 'Sobrenome', kind: 'text', selector: '#sobrenome', required: true },
      { key: 'email', label: 'E-mail', kind: 'text', selector: '#email' },
      {
        key: 'gender', label: 'Gênero', kind: 'radio-group', selector: '#genero', required: true,
        validitySelector: '#genero-m',
        options: [{ value: 'Masculino' }, { value: 'Feminino' }, { value: 'Outro' }],
      },
      { key: 'mobile', label: 'Celular', kind: 'text', selector: '#celular', required: true },
      {
        key: 'hobbies', label: 'Hobbies', kind: 'checkbox-group', selector: '#hobbies',
        options: [{ value: 'Esportes' }, { value: 'Leitura' }, { value: 'Música' }],
      },
      { key: 'address', label: 'Endereço', kind: 'textarea', selector: '#endereco' },
    ],
    submitSelector: '#enviar',
    confirmation:
      format === 'tabela'
        ? { kind: 'table-row', tableSelector: '#registros', keyColumn: 'E-mail' }
        : {
            kind: 'label-value-table',
            title: { selector: '#titulo-confirmacao', text: 'Matrícula recebida' },
            rowsSelector: '#resumo tr',
          },
    summary: [
      { label: 'Nome completo', expected: (v) => `${str(v.firstName)} ${str(v.lastName)}`.trim() },
      { label: 'E-mail', expected: (v) => str(v.email) },
      { label: 'Gênero', expected: (v) => str(v.gender) },
      { label: 'Celular', expected: (v) => str(v.mobile) },
      { label: 'Hobbies', expected: (v) => str(v.hobbies), match: 'unordered-list' },
      { label: 'Endereço', expected: (v) => str(v.address) },
    ],
  };
}
