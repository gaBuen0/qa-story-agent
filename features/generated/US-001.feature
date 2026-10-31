# language: pt
# Gerado automaticamente a partir de stories/US-001-cadastro-de-estudante.md — não edite à mão.
# source-hash: eac221e3fa57
# interpretação: determinística (parser de Markdown)
@US-001 @cadastro @REQ_QA-10
Funcionalidade: US-001 · Cadastro de estudante
  Como secretaria acadêmica
  Quero cadastrar um novo estudante pelo formulário de matrícula
  Para que ele já comece o semestre com os dados corretos no sistema

  @smoke @TEST_QA-101
  Cenário: Cadastro com todos os campos preenchidos
    Dado que estou no formulário "demoqa-practice-form"
    Quando preencho o formulário com:
      | Campo              | Valor                         |
      | Nome               | Maria                         |
      | Sobrenome          | Souza                         |
      | E-mail             | maria.souza@example.com       |
      | Gênero             | Feminino                      |
      | Celular            | 1198765432                    |
      | Data de nascimento | 15/05/1998                    |
      | Matérias           | Matemática, Física            |
      | Hobbies            | Leitura, Música               |
      | Foto               | foto-perfil.png               |
      | Endereço           | Rua das Acácias, 120 - Centro |
      | Estado             | NCR                           |
      | Cidade             | Delhi                         |
    E envio o formulário
    Então o formulário deve ser enviado com sucesso
    E o resumo deve exibir os dados informados

  Cenário: Cadastro só com os campos obrigatórios
    O estudante pode completar o restante do cadastro depois; nome, sobrenome, gênero e celular bastam para a matrícula.

    Dado que estou no formulário "demoqa-practice-form"
    Quando preencho o formulário com:
      | Campo     | Valor      |
      | Nome      | Carlos     |
      | Sobrenome | Pereira    |
      | Gênero    | Masculino  |
      | Celular   | 2133334444 |
    E envio o formulário
    Então o formulário deve ser enviado com sucesso
    E o resumo deve exibir os dados informados
