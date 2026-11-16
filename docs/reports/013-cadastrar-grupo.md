# 013 — Cadastrar grupo

Spec: [`docs/specs/013-cadastrar-grupo.md`](../specs/013-cadastrar-grupo.md) · Marco: M6

## Specifier
Spec 013 escrita; o M6 foi dividido em três specs: **013** cadastrar grupo (esta), **014** participar/sair, **015** `/meus` + teste do fluxo completo.
- Migration nova `006_groups_start_time_check.sql` (`CHECK (start_time < '24:00')`).
- `domain/slug.js` (`slugify`, `nextSlug`, reservados `novo` e `zona`); `groups.schemas.js` (`parseGroupForm`); repo (`nameExists`, `findSlugsLike`, `insertGroup`); service `createGroup` (`23505` em nome → erro do campo; em slug → até 3 tentativas); rotas `GET /grupos/novo` e `POST /grupos` antes de `/grupos/:slug`; sucesso 303 para `/grupos/<slug>?criado=1` (tela de sucesso só para o dono).
- 13 critérios de aceite.
- Diferenças em relação ao AGENTS: mensagem do pace mais lento segue o protótipo ("Use o formato 6:30, entre 3:00 e 12:00."); mensagens novas de tamanho máximo.
- Riscos: sem rate limit em `POST /grupos`; limites de ponto/distância/contato só no zod; `owner_id` sai do repo nas listagens (o `/api/grupos` do M7 deve removê-lo, junto com `contact`).
- Perguntas abertas P1–P6 (defaults na spec): tela de sucesso, moderação (`published`), texto do aside, mensagens de máximo, edição pelo dono (roadmap), destaques da home (M9).
- Aprovação: P1–P6 = defaults (usuário).

## Coder
`npm test` 778 ok, `npm run lint` ok. P1–P6 = defaults. Postgres 16 local subido no ambiente (bancos `pace_paulista` e `pace_paulista_test`).
- **Criados**: `006_groups_start_time_check.sql`, `groups.schemas.js` (`parseGroupForm`), `grupo-novo.ejs` (form e modo sucesso), `groups-schemas.test.js`, `groups-service.test.js`, `grupo-novo.test.js`.
- **Alterados**: `domain/slug.js`, `groups.repo.js` (`nameExists`, `findSlugsLike`, `insertGroup`, `owner_id::text`), `groups.service.js` (`createGroup`, `isOwner`), `groups.routes.js` (`GET /grupos/novo` e `POST /grupos` antes de `/:slug`), `helpers.js` (`currentNav('/grupos/novo')` = `''`), `grupo-detalhe.ejs`, `demo-tag.ejs` ("Cadastrado por você"), `public/js/app.js` (`descCount`) e testes existentes (`slug`, `view-helpers`, `groups-repo`, `schema`, `migrate`, `grupo-detalhe`).
- CA1–CA13 cobertos por testes; CA12 (360 px) e o contador `descCount` não foram verificados no navegador, e a contagem em `/zonas` também não.
- `migrate.test.js` agora espera 6 migrations (temporários viram `007_*`); o teste de escape em `grupo-detalhe` ganhou um usuário extra, porque o viewer fake (id 1) viraria "Cadastrado por você".
- Alertas: `/api/grupos` (M7) deve remover `owner_id` junto com `contact`; sem rate limit em `POST /grupos` (Hardener/M8); nome de 50 caracteres sem espaço no card a 360 px (QA; `overflow-wrap` se reproduzir).

## Cleaner
`npm test` 779 ok (eram 778), `npm run lint` ok. Sem mudança de comportamento nem de texto de UI.
- `groups.service.js`: `withNameTaken` (uma linha) inlinada em `createGroup`; ordem "nome primeiro" mantida, comentário movido para o ponto de uso.
- `groups-service.test.js`: o teste de slug misturava dois cenários e tinha `mockReset` no meio; dividido em "refaz o slug quando `groups_slug_key` colide numa corrida" e "desiste depois de 3 colisões de slug".
- `tests/helpers/auth.js`: `signedUp` (criar conta pelo form e devolver agente logado) estava duplicado em `grupo-novo.test.js`; movido para o helper compartilhado.
- **Deixado de propósito**: regra "é dono" em `groups.service.js` (`isOwner`) e inline em `demo-tag.ejs` (poderia virar função em `domain/`); CA11 em HTTP repete parte da cobertura de domínio, mas exercita o parsing do body no Express (`nome=a&nome=b`, NUL).
- **Pendências para as próximas etapas**: `owner_id` sai do repo, então o `/api/grupos` (M7) deve removê-lo junto com `contact`; sem rate limit em `POST /grupos` (Hardener/M8); 360 px e nome de 50 caracteres sem espaço no card (QA); sem verificação visual, só HTTP.

