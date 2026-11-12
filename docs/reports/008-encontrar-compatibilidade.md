# Relatório — 008 Encontrar meu grupo `/encontrar` com `calcMatch` no servidor
Marco: M4 · Spec: [`docs/specs/008-encontrar-compatibilidade.md`](../specs/008-encontrar-compatibilidade.md) · QA: — (pendente)
Branch: `feat/m4-compatibilidade` · Data: 2026-11-11

## Linha do tempo
| Etapa | Resultado |
|---|---|
| Specifier | Spec única do M4 escrita; 5 perguntas (P1–P5) respondidas pelo usuário em 2026-11-11 (defaults); spec finalizada como "pronta para Coder" |
| Coder | — (pipeline pausado a pedido do usuário após a spec) |
| Cleaner | — |
| Hardener | — |
| QA | — |

## Decisões de produto
- **P1** (default): `/encontrar` só por **GET**, respostas na query string (como `/grupos`). Não existe `POST /encontrar`; sem CSRF nem body-parser no M4. AGENTS §5 atualizado.
- **P2** (default): subtítulo vira "…Nada é salvo." (sai "nem enviado", que deixou de ser verdade).
- **P3** (default): empate desfeito pela ordem de criação (`ORDER BY g.id`, ordenação estável), reproduzindo o protótipo.
- **P4** (default): motivo "Fica na Centro" fica literal; entra no item P11 de `PENDENCIAS.md` junto com "Selo da Centro".
- **P5** (default): `inputmode="numeric"` no pace fica literal; item novo em `PENDENCIAS.md` (M7) para testar em iPhone real.

## Specifier
- Spec: domínio `src/domain/match.js` (`calcMatch`, `rankMatches`: pct ≥ 40, desc, máx. 6), módulo `src/modules/matching/` (schemas zod, service, routes), repo `listPublishedByCreation()`, view `pages/encontrar.ejs` e partials `match-card` e `form-errors`.
- Critério do marco: `tests/domain/match-prototipo.test.js` compara uma cópia literal do código do protótipo com `rankMatches` sobre uma grade determinística de respostas com os 11 grupos demo; casos A–J trabalhados na spec.
- Divergências do AGENTS §6 em relação ao protótipo (a spec segue o protótipo): 5 motivos em vez de 2; pace a até 60 s e nível vizinho pontuam sem motivo; "dentro da faixa" inclui as bordas; desempate não definido. AGENTS §6 ganhou um parágrafo com esses detalhes.
- Fora do escopo: o item "zod no cadastro de grupo" listado em M4 no `PENDENCIAS.md` é do cadastro (M6) e foi movido para lá; "Você já participa" e modal de participar ficam para M6/M7.

## Orquestrador
- `AGENTS.md`: §3 (arquivos de `matching/` e partial `match-card`), §5 (`/encontrar` via GET com query; linha `POST /encontrar` removida), §6 (detalhes do `calcMatch` vindos do protótipo).
- `docs/PENDENCIAS.md`: P1–P5 registradas como resolvidas; "Fica na Centro" no item P11; item de cadastro movido de M4 para M6; teste do `inputmode` em aparelho real no M7; nota no M8 de que `/encontrar` deixa de ser link 404.
