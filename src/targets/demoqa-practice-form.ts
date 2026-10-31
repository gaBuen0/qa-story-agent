import { formatSummaryDate } from './dates';
import { DEMOQA_BLOCKED_REQUESTS, removeDemoqaBanners, str } from './demoqa-common';
import type { FilledValues, FormTarget, OptionSpec } from './types';

const fileName = (v: FilledValues[string] | undefined): string => str(v).split(/[\\/]/).pop() ?? '';

const STATES: OptionSpec[] = [
  { value: 'NCR' },
  { value: 'Uttar Pradesh' },
  { value: 'Haryana' },
  { value: 'Rajasthan' },
];

const CITIES: OptionSpec[] = [
  { value: 'Delhi', aliases: ['Déli', 'Nova Déli'], parent: 'NCR' },
  { value: 'Gurgaon', parent: 'NCR' },
  { value: 'Noida', parent: 'NCR' },
  { value: 'Agra', parent: 'Uttar Pradesh' },
  { value: 'Lucknow', parent: 'Uttar Pradesh' },
  { value: 'Merrut', parent: 'Uttar Pradesh' },
  { value: 'Karnal', parent: 'Haryana' },
  { value: 'Panipat', parent: 'Haryana' },
  { value: 'Jaipur', parent: 'Rajasthan' },
  { value: 'Jaiselmer', parent: 'Rajasthan' },
];

/**
 * Formulário de cadastro de estudante do DemoQA (site público de prática).
 * Tudo o que o agente sabe sobre a tela está aqui, de forma declarativa:
 * campos, como operá-los, como validar o resultado.
 */
export const demoqaPracticeForm: FormTarget = {
  id: 'demoqa-practice-form',
  name: 'Cadastro de estudante (DemoQA)',
  url: 'https://demoqa.com/automation-practice-form',
  blockRequests: DEMOQA_BLOCKED_REQUESTS,
  afterLoad: async (page) => {
    await page.locator('#firstName').waitFor();
    await removeDemoqaBanners(page);
  },

  fields: [
    {
      key: 'firstName',
      label: 'Nome',
      aliases: ['Primeiro nome', 'First Name'],
      kind: 'text',
      selector: '#firstName',
      required: true,
    },
    {
      key: 'lastName',
      label: 'Sobrenome',
      aliases: ['Último nome', 'Last Name'],
      kind: 'text',
      selector: '#lastName',
      required: true,
    },
    {
      key: 'email',
      label: 'E-mail',
      aliases: ['Email'],
      kind: 'text',
      selector: '#userEmail',
      hint: 'formato nome@dominio.com',
    },
    {
      key: 'gender',
      label: 'Gênero',
      aliases: ['Sexo', 'Gender'],
      kind: 'radio-group',
      selector: '#genterWrapper',
      validitySelector: '#gender-radio-1',
      required: true,
      options: [
        { value: 'Male', aliases: ['Masculino', 'M'] },
        { value: 'Female', aliases: ['Feminino', 'F'] },
        { value: 'Other', aliases: ['Outro'] },
      ],
    },
    {
      key: 'mobile',
      label: 'Celular',
      aliases: ['Telefone', 'Mobile'],
      kind: 'text',
      selector: '#userNumber',
      required: true,
      hint: 'exatamente 10 dígitos numéricos',
    },
    {
      key: 'birthDate',
      label: 'Data de nascimento',
      aliases: ['Nascimento', 'Date of Birth'],
      kind: 'react-datepicker',
      selector: '#dateOfBirthInput',
      hint: 'dd/mm/aaaa',
    },
    {
      key: 'subjects',
      label: 'Matérias',
      aliases: ['Disciplinas', 'Subjects'],
      kind: 'autocomplete-multi',
      selector: '#subjectsInput',
      hint: 'lista separada por vírgula',
      options: [
        { value: 'Maths', aliases: ['Matemática'] },
        { value: 'Physics', aliases: ['Física'] },
        { value: 'Chemistry', aliases: ['Química'] },
        { value: 'Biology', aliases: ['Biologia'] },
        { value: 'English', aliases: ['Inglês'] },
        { value: 'Hindi' },
        { value: 'Computer Science', aliases: ['Ciência da Computação', 'Computação'] },
        { value: 'History', aliases: ['História'] },
        { value: 'Economics', aliases: ['Economia'] },
        { value: 'Arts', aliases: ['Artes'] },
        { value: 'Social Studies', aliases: ['Estudos Sociais'] },
        { value: 'Accounting', aliases: ['Contabilidade'] },
        { value: 'Commerce', aliases: ['Comércio'] },
        { value: 'Civics', aliases: ['Educação Cívica'] },
      ],
    },
    {
      key: 'hobbies',
      label: 'Hobbies',
      aliases: ['Passatempos'],
      kind: 'checkbox-group',
      selector: '#hobbiesWrapper',
      hint: 'lista separada por vírgula',
      options: [
        { value: 'Sports', aliases: ['Esportes'] },
        { value: 'Reading', aliases: ['Leitura'] },
        { value: 'Music', aliases: ['Música'] },
      ],
    },
    {
      key: 'picture',
      label: 'Foto',
      aliases: ['Imagem', 'Picture'],
      kind: 'file',
      selector: '#uploadPicture',
      hint: 'nome de um arquivo em fixtures/files',
    },
    {
      key: 'address',
      label: 'Endereço',
      aliases: ['Endereço atual', 'Address'],
      kind: 'textarea',
      selector: '#currentAddress',
    },
    { key: 'state', label: 'Estado', aliases: ['State'], kind: 'react-select', selector: '#state', options: STATES },
    {
      key: 'city',
      label: 'Cidade',
      aliases: ['City'],
      kind: 'react-select',
      selector: '#city',
      options: CITIES,
      dependsOn: 'state',
    },
  ],

  submitSelector: '#submit',
  confirmation: {
    kind: 'label-value-table',
    title: { selector: '#example-modal-sizes-title-lg', text: 'Thanks for submitting the form' },
    rowsSelector: '.modal-body tbody tr',
  },
  summary: [
    { label: 'Student Name', expected: (v) => [str(v.firstName), str(v.lastName)].join(' ').trim() },
    { label: 'Student Email', expected: (v) => str(v.email) },
    { label: 'Gender', expected: (v) => str(v.gender) },
    { label: 'Mobile', expected: (v) => str(v.mobile) },
    // Sem data informada, o site usa a data de hoje: não há o que comparar.
    { label: 'Date of Birth', expected: (v) => (v.birthDate ? formatSummaryDate(str(v.birthDate)) : undefined) },
    { label: 'Subjects', expected: (v) => str(v.subjects), match: 'unordered-list' },
    { label: 'Hobbies', expected: (v) => str(v.hobbies), match: 'unordered-list' },
    { label: 'Picture', expected: (v) => fileName(v.picture) },
    { label: 'Address', expected: (v) => str(v.address) },
    { label: 'State and City', expected: (v) => [str(v.state), str(v.city)].filter(Boolean).join(' ') },
  ],

  crossValidate: (v) => {
    const errors: string[] = [];
    if (v.city && !v.state) errors.push('"Cidade" exige que "Estado" também seja informado.');
    const city = CITIES.find((c) => c.value === v.city);
    if (city && v.state && city.parent !== v.state) {
      errors.push(`A cidade "${city.value}" não pertence ao estado "${str(v.state)}" (pertence a "${city.parent}").`);
    }
    return errors;
  },
};
