---
id: US-001
alvo: demoqa-practice-form
requisito: QA-10
tags: [cadastro]
---

# US-001 · Cadastro de estudante

**Como** secretaria acadêmica
**Quero** cadastrar um novo estudante pelo formulário de matrícula
**Para** que ele já comece o semestre com os dados corretos no sistema

## Cenário: Cadastro com todos os campos preenchidos

**Tags:** @smoke
**Xray:** QA-101

| Campo              | Valor                          |
| ------------------ | ------------------------------ |
| Nome               | Maria                          |
| Sobrenome          | Souza                          |
| E-mail             | maria.souza@example.com        |
| Gênero             | Feminino                       |
| Celular            | 1198765432                     |
| Data de nascimento | 15/05/1998                     |
| Matérias           | Matemática, Física             |
| Hobbies            | Leitura, Música                |
| Foto               | foto-perfil.png                |
| Endereço           | Rua das Acácias, 120 - Centro  |
| Estado             | NCR                            |
| Cidade             | Delhi                          |

**Resultado esperado:** enviado

## Cenário: Cadastro só com os campos obrigatórios

O estudante pode completar o restante do cadastro depois; nome, sobrenome, gênero e celular bastam para a matrícula.

| Campo     | Valor      |
| --------- | ---------- |
| Nome      | Carlos     |
| Sobrenome | Pereira    |
| Gênero    | Masculino  |
| Celular   | 2133334444 |

**Resultado esperado:** enviado