## Hardener
`npm test` 782 ok (eram 779), `npm run lint` ok. Dois achados, cada um com teste escrito antes da correção.
- **Nome imitando outro grupo (média)**: espaço duplo, ZWSP (U+200B), NBSP, caracteres de direção do texto ou quebra de linha passavam pelo `UNIQUE` (citext) e permitiam se passar por outro grupo; nome só de caracteres invisíveis passava no mínimo de 3. Correção em `text()` de `groups.schemas.js`: remove `\p{Cf}` (ZWJ só dentro de emoji composto) e, nos campos de uma linha (nome, local, ponto, distância, contato), junta espaços/tabs/quebras repetidos em um espaço. Testes: `grupo-novo.test.js` ("nome igual com espaço duplo ou caractere invisível é recusado") e `groups-schemas.test.js` ("tira caracteres invisíveis e junta espaços nos campos de uma linha").
- **Descrição com CRLF (baixa)**: o navegador envia CRLF (2 caracteres) e o `maxlength` conta 1, então quem via 400/400 recebia 422. Correção: CRLF/CR viram LF antes de contar; na descrição ficam quebra de linha e tab, outros controles saem. Teste: `groups-schemas.test.js` ("quebra de linha CRLF conta como 1 caractere na descrição").
- **Verificado sem problema**: queries parametrizadas (`LIKE` do slug com `ESCAPE`); nenhuma entrada dispara CHECK (`23514`); `23505` tratado em `groups_name_key` e `groups_slug_key` (até 3 tentativas); `requireAuth` no GET e POST, CSRF global, deslogado recebe 303 sem gravar; `?criado=1` só para o dono; escape só com `<%= %>`, contato como texto; `errorHandler` loga só `code`/`constraint`/`table`; citext compara acentos sem diferença de caixa.
- **Riscos aceitos/pendentes**: (1) `groups.schemas.js` valida à mão, sem zod (AGENTS/spec pedem zod): conformidade, não segurança; (2) sem rate limit em `POST /grupos` (M8/moderação); (3) `display_name` do cadastro de conta tem o mesmo problema de caracteres invisíveis ("Cadastrado por …"), fora do diff, levar para PENDENCIAS; (4) homóglifos (cirílico) e nomes que diferem só no acento seguem aceitos (unicidade só por caixa; slug ganha `-2`); (5) `/api/grupos` (M7) deve remover `owner_id` junto com `contact`; (6) conta excluída entre carregar o usuário e o INSERT dá FK `23503` → 500, corrida improvável; (7) QA: 360 px, nome de 50 caracteres sem espaço no card, verificação visual.

## QA
Veredito: **REPROVADO** (volta ao Coder, volta 1 de 2). Relatório: [`docs/qa/013-cadastrar-grupo.md`](../qa/013-cadastrar-grupo.md). `npm test` 782/782, `npm run lint` ok, migration idempotente.
- **Passaram**: CA1–CA11 e CA13 (curl e Playwright), incluindo fluxo sem JS (POST + 303), rotas protegidas e escape de `<script>` no nome. CA7 e CA9 não foram reverificados à mão (confiou nos testes do Coder).
- **Bloqueio (CA12)**: nome de 50 caracteres sem espaço causa scroll horizontal a 360 px. Em `/grupos/<slug>?criado=1` o `scrollWidth` é 656 (`.success`, `p` e `.choice-row` passam de 360). No card de `/grupos?zona=sul` é 721 (o `<a>` do nome). Sem estouro em `/grupos/novo` (com e sem erros), detalhe, `/mapa/<slug>` e `/grupos?zona=leste`.
- **Correção sugerida**: `overflow-wrap: anywhere` e `min-width: 0` nos contêineres flex/grid no título do card e em `.success`.
- **Ambiente**: sem Docker (`db:up` falhou; usou o Postgres local); Playwright do projeto é um link quebrado (usou `/opt/node-tools`); sem comparação pixel a pixel com o protótipo.

## Coder (volta 1 de 2)
`npm test` 785 ok (eram 782), `npm run lint` ok. Só CSS + 1 teste; Cleaner e Hardener dispensados.
- **Correção do CA12**: nome de 50 caracteres sem espaço não estoura mais 360 px. Em `public/css/app.css`, fora do bloco literal do protótipo (antes do marcador "Layout"): `.card{min-width:0}`, `.card h3,.success{overflow-wrap:anywhere}`, `.success{min-width:0}`. Editar o bloco literal quebra `tests/http/scaffold.test.js`.
- **Teste**: `grupo-novo.test.js` ganhou `describe('CSS do nome longo a 360 px (CA12)')`, que confere as três regras fora do bloco literal.
- **Verificação a 360×800** (Playwright, nome de 50 caracteres sem espaço, zona sul): `scrollWidth` 360 em `/grupos/<slug>?criado=1`, `/grupos?zona=sul`, `/grupos`, `/grupos/novo` e `/`. Sem a correção: 623 / 721 / 721.
- **Ambiente**: Postgres local via `service postgresql start` (sem Docker); variáveis do `.env.example`.

## QA (volta 2 de 2)
Veredito: **APROVADO**. Relatório: [`docs/qa/013-cadastrar-grupo.md`](../qa/013-cadastrar-grupo.md). `npm test` 785/785, `npm run lint` ok, `npm run migrate` duas vezes sem erro, seed idempotente.
- **CA12 corrigido**: a 360×800, sem JS, com nome de 50 caracteres sem espaço, `scrollWidth` = 360 em `/grupos/<slug>?criado=1`, `/grupos?zona=sul`, `/grupos`, `/grupos/novo` (vazio e com 11 erros), `/`, `/mapa`, `/zonas` e `/encontrar`.
- **Demais critérios**: CA1–CA11 e CA13 seguem ✅ da rodada anterior; CA9 (slug) coberto só por testes unitários.
- **Regressão**: home, `/grupos` com filtro, detalhe demo, detalhe e `/mapa/<slug>` do grupo novo respondem 200; `/grupos/novo` deslogado redireciona para `/conta/entrar?next=%2Fgrupos%2Fnovo`.
- **Ambiente**: sem Docker (Postgres local via `service postgresql start`); 2 grupos não demo de rodadas anteriores ficaram no banco local.
