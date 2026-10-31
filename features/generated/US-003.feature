# language: pt
# Gerado automaticamente a partir de stories/US-003-aluna-transferida.md — não edite à mão.
# source-hash: f3eb6fa0b799
# interpretação: llm (claude-opus-5-5 via Claude Code) — revisada
@US-003 @cadastro @texto-livre @REQ_QA-12
Funcionalidade: US-003 · Matrícula de aluna transferida
  Como secretaria acadêmica
  Quero registrar alunos que chegam transferidos de outra escola
  Para manter o histórico de matérias e o contato deles atualizados

  @gerado-por-ia @smoke
  Cenário: Matrícula completa da aluna transferida
    Cobre: "Precisamos conseguir concluir a matrícula dela com todos esses dados e ver tudo certo na confirmação."

    Dado que estou no formulário "demoqa-practice-form"
    Quando preencho o formulário com:
      | Campo              | Valor                     |
      | Nome               | Beatriz                   |
      | Sobrenome          | Ramos                     |
      | E-mail             | beatriz.ramos@example.com |
      | Gênero             | Feminino                  |
      | Celular            | 3199887766                |
      | Data de nascimento | 03/03/2009                |
      | Matérias           | Química, Biologia         |
      | Hobbies            | Esportes                  |
      | Estado             | Rajasthan                 |
      | Cidade             | Jaipur                    |
    E envio o formulário
    Então o formulário deve ser enviado com sucesso
    E o resumo deve exibir os dados informados

  @gerado-por-ia @negativo
  Cenário: Matrícula da aluna transferida sem o gênero informado
    Cobre: "se alguém esquecer de informar o gênero do aluno transferido, o formulário não deixe concluir a matrícula."
    Mesmos dados da matrícula completa, só sem o gênero.

    Dado que estou no formulário "demoqa-practice-form"
    Quando preencho o formulário com:
      | Campo              | Valor                     |
      | Nome               | Beatriz                   |
      | Sobrenome          | Ramos                     |
      | E-mail             | beatriz.ramos@example.com |
      | Celular            | 3199887766                |
      | Data de nascimento | 03/03/2009                |
      | Matérias           | Química, Biologia         |
      | Hobbies            | Esportes                  |
      | Estado             | Rajasthan                 |
      | Cidade             | Jaipur                    |
    E envio o formulário
    Então o formulário não deve ser enviado
    E os campos "Gênero" devem estar inválidos
