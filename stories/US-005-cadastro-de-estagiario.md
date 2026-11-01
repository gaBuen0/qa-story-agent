---
id: US-005
alvo: demoqa-web-tables
requisito: QA-15
tags: [estagiarios]
origem: https://github.com/gaBuen0/qa-story-agent/issues/1
---

# US-005 · Cadastro de estagiário

**Como** coordenação de estágios da escola
**Quero** cadastrar cada estagiário com a bolsa e o setor
**Para** acompanhar quem está em cada departamento

<!-- Gerada a partir da issue #1. -->

## Cenário: Estagiária cadastrada com a bolsa do primeiro ano

**Tags:** @smoke

| Campo | Valor |
| ----- | ----- |
| Nome | Marina |
| Sobrenome | Teixeira |
| E-mail | marina.teixeira@example.com |
| Idade | 20 |
| Salário | 1200 |
| Departamento | Laboratório |

**Resultado esperado:** enviado

## Cenário: Estagiário sem o departamento informado

**Tags:** @negativo

| Campo | Valor |
| ----- | ----- |
| Nome | Otávio |
| Sobrenome | Ramos |
| E-mail | otavio.ramos@example.com |
| Idade | 19 |
| Salário | 1200 |

**Resultado esperado:** bloqueado
**Campos inválidos:** Departamento
