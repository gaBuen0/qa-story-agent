---
id: US-002
alvo: demoqa-practice-form
requisito: QA-11
tags: [cadastro, validacao]
---

# US-002 · Validações do cadastro de estudante

**Como** secretaria acadêmica
**Quero** que o formulário recuse dados incompletos ou mal formatados
**Para** não gerar matrículas com contato inválido

## Cenário: Celular com menos de 10 dígitos

**Tags:** @negativo

| Campo     | Valor     |
| --------- | --------- |
| Nome      | João      |
| Sobrenome | Lima      |
| Gênero    | Masculino |
| Celular   | 119876543 |

**Resultado esperado:** bloqueado
**Campos inválidos:** Celular

## Cenário: E-mail sem domínio completo

**Tags:** @negativo

| Campo     | Valor        |
| --------- | ------------ |
| Nome      | Ana          |
| Sobrenome | Costa        |
| E-mail    | ana@invalido |
| Gênero    | Feminino     |
| Celular   | 1191234567   |

**Resultado esperado:** bloqueado
**Campos inválidos:** E-mail

## Cenário: Gênero e celular não informados

**Tags:** @negativo

| Campo     | Valor  |
| --------- | ------ |
| Nome      | Bruno  |
| Sobrenome | Alves  |

**Resultado esperado:** bloqueado
**Campos inválidos:** Gênero, Celular
