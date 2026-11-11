# Pace Paulista

> Encontre seu grupo. Encontre seu ritmo.

O Pace Paulista ajuda corredores de São Paulo a achar grupos de corrida que combinam com a **zona da cidade**, o **pace**, os **dias e horários** e o **nível** de cada um.

O projeto começou como um protótipo de página única ([`docs/prototipo.html`](docs/prototipo.html)) e está virando um site monolítico com renderização no servidor, banco PostgreSQL e contas de usuário.

## Status

| Marco | Entrega | Situação |
|---|---|---|
| **M1** Scaffold | Express + EJS, layout, CSS do protótipo, 404/500 e home estática | ✅ concluído |
| **M2** Banco | Postgres, migrations e seed dos grupos demo | ⏳ próximo |
| **M3** Leitura | `/grupos` com filtros, detalhe, zonas, mapa e sobre | — |
| **M4** Compatibilidade | `/encontrar` | — |
| **M5** Contas | Criar conta, entrar e sair, sessão | — |
| **M6** Escrita | Cadastrar grupo, participar, "Meus grupos", excluir conta | — |
| **M7** JS progressivo | Filtros ao vivo, modal, toast | — |
| **M8** Produção | helmet/CSP, rate limit, deploy | — |

Os detalhes de cada marco estão em [`docs/MILESTONES.md`](docs/MILESTONES.md).

> ⚠️ Por enquanto só a home funciona. Os links para grupos, zonas, mapa e conta levam a uma página 404 até os próximos marcos.

## Stack

- **Node.js 22** com **Express 5** e views **EJS** renderizadas no servidor. O JS do cliente só melhora a experiência: o site funciona sem JavaScript.
- **PostgreSQL 16** acessado com `pg` e SQL escrito à mão, sem ORM. Entra no M2.
- **zod** para validação, **vitest** e **supertest** para testes, **ESLint** e **Prettier** para lint e formatação.

As decisões de arquitetura completas estão em [`AGENTS.md`](AGENTS.md).

## Como rodar

Requisitos: Node.js 22 ou mais novo. A partir do M2 também vai ser preciso o Docker, para o Postgres local.

```bash
npm install
cp .env.example .env
npm run dev
```

Abra http://localhost:3000.

| Comando | O que faz |
|---|---|
| `npm run dev` | Sobe o servidor e reinicia a cada alteração (`node --watch`) |
| `npm start` | Sobe o servidor |
| `npm test` | Roda os testes (vitest) |
| `npm run lint` | Roda ESLint e `prettier --check` |
| `npm run format` | Formata o código com Prettier |

Variáveis de ambiente: veja [`.env.example`](.env.example). `TZ_APP` precisa ser um fuso IANA válido (padrão `America/Sao_Paulo`).

## Estrutura

```
src/
  app.js, server.js      montagem do Express e app.listen
  config/env.js          variáveis de ambiente validadas com zod
  domain/                funções puras (pace, agenda, constantes), sem I/O
  modules/<nome>/        routes → service → repo, por domínio
  middlewares/           locals, 404 e tratamento de erros
  views/                 layout, partials e páginas EJS
public/                  CSS do protótipo e JS progressivo
db/seeds/                grupos de demonstração
tests/domain, tests/http testes unitários e HTTP
docs/                    protótipo, specs, relatórios de QA e do pipeline
```

## Como o trabalho é feito

Cada entrega passa por um pipeline de agentes de IA definidos em [`.claude/agents/`](.claude/agents):

```
Specifier → (OK humano) → Coder → Cleaner → Hardener → QA
```

- [`docs/specs/`](docs/specs): especificação de cada tarefa, com critérios de aceite.
- [`docs/qa/`](docs/qa): veredito do QA, com a evidência de cada critério.
- [`docs/reports/`](docs/reports): o que cada etapa fez.
- [`docs/PENDENCIAS.md`](docs/PENDENCIAS.md): riscos, pendências e perguntas abertas, organizados por marco.

Convenções de código, testes e git estão em [`CONVENTIONS.md`](CONVENTIONS.md). Resumo:
- código em inglês;
- interface, mensagens, commits e comentários em português;
- Conventional Commits;
- um PR por spec.

## Dados de demonstração

Os 11 grupos exibidos hoje são **fictícios**, marcados como "Fictício · demo" e criados só para demonstrar a plataforma.
