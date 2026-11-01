# language: pt
# Gerado automaticamente a partir de stories/US-005-cadastro-de-estagiario.md — não edite à mão.
# source-hash: 8cae0648dddb
# interpretação: determinística (parser de Markdown)
@US-005 @estagiarios @REQ_QA-15
Funcionalidade: US-005 · Cadastro de estagiário
  Como coordenação de estágios da escola
  Quero cadastrar cada estagiário com a bolsa e o setor
  Para acompanhar quem está em cada departamento

  @smoke
  Cenário: Estagiária cadastrada com a bolsa do primeiro ano
    Dado que estou no formulário "demoqa-web-tables"
    Quando preencho o formulário com:
      | Campo        | Valor                       |
      | Nome         | Marina                      |
      | Sobrenome    | Teixeira                    |
      | E-mail       | marina.teixeira@example.com |
      | Idade        | 20                          |
      | Salário      | 1200                        |
      | Departamento | Laboratório                 |
    E envio o formulário
    Então o formulário deve ser enviado com sucesso
    E o resumo deve exibir os dados informados

  @negativo
  Cenário: Estagiário sem o departamento informado
    Dado que estou no formulário "demoqa-web-tables"
    Quando preencho o formulário com:
      | Campo     | Valor                    |
      | Nome      | Otávio                   |
      | Sobrenome | Ramos                    |
      | E-mail    | otavio.ramos@example.com |
      | Idade     | 19                       |
      | Salário   | 1200                     |
    E envio o formulário
    Então o formulário não deve ser enviado
    E os campos "Departamento" devem estar inválidos
