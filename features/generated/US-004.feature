# language: pt
# Gerado automaticamente a partir de stories/US-004-cadastro-de-funcionario.md — não edite à mão.
# source-hash: 6f900343ed7e
# interpretação: determinística (parser de Markdown)
@US-004 @funcionarios @REQ_QA-13
Funcionalidade: US-004 · Cadastro de funcionário da escola
  Como setor de recursos humanos da escola
  Quero cadastrar professores e funcionários na tabela de colaboradores
  Para manter a folha e os contatos da equipe atualizados

  @smoke
  Cenário: Cadastro de professora com todos os dados
    Dado que estou no formulário "demoqa-web-tables"
    Quando preencho o formulário com:
      | Campo        | Valor                     |
      | Nome         | Helena                    |
      | Sobrenome    | Duarte                    |
      | E-mail       | helena.duarte@example.com |
      | Idade        | 34                        |
      | Salário      | 6500                      |
      | Departamento | Coordenação Pedagógica    |
    E envio o formulário
    Então o formulário deve ser enviado com sucesso
    E o resumo deve exibir os dados informados

  @negativo
  Cenário: Idade digitada com a letra O no lugar do zero
    Dado que estou no formulário "demoqa-web-tables"
    Quando preencho o formulário com:
      | Campo        | Valor                    |
      | Nome         | Otávio                   |
      | Sobrenome    | Prado                    |
      | E-mail       | otavio.prado@example.com |
      | Idade        | 3O                       |
      | Salário      | 4200                     |
      | Departamento | Secretaria               |
    E envio o formulário
    Então o formulário não deve ser enviado
    E os campos "Idade" devem estar inválidos

  @negativo
  Cenário: Salário com separador e e-mail sem domínio
    Dado que estou no formulário "demoqa-web-tables"
    Quando preencho o formulário com:
      | Campo        | Valor        |
      | Nome         | Lúcia        |
      | Sobrenome    | Martins      |
      | E-mail       | lucia@escola |
      | Idade        | 41           |
      | Salário      | 5.300        |
      | Departamento | Biblioteca   |
    E envio o formulário
    Então o formulário não deve ser enviado
    E os campos "E-mail, Salário" devem estar inválidos

  @negativo
  Cenário: Só o nome informado
    Dado que estou no formulário "demoqa-web-tables"
    Quando preencho o formulário com:
      | Campo | Valor |
      | Nome  | Caio  |
    E envio o formulário
    Então o formulário não deve ser enviado
    E os campos "Sobrenome, E-mail, Idade, Salário, Departamento" devem estar inválidos
