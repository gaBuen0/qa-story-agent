# language: pt
# Gerado automaticamente a partir de stories/US-002-validacoes-do-cadastro.md — não edite à mão.
# source-hash: 605893bcfcd1
# interpretação: determinística (parser de Markdown)
@US-002 @cadastro @validacao @REQ_QA-11
Funcionalidade: US-002 · Validações do cadastro de estudante
  Como secretaria acadêmica
  Quero que o formulário recuse dados incompletos ou mal formatados
  Para não gerar matrículas com contato inválido

  @negativo
  Cenário: Celular com menos de 10 dígitos
    Dado que estou no formulário "demoqa-practice-form"
    Quando preencho o formulário com:
      | Campo     | Valor     |
      | Nome      | João      |
      | Sobrenome | Lima      |
      | Gênero    | Masculino |
      | Celular   | 119876543 |
    E envio o formulário
    Então o formulário não deve ser enviado
    E os campos "Celular" devem estar inválidos

  @negativo
  Cenário: E-mail sem domínio completo
    Dado que estou no formulário "demoqa-practice-form"
    Quando preencho o formulário com:
      | Campo     | Valor        |
      | Nome      | Ana          |
      | Sobrenome | Costa        |
      | E-mail    | ana@invalido |
      | Gênero    | Feminino     |
      | Celular   | 1191234567   |
    E envio o formulário
    Então o formulário não deve ser enviado
    E os campos "E-mail" devem estar inválidos

  @negativo
  Cenário: Gênero e celular não informados
    Dado que estou no formulário "demoqa-practice-form"
    Quando preencho o formulário com:
      | Campo     | Valor |
      | Nome      | Bruno |
      | Sobrenome | Alves |
    E envio o formulário
    Então o formulário não deve ser enviado
    E os campos "Gênero, Celular" devem estar inválidos
