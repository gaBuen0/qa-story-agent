---
id: US-004
alvo: demoqa-web-tables
requisito: QA-13
tags: [funcionarios]
---

# US-004 · Cadastro de funcionário da escola

**Como** setor de recursos humanos da escola
**Quero** cadastrar professores e funcionários na tabela de colaboradores
**Para** manter a folha e os contatos da equipe atualizados

<!--
Outro formulário, outro formato de confirmação: aqui o registro aparece como uma linha nova
na tabela, em vez de um resumo. A história e os passos BDD são os mesmos de sempre.
-->

## Cenário: Cadastro de professora com todos os dados

**Tags:** @smoke

| Campo        | Valor                     |
| ------------ | ------------------------- |
| Nome         | Helena                    |
| Sobrenome    | Duarte                    |
| E-mail       | helena.duarte@example.com |
| Idade        | 34                        |
| Salário      | 6500                      |
| Departamento | Coordenação Pedagógica    |

**Resultado esperado:** enviado

## Cenário: Idade digitada com a letra O no lugar do zero

**Tags:** @negativo

| Campo        | Valor                    |
| ------------ | ------------------------ |
| Nome         | Otávio                   |
| Sobrenome    | Prado                    |
| E-mail       | otavio.prado@example.com |
| Idade        | 3O                       |
| Salário      | 4200                     |
| Departamento | Secretaria               |

**Resultado esperado:** bloqueado
**Campos inválidos:** Idade

## Cenário: Salário com separador e e-mail sem domínio

**Tags:** @negativo

| Campo        | Valor          |
| ------------ | -------------- |
| Nome         | Lúcia          |
| Sobrenome    | Martins        |
| E-mail       | lucia@escola   |
| Idade        | 41             |
| Salário      | 5.300          |
| Departamento | Biblioteca     |

**Resultado esperado:** bloqueado
**Campos inválidos:** E-mail, Salário

## Cenário: Só o nome informado

**Tags:** @negativo

| Campo | Valor  |
| ----- | ------ |
| Nome  | Caio   |

**Resultado esperado:** bloqueado
**Campos inválidos:** Sobrenome, E-mail, Idade, Salário, Departamento
