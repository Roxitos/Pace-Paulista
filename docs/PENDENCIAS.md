# Pendências por marco

Riscos aceitos, pendências e perguntas abertas levantadas pelo pipeline. **O Specifier lê este arquivo antes de cada spec** e incorpora (ou responde) os itens do marco. Ao resolver um item, marque `[x]` e cite a spec.

Origem: `001` = [relatório 001](reports/001-scaffold-base.md), `002` = [relatório 002](reports/002-home-estatica.md), `003` = [relatório 003](reports/003-banco-migrations-seed.md), `004` = [relatório 004](reports/004-leitura-banco-home-zonas.md), `005` = [relatório 005](reports/005-busca-filtros.md), `006` = [relatório 006](reports/006-detalhe-grupo.md), `007` = [relatório 007](reports/007-mapa-sobre.md), `008` = [relatório 008](reports/008-encontrar-compatibilidade.md), `010` = [relatório 010](reports/010-criar-conta.md), `016` = [relatório 016](reports/016-filtros-ao-vivo.md), `017` = [relatório 017](reports/017-modal-participar-toasts.md).

## Perguntas de produto em aberto
- [x] **M3** — Home sem grupos: qual texto/layout de "sem grupos" e estado vazio dos destaques? Hoje: pace omitido, "0 grupos cadastrados", zonas "0 grupos", destaques vazios. (002) — spec 004, P1: mantém o comportamento atual
- [x] **M3 (005)** — P2: botão "Aplicar filtros" no form sem JS; manter "Os resultados atualizam na hora." antes do M7? (004) — spec 005 seguiu o default (botão "Aplicar filtros", texto literal); confirmar o texto ou trocá-lo até o M7. (005) — spec 016, P3: texto mantido, agora verdadeiro com JS (QA aprovado)
- [ ] **M3+** — Sem JS, a URL após enviar o form leva campos vazios (`&local=&dia=…`). Redirecionar para a URL limpa? (005, QA)
- [x] **M3 (006)** — P6: texto do 404 de grupo ("Esse grupo não foi encontrado. Ele pode ter sido removido."); P7: manter "Confirmações por encontro dependem do banco de dados."? (004) — spec 006: defaults aceitos pelo usuário
- [ ] **Futuro** — Contato do grupo vira link (Instagram/site/e-mail) com validação de URL; hoje é texto puro (P4). (006, usuário)
- [ ] **M3+** — A 320 px todas as páginas têm 3 px de scroll horizontal (largura 323), já na HEAD; a meta do AGENTS é 360 px. Importa suportar 320 px? (006, QA) — causa: `button.menu-btn` do cabeçalho; em `/encontrar` o botão do form já cabe a 320. (008, QA)
- [ ] **M7** — `/encontrar` a ≤ 375 px: o botão "Mostrar grupos compatíveis" quebra em 2 linhas (lupa à esquerda, texto centralizado) para não estourar a largura (desvio do protótipo, que estourava). Preferem um rótulo mais curto em telas estreitas? (008, QA)
- [x] **M3 (007)** — P8: `/mapa/<slug inexistente>` → 404 (protótipo caía no padrão); P9: seleção padrão do mapa = primeiro da ordem (Cantareira Trail) ou fixar Correria do Carmo? (004) — spec 007: defaults aceitos pelo usuário (CA1, CA4)
- [ ] **M3+** — Rodapé diz sempre "Os grupos marcados como “Fictício · demo”…", mesmo sem demos publicados. Condicionar a `hasDemo` como o aviso da home? (004, QA)
- [ ] **M5** — (spec 010: P7 não bloquear na v1; risco de bidi/zero-width/personificação aceito) `display_name` fica público ("Cadastrado por …"); avisar no cadastro de conta. Bloquear nomes que imitem a marca (ex.: "Equipe Pace Paulista")? (004, Hardener)
- [ ] **M6/M9** — Destaques (`DESTAQUES`) buscados só pelo slug: se os demos saírem, quem cadastrar "Pace da Oca" vai para a home. Restringir a `is_demo`/curadoria ou reservar os slugs? (004, Hardener)
- [ ] **M3+** — Corrigir "Selo da Centro" → "Selo do Centro"? (texto literal do protótipo; também "Outros grupos da Centro" — P11; e o motivo "Fica na Centro" do `/encontrar` — spec 008, P4) (002, 004, 008)
- [x] **M4 (008)** — P1: `/encontrar` só GET com query string (sem POST/CSRF); P2: subtítulo "…Nada é salvo."; P3: empate pela ordem de criação (`g.id`); P4/P5: textos e `inputmode` literais do protótipo. — spec 008: defaults aceitos pelo usuário; AGENTS §3/§5/§6 atualizados
- [ ] **M5/M6** — 4xx que não são 404 (400/413) usam a página genérica "Algo deu errado" mantendo o status. Querem texto próprio? (001)
- [ ] **M6/M9** — Trazer "dono edita o próprio grupo" para a v1? Hoje está no roadmap (CLAUDE.md §12), mas sem isso os dados de grupos reais ficam desatualizados (horário/local mudam). (conteúdo)
- [ ] **M6/M9** — Moderação: grupo novo nasce `pending` já no lançamento (evita spam) ou continua `published` como na v1? (conteúdo)

## M2 — Banco
- [x] CHECKs garantem `zone`, `level`, `days` (`cardinality(days) >= 1`), `start_time` e pace 180–720 inteiro; hoje zona/nível desconhecido em destaque → 500 de propósito, `days` vazio → " · 6h". (002) — spec 003, CA7
- [x] Validar `DATABASE_URL` e exigir `SESSION_SECRET` forte em produção no `env.js`. (001) — spec 003, CA11
- [x] Seed reaproveita `db/seeds/demo-groups.js`. (002) — spec 003, CA4/CA5
- [x] Docker Desktop instalado mas ainda não inicializado na máquina (abrir o app, aceitar termos, talvez WSL2 + reinício). — `docker info` responde; spec 003, CA1

## M3 — Leitura
- [x] SQL parametrizado; `ILIKE` com `%` e `_` escapados (005). `23505`/`23514` e `tx()` só existem com escrita → movidos para o M6 (spec 004). (001) — spec 005, CA5/CA9
- [x] `src/` deixa de importar `db/seeds/demo-groups.js` e passa a ler do banco. (002) — spec 004, CA2
- [x] Formato de `PACE_FAIXAS` diverge: AGENTS.md `[min,max]` × protótipo `{nome,min,max}` — spec 005 decide `{nome,min,max}`. (Specifier 001, 004) — spec 005
- [x] Atualizar CLAUDE.md **e** AGENTS.md: §6 `PACE_FAIXAS` `{nome,min,max}`; §3 `filters.js` normaliza a query (o `WHERE` fica no repo) e novo partial `filter-options`; §8 checkboxes de zona no lugar de `aria-pressed` (P3). (005) — atualizados com OK do usuário
- [x] Slugs continuam `[a-z0-9-]` (já há `encodeURIComponent` nos links). Não há CHECK em `groups.slug`; 006 valida o formato na rota. (002, 004) — spec 006, CA3: `^[a-z0-9-]{1,60}$` na rota, 404 sem consultar o banco
- [x] `pg` devolve BIGINT como string (`id`) e `start_time` como `'06:30:00'` — tratar no repo/views (`fmtHora` já aceita `HH:MM:SS`). (003) — spec 004, CA6: `id` não sai do repo; `to_char(…,'HH24:MI')`
- [x] A partir do M3, `npm run dev` passa a precisar do Postgres de pé; documentar no README. (003) — spec 004
- [x] Exibição do `contact` na página do grupo, inclusive quando NULL (demos). (003) — decidido (P4, usuário): **deslogado não vê**; linha "Contato" no fim da "Ficha do treino", texto puro, oculta quando vazia. Ajustar spec 006; exibição para logado entra no M5. — spec 006, CA4: serviço zera `contact` sem `viewer` e a view exige `locals.user`; reconfirmado pelo usuário em 2026-11-11
- [x] Spec 005: toggles de zona viram checkboxes com o mesmo visual (P3 aprovado pelo usuário). (004) — spec 005, CA7
- [x] Sem JS, ≤ 900 px: "Filtros" rola até `#filters` e o título/"Limpar filtros" ficam ~70 px atrás do cabeçalho fixo (toque acerta `/meus`). (005, QA) — spec 005: `.filters{scroll-margin-top:84px}` (a safe-area já vem do `scroll-padding-top` do `html`), reverificado pelo QA
- [x] Regras CSS `[aria-pressed]` dos toggles de zona ficaram órfãs em `app.css` (cópia literal do protótipo); remover ou reaproveitar no M7. (005) — spec 018: mantidas (trecho copiado do protótipo, testado byte a byte; o mapa usa `aria-current`)
- [x] Spec 007: `/sobre` mantém o título "Status do protótipo" (P10, usuário); banco ATIVO, login PENDENTE, item "navegador" removido. (004) — spec 007, CA7
- [x] `/sobre`: atualizar a lista de status a cada marco (login vira ATIVO no M5 (feito na spec 011); compatibilidade/cadastro, citados no 1º ATIVO, só existem no M4/M6). (007) — compatibilidade passou a existir com a spec 008; falta cadastro (M6); login feito na spec 011. (008) — resolvida na spec 015: cadastro e entrada em grupos existem, texto do 1º ATIVO passa a valer.

## M4 — Compatibilidade
- O item "zod no cadastro de grupo" que estava aqui é do cadastro (`POST /grupos`) e foi para o M6 (spec 008).
- [x] `/encontrar` com `calcMatch` no servidor e mesmos resultados do protótipo para as mesmas respostas. — spec 008, CA1: QA comparou 6.183.630 combinações com o código extraído do protótipo, 0 divergências. **M4 concluído.**

## M5 — Contas
- [x] **M5 concluído (specs 009–012, QA aprovado)** — — respostas do usuário e perguntas abertas em `docs/reports/009-sessao-csrf-requireauth.md`: abertas **P4/P8** (textos de criar conta, entrar e sair) e **P11** (texto da confirmação de exclusão); **P2** pede ajustar a spec 009 (mensagem "Sua sessão expirou…" + botão "Atualizar e tentar de novo"). Exclusão de conta passa do M6 para o M5 (atualizar `MILESTONES.md`).
- [x] CSRF, sessão, cookies (`httpOnly`, `sameSite=lax`, `secure`) e `requireAuth` — spec 009 (QA aprovado).
- [x] `req.session.regenerate()` no login e no cadastro — specs 010/011. (001) — cadastro (010) e login (011) feitos, QA aprovado.
- [x] `?next=` só caminhos internos (`/…`, nunca `//…`): `safeNext` em `domain/redirect.js` — spec 009. A home já gera `/conta/entrar?next=/grupos/<slug>%23participar`. (001, 002)
- [x] Rate limit em `/conta/entrar` e `/conta/criar`. (001) — `/conta/criar` feito na spec 010 (10/15 min por IP, QA aprovado); `/conta/entrar` feito na spec 011 (10/15 min por IP+e-mail, chave normalizada; QA aprovado).
- [x] Ao montar body-parser (spec 009: `limit: 16kb`): `limit` explícito em `express.urlencoded` (o `errorHandler` já trata 400/413). (001)
- [x] Excluir conta: cascata e sessão destruída. (001; resolvido na spec 012)
- [ ] Riscos aceitos da spec 012: helmet/`frame-ancestors` e `style` inline do 2º passo da exclusão dependem da CSP do M8; sem reautenticação por senha (P13); sessões de outros aparelhos ficam até 30 dias na tabela `session` sem efeito. (012, Hardener)
- [ ] Senha exige caractere especial, mas o AGENTS §6 pede só mínimo de 8 caracteres: alinhar regra e hint do form. (012, QA)
- [x] (spec 009: `grupo-detalhe.ejs` + CA5) Mostrar o contato do grupo só para logado (P4). (004) — a 006 já deixou pronto: a sessão só precisa preencher `res.locals.user`; o QA do M5 repete o CA4 da 006 com sessão real. (006)
- [x] (spec 009: `currentUser.js` e `csrf.js` enviam `private, no-store`) Página do grupo com contato para logado: responder com `Cache-Control: private` (ou `Vary: Cookie`) para um CDN/proxy não servir a versão com contato a deslogado. (006, Hardener)
- [x] `.trim()` no zod antes de `min()` em `display_name` (só espaços passa no CHECK). (004, Hardener) — spec 010
- [x] (spec 009) LGPD: nunca logar `err.detail` do pg (no `23505` vem `Key (email)=(…)`); registrar só `code`/`constraint`. (004, Hardener)
- [x] (spec 009) `connect-pg-simple` com `createTableIfMissing: false` (tabela vem da migration 005). (003)
- [x] (spec 009: dev usa segredo de dev; produção exige ≥ 32 caracteres e rejeita os de exemplo) `SESSION_SECRET=` vazio é aceito em dev/test; conferir quando o `express-session` entrar. (003)

- [ ] **Para a 011**: se o header ganhar form "Sair" com `csrfToken()`, a página de erro quebra quando o próprio middleware de sessão falha (ex.: banco fora com cookie presente): `csrfLocals` não roda e a resposta vira o texto "Erro interno.". O `errorHandler` precisa tratar. (009, Hardener)

- [x] **Deploy (M8) — ALTA** — `trust proxy`: sem ele, atrás de Render/Railway todos compartilham o IP do proxy e o limite de 10 cadastros/15 min vira global; valor errado permite falsificar IP via `X-Forwarded-For`. (010, Hardener) — spec 019.
- [ ] Rate limit de `/conta/criar` é em memória (zera ao reiniciar, não vale entre instâncias); CSRF roda antes do limiter (403 não conta); e-mail duplicado revela conta (aceito no AGENTS). Aceitos na v1. (010, Hardener)
- [x] `npm audit` não investigado. (010, Coder/Hardener) — spec 019: `npm audit --omit=dev` sem vulnerabilidades.
- [x] `/meus` deslogado redireciona para `/conta/entrar`, que só existe na spec 011 (404 até lá). (010, QA) — resolvido na spec 011

- [ ] **Pós-M5 (spec própria)** — E-mail de boas-vindas ao criar conta, com visual do site (HTML com CSS inline). Envio por SMTP/API de provedor configurável por env (`SMTP_*` ou chave da API), falha de envio não pode impedir o cadastro. Exige dependência nova justificada (ex.: `nodemailer`), atualizar AGENTS §1 (hoje "notificações/e-mail" é fora do escopo) e revisar LGPD (e-mail usado também para mensagem, não só login). Provedor ainda a escolher. (usuário, 2026-11-13) — 2026-11-17: adiado; o M10 entrega só recuperar senha. O envio será por API HTTP via `fetch` (sem `nodemailer`), reaproveitável aqui.
- [x] P4/P8 textos de conta aprovados; P11 "Tem certeza que deseja excluir?" com grupos publicados; P2 página própria de CSRF. — specs 009/010/011/012

## M6 — Escrita
- [x] zod no cadastro de grupo (`parsePace`, dias, horário) e `slug()` com geração/validação. (002; movido do M4 pela spec 008) — spec 013: validação em `groups.schemas.js` (à mão, sem zod — ver risco abaixo); `slug()` com sufixo `-2`, `-3`…
- [x] Tratar `23505`/`23514` e usar `tx()` em escritas múltiplas (movido do M3). (001, 004) — spec 013: `23505` (nome e slug) tratado no cadastro de grupo; `23514` não dispara (validação antes). `tx()` segue para escritas múltiplas futuras
- [x] `start_time = '24:00'` é aceito pelo Postgres e derruba `/` (e `/grupos`) via `fmtHora`: migration nova `CHECK (start_time < '24:00')` + zod `([01]\d|2[0-3]):[0-5]\d`. Corrige o item do M2 "CHECKs garantem start_time". (004, Hardener) — spec 013: migration 006 + validação `HH:MM` (0–23)
- [x] Participar/sair de grupo: `POST /grupos/:slug/participar` e `/sair` com PRG, flash e painel sem JS. (AGENTS §5) — spec 014 (QA aprovado, volta 2; CA11: apelido de 40 caracteres sem espaço em 360 px corrigido com CSS)
- [ ] ~~Rate limit em `participar`/`sair`~~ (feito, spec 019); quem já participa e envia o form inválido (aba antiga) recebe 422 sem erro visível; apelido só com caracteres invisíveis passa na validação; CA8 (sem próximo encontro) só por inspeção do template, sem teste com `nextSession: null`. (014, Hardener/QA) — rate limit resolvido na spec 019 (60/15 min por usuário); demais itens seguem abertos.
- [ ] Zod: deduplicar `days` ("Sáb, Sáb"); `.trim()` em `name`/`location`/`contact`/`apelido` antes do tamanho. (004, Hardener) — no `/encontrar`, `days = {seg,seg}` viraria "Treina segunda e segunda". (008, Hardener)
- [ ] Normalizar para NFC também na escrita (`name`, `location`): a busca normaliza a entrada, mas um nome gravado em NFD não seria achado. (005, Hardener)
- [x] `start_time = '24:00'` também derruba `/grupos` (cai em `periodo=noite` e em `fmtHora`), com ou sem filtro — mesma correção do item acima. (005, Hardener) — spec 013 (migration 006)
- [x] Registrar `/grupos/novo` antes de `/grupos/:slug`; reservar slugs `novo` e `zona`. (004, Specifier) — hoje `/grupos/novo` e `/grupos/zona` dão o 404 com a mensagem do grupo. (006) — spec 013: rota registrada antes de `/:slug`
- [x] `start_time = '24:00'` também derruba `/grupos/:slug` (`proximos`/`fmtHora`) — mesma correção dos itens acima. (006, Hardener) — e `/mapa/<slug>` desse grupo (e `/mapa` se ele for o 1º da lista) responde 500 pelo `fmtHora` do painel. (007, Hardener) — e `/encontrar` (`fmtHora` do card sempre; `periodoDe` do `calcMatch` quando há período). (008, Hardener) — spec 013 (migration 006)
- [ ] `groups.map_pin` sem CHECK: a view já ignora coordenadas fora do viewBox (0–400 × 0–380); se o pin passar a ser editável, criar migration com CHECK. (007, Hardener)
- [x] Cards de `/grupos` com nome de 50 caracteres sem espaço abrem scroll horizontal a 360 px (já na HEAD da 005): `overflow-wrap` no card ou limite no zod. (006, QA) — spec 013, CA12: `overflow-wrap:anywhere` + `min-width:0` (QA aprovado, volta 2)

## M7 — Melhorias de JS
- [ ] Testar em aparelho real (iPhone) o campo de pace com `inputmode="numeric"` (literal do protótipo): o teclado numérico pode não ter `:`, impedindo digitar "5:30". Vale para `/encontrar` (spec 008, P5) e para o cadastro do M6. (008)
- [x] `listPublished` devolve `contact` de todos os grupos (contrato `Group`): `GET /api/grupos` (e qualquer JSON enviado ao cliente) precisa remover `contact` para deslogado, senão o P4 vaza. (006, Hardener) — recomendação: separar `SELECT_LIST` sem `contact` (listagens) de `findPublishedBySlug` (mantém o campo) e ajustar o teste de contrato; o mapa já remove o campo no service. (007, Hardener) — spec 016: `/api/grupos` devolve só `{count, countText, query, chips, results}` (HTML dos partials), sem `contact`/`owner_id` (Hardener/QA)
- [x] Filtros ao vivo na `/grupos` (`filtros.js` + `GET /api/grupos`). — spec 016 (QA aprovado)
- [x] Modal "Entrar no grupo" (`participar.js`), toasts de sair/excluir/cadastrar e regressão do menu mobile e do contador de caracteres. — spec 017 (QA aprovado, CA1–CA12; P1–P5 com os defaults aceitos pelo usuário)
- [ ] Modal só existe na página do grupo (P1 da 017): os cards de `/grupos` levam a `/grupos/<slug>#participar`, que abre o modal ao carregar. Modal por cima da listagem exigiria rota nova + fetch; fica para depois, se fizer falta. (017)
- [ ] Spec 017, não verificado: handler de `pageshow` do botão "Entrando…" (o Voltar já traz a página renderizada de novo) e `inputmode` no iPhone. O teste do cliente (`tests/client/participar.test.js`, DOM falso) cobre só a montagem do modal, não trap de foco nem submit; esses ficam com o QA no navegador. (017, Hardener/QA)
- [x] `public/js/mapa.js`: selecionar no mapa sem recarregar (hoje cada clique recarrega `/mapa/<slug>`). (007) — spec 018 (QA aprovado)
- [ ] Sem `aria-current` no menu em `/encontrar` (`currentNav('/encontrar')` → `''`, como no protótipo, que não tem item de menu para a página). (008, Coder)
- [ ] No 1º carregamento, antes das webfontes chegarem, o cabeçalho e a âncora `#matchResults` ficam deslocados por um instante (fonte de fallback com outra métrica); vale para todas as âncoras do site. (008, QA)
- [x] Acessibilidade do mapa (vêm do protótipo): foco de teclado discreto nos pins não selecionados (anel `r=0`, só o ponto cresce) e alvo de toque de ~9 px a 360 px (WCAG 2.5.8 pede 24 px). (007, QA) — spec 018: `circle.hit r=17` (alvo 24,6 px a 360 px) e anel de foco contínuo nos pins (QA aprovado)

## M8 — Produção
- [x] Decisão (usuário, 2026-11-17): deploy no **Render** (Web Service Node) e banco no **Neon** (Postgres gerenciado). Meta: produção na quarta 25/11.
- [ ] Neon: `DATABASE_URL` exige `sslmode=require`; usar a conexão **direta** (sem `-pooler`) no `npm run migrate` por causa do `pg_advisory_lock` (o pooler em modo transação não o mantém) e conferir se a app deve usar a conexão com pooler (limite de conexões do `pg.Pool`). Conferir `CREATE EXTENSION citext` no Neon e que `connect-pg-simple` cria a tabela `session`. Branch do Neon para staging (barato) em vez de segundo projeto. (usuário)
- [ ] Render: `render.yaml` (build `npm ci`, start `npm start`, `preDeployCommand: npm run migrate`, healthcheck, `NODE_ENV=production`, `SESSION_SECRET` gerado, `TZ_APP`); `trust proxy` = 1 (Render coloca um proxy na frente); free tier hiberna e cold start de ~50 s: decidir plano. (usuário)
- [x] `app.set('trust proxy', 1)` junto com o cookie `secure`: sem isso, atrás do proxy do Render/Railway o cookie não é enviado. Decidir antes do rate limit por IP da 010/011 (valor errado deixa o IP ser falsificado via `X-Forwarded-For`). (009, Hardener) — spec 019 (`TRUST_PROXY`).
- [x] helmet + CSP (`self`, fonts.googleapis.com, fonts.gstatic.com). `style="--z:…"`, `style="font-size:14px"` e o `extra` do 404/500 exigem `style-src-attr 'unsafe-inline'` ou classes CSS. (001, 002) — spec 019 (`style-src-attr 'unsafe-inline'`).
- [ ] Não publicar antes de M3/M5: links da home levam a 404. (002) — `/encontrar` deixou de ser um deles (spec 008); "Entrar no grupo" dos cards de `/encontrar` leva a `/conta/entrar` (404 até o M5). (008, QA)
- [x] Seed dos grupos demo **não roda** com `NODE_ENV=production` (ou demos removidos/despublicados antes de abrir o site). O aviso "Versão de demonstração" some sozinho quando não houver demo publicado (`hasDemo`). (conteúdo) — spec 003, CA6
- [x] (decidido pelo usuário, 2026-11-17) Produção na quarta 25/11 sobe **com demos**: flag explícita `ALLOW_DEMO_SEED=1` no seed e aviso "Versão de demonstração" mantido. — spec 019. (antes: ambiente publicado com grupos demo antes do M9?)
- [ ] Release exige `DATABASE_URL` e `SESSION_SECRET` ≥ 32 caracteres; conferir extensão `citext` no Postgres gerenciado. (003)
- [ ] `pg_advisory_lock` do migrate espera sem limite se outro migrate travar segurando o lock — avaliar `lock_timeout` no release. (003)
- [ ] `ensureTestDb` não trava host remoto (um banco remoto `*_test` passaria); decidir junto com o CI (service container). (003) — CI criado em `.github/workflows/ci.yml` com service container em `localhost`; a trava de host continua em aberto.
- [ ] Healthcheck `pg_isready` sem `-h` pode responder "healthy" durante o init do volume; avaliar `-h 127.0.0.1`. (003, QA)
- [x] Pool da app sem `statement_timeout`: lock longo em `groups` (ex.: migration travada) pendura `/` e `/zonas` até 300 s. Avaliar só no pool da app (`createPool` também serve migrate/seed). (004, Hardener) — spec 019 (5 s só no pool da app).
- [x] Favicon ausente → 404 no console (desde 001). (004, QA) — spec 019.
- [x] `/grupos` sem rate limit nem cache: cada GET faz consulta completa (entrada limitada pelo Node, 431, e pelos 1000 pares do querystring). Agrava o pool sem `statement_timeout`. (005, Hardener) — idem `/encontrar`: cada busca válida carrega todos os grupos publicados com `COUNT` das participações (aceito pela spec 008). (008, Hardener) — spec 019 (120/min por IP em `/grupos` e `/encontrar`).
- [ ] `ESCAPE '\'` depende de `standard_conforming_strings=on` (padrão desde PG 9.1); conferir no Postgres de produção ou trocar por `ESCAPE E'\\'`. (005, Hardener)
- [ ] Deploy automático a cada push na `main` com `npm run migrate` no release. Dados não exigem deploy: SSR lê o banco a cada request. (conteúdo)

## M9 — Conteúdo real (manter os grupos atualizados)
Estratégia para trocar os grupos fictícios por reais e mantê-los em dia depois do lançamento. Itens que tocam o escopo da v1 dependem das perguntas de produto acima.
- [ ] **Curadoria inicial**: levantar grupos reais de SP (Instagram, assessorias, clubes Strava), pedir autorização aos organizadores e cadastrar com `is_demo = false` (seed próprio, ex.: `db/seeds/real-groups.js`, ou cadastro via admin). Sem scraping (viola termos das plataformas).
- [ ] **Cadastro pelo organizador** (`/grupos/novo`, M6) como principal fonte de crescimento.
- [ ] **Reivindicar grupo** ("Sou o organizador"): organizador assume um grupo curado (`owner_id = NULL`) e vira dono. Definir como validar (ex.: contato pelo canal público do grupo + aprovação admin).
- [ ] **Edição pelo dono** (ver pergunta de produto).
- [ ] **Validade dos dados**: nova migration com `last_confirmed_at TIMESTAMPTZ`; job periódico (cron do provedor ou `node-cron`) — 90 dias sem confirmação → pedir ao dono para confirmar; 120 dias → selo "não confirmado recentemente" ou sair da busca. Exige canal de aviso ao dono (e-mail está fora da v1 — decidir).
- [ ] **"Informar problema"** na página do grupo (grupo acabou, horário mudou), com fila para admin.
- [ ] **Moderação** usando a coluna `status` já existente + página `/admin` (ver pergunta de produto).

## Spec 023 — Nome e apelido do participante (antes do M10)
- [ ] Pedido do usuário (2026-11-17): hoje apelidos podem se repetir (não há unicidade em `memberships.nickname` nem em `users.display_name`). Em vez de unicidade, o usuário quer **dois campos**: "Nome completo" e "Apelido (opcional)"; nos grupos aparece o **nome completo por padrão** e o apelido só se a pessoa preencher. Spec separada da 022.
- [x] Onde ficam os campos (usuário, 2026-11-17): o **cadastro da conta** pede **Nome completo, E-mail e Senha** (hoje: "Nome de exibição", e-mail, senha). Leitura do orquestrador, a confirmar na spec: "Nome completo" substitui o "Nome de exibição" (`users.display_name`), e o apelido continua no form "Entrar no grupo", agora **opcional**; vazio → usa o nome completo. Confirmado pelo usuário (2026-11-17): o campo do "Entrar no grupo" fica como **"Como gostaria de ser chamado?"** (hoje "Como o grupo pode te chamar? *"), opcional; **vazio = nome completo**.
- [ ] Contas já existentes: o `display_name` atual passa a valer como nome completo (sem pedir de novo)? Limite de 40 caracteres do `display_name` (CHECK no banco) basta para nome completo ou precisa de migration (ex.: 80)?
- [ ] "Cadastrado por {display_name}" passa a mostrar o nome completo publicamente: manter, ou mostrar só o primeiro nome?
- [ ] "Aparece nos grupos": hoje nenhuma tela lista os participantes de um grupo; o apelido só aparece no flash "Bem-vindo(a), {apelido}!". Criar uma lista de participantes faz parte da 023?
- [ ] LGPD (AGENTS §9 pede dados mínimos): nome completo é dado pessoal a mais e, se exibido, fica público. Confirmar finalidade, texto de `/sobre` e se o padrão deve mesmo ser o nome completo (e não o apelido).

## M10 — Recuperar senha por e-mail (atual, antes do M9)
- [x] Decisão (usuário, 2026-11-17): escopo é **só recuperar senha**; boas-vindas, confirmação de e-mail e avisos ao dono ficam para depois. Envio por **API HTTP** do provedor com `fetch` nativo (o Render Free bloqueia SMTP). Regras-base em AGENTS §5, §6 "Recuperar senha" e §9.
- [ ] **Provedor**: qual (Resend, Brevo…)? Conferir plano grátis, limite diário e termos no dia.
- [ ] **Remetente/domínio**: os provedores exigem domínio verificado (DNS) para enviar a qualquer destinatário; `onrender.com` não é nosso. Comprar um domínio, usar remetente único verificado (pior entrega: DMARC de Gmail/Hotmail) ou outra saída? Bloqueia o QA em produção.
- [ ] Validade do token (proposta 1 h), limites (proposta 5 / 15 min por IP e por e-mail) e textos das mensagens: confirmar na spec.
- [ ] Depois de redefinir: só encerrar as sessões e mandar para o login (proposta) ou já entrar logado?
- [ ] LGPD: o e-mail passa a ser usado também para mensagens (não só login) e é enviado a um operador (o provedor). Atualizar o texto de `/sobre`/rodapé?
- [ ] Limpeza dos tokens expirados/usados: no próprio fluxo (DELETE ao gerar) ou job? Sem job no plano Free.

## Riscos aceitos
- (spec 019, Hardener/QA) Riscos aceitos: 429 em `POST /grupos` perde o formulário preenchido (P2); rate limit em memória (zera a cada deploy); `style-src-attr 'unsafe-inline'` (Safari < 15.4 não entende; P3); `sslmode=require` sem `uselibpqcompat` já vale como verify-full no pg atual, recomendar `verify-full` no Neon; `TRUST_PROXY=0` atrás de proxy gera aviso do `express-rate-limit`. Para a **spec 020**: pooler do Neon x `statement_timeout` como parâmetro de conexão. QA: home sem JS com scroll horizontal (+15 px a 360 px) por `.hdr-actions`, já existia no HEAD; contador de caracteres de `/grupos/novo` e 2º passo da exclusão em `/meus` sem checagem no navegador. Docs com OK pendente: AGENTS §3, §9 e §10. (019)
- (spec 018, Hardener/QA) `GET /api/mapa/:slug` sem rate limit, helmet nem `nosniff` (spec 019); `loadMapPanel` lê toda a lista de publicados por chamada; cliente não confere `data.slug` da resposta; numa falha, pin/lista mudam antes do `location.assign` (visual, bfcache); a 360 px a largura chega a 375 antes das webfontes (igual em `/grupos`). (018)
- (spec 017, Hardener) `style="…"` vindo do servidor (painel `#participar`, tela de sucesso do cadastro e demais views) segue incompatível com CSP estrita: resolver no M8 (helmet/CSP). Sem rate limit nos toasts/`data-toast` (só texto do servidor, escapado pelo EJS; `app.js` lê por `textContent`). (017)
- (spec 013, Hardener) `groups.schemas.js` valida à mão, sem zod (AGENTS/spec pedem zod): conformidade, não segurança. Sem rate limit em `POST /grupos` (M8/moderação). `display_name` da conta aceita caracteres invisíveis (aparece em "Cadastrado por …"). Homóglifos e nomes que diferem só no acento são aceitos (slug ganha `-2`). Conta excluída entre carregar o usuário e o INSERT dá FK `23503` → 500 (corrida improvável). `/api/grupos` (M7) deve remover `owner_id` junto com `contact`. `inputmode` do pace do cadastro: testar em iPhone (M7). (013)
- `npm audit`: 4 moderados (GHSA-g3hv-75wg-m249, minimatch via eslint 10), só devDependencies; `--omit=dev` = 0. Reavaliar quando sair eslint 10.x corrigido. (001)
- `throw null` / `next(null)` → Express trata como "sem erro" e responde 404. (001)
- `.prettierignore` com `*.md` e `.claude/` além da spec. (001)
- Postgres de dev publicado em `127.0.0.1:5432` em vez do `5432:5432` literal da spec (mais seguro; mesma porta). (003, Hardener)
- Advisory lock do migrate com chave fixa `20261111` (só colide com outro software usando a mesma chave no mesmo banco). (003)
- Migration nova com número menor que uma já aplicada é aplicada fora de ordem, sem erro. (003)
- Com `PORT`/`NODE_ENV` inválidos, erros de banco/segredo só aparecem na execução seguinte; em produção, 32 espaços passam como segredo. (003)
- Com o Postgres parado, `afterAll` de `pool.test.js`/`migrate.test.js` acrescenta `ECONNREFUSED` cru após a mensagem certa; `migrate` em produção com env inválido mostra stack (sem valores); erros de senha/banco inexistente na CLI não citam o alvo. (003, QA)
- `listPublished` sem LIMIT nem cache: consulta completa a cada GET em `/` e `/zonas`; rever com paginação (005) ou M8/M9 (consulta agregada para `/zonas`). (004)
- `errorHandler` faz `console.error(err)` bruto (host/porta do banco, nunca senha); só log. (004)
- Ordem dos locais em `/zonas` depende da collation de `citext` (desempate por slug). (004)
- `tests/http` exige Postgres (exceto `banco-indisponivel.test.js`); `testTimeout`/`hookTimeout` 30 s por causa do Docker no Windows. (004)
- QA em worktree usa o Postgres do checkout principal; `db:up` no worktree disputaria a porta 5432 — fixar `name:` no `docker-compose.yml`? (004, QA)
- Busca não ignora acentos (`pelotao` não acha "Pelotão"), igual ao protótipo; caracteres invisíveis (U+200B) não são removidos pelo `trim()` — só geram 0 resultados e chip "Nome: " aparentemente vazio. (005)
- `activeChips` e `buildWhere` assumem a saída de `parseFilters`; um chamador interno com `null` ou zona fora de `ZONAS` derruba a requisição (hoje o único chamador é `searchGroups`). (005)
- Valor repetido usa o primeiro (`?dia=xyz&dia=sab` fica sem filtro de dia), conforme a spec. (005)
- `:has()` exige navegador ≥ 2023; sem ele o filtro funciona, só some o destaque da zona marcada. Em ≤ 900 px o painel de filtros volta fechado após "Aplicar filtros". (005)
- Ordem dos cards em `/grupos` = zona + nome (AGENTS §6), diferente do array `DEMO` do protótipo — intencional, não "corrigir". (005, QA)
- `proximos` num horário que o relógio pula (se o horário de verão voltar, 0h–1h em SP) cai no dia anterior; `fmtEncontro` exige ICU completo (padrão no Node 22; teste pega small-icu). (006, Hardener)
- Encontros da página do grupo em ≤ 560 px: pace desce para baixo do texto (2 colunas) — desvio intencional do protótipo aprovado pelo usuário; acima disso igual ao protótipo. (006, QA)
- Ambiente local roda Node 24; AGENTS pede 22 (CI usa 22). (006, QA)
- Em 404 sob `/grupos/...` (ex.: `/grupos/zona/marte`) o header marca "Encontrar grupos" com `aria-current` (`currentNav` usa `startsWith('/grupos/')`). Cosmético. (005, Hardener)
- `/encontrar` ecoa o pace como digitado (escapado), sem limite próprio de tamanho; o teto é o limite de cabeçalho do Node (431). (008, Hardener)
- Com mais de 1000 pares na query, o excedente é descartado e respostas podem "sumir" (422 ou form vazio), como na `/grupos`. (008, Hardener)
- `tests/domain/match-prototipo.test.js` usa grade reduzida (subconjuntos de dias de tamanho 1, 2 e 7) por tempo; a grade completa foi rodada uma vez pelo QA da 008 (0 divergências). (008)
- Com erro de validação, `/encontrar` responde 422 mesmo com o banco fora (não consulta). (008, Coder)
- POST em rota inexistente sem token CSRF responde 403 "Sessão expirada"; com token válido, 404. CSRF fica antes das rotas de propósito: nenhum POST futuro fica sem proteção por esquecimento. (009, Hardener)
- csrf-sync compara o token com `===` (sem tempo constante); risco baixo, token de 128 bytes aleatórios por sessão. (009, Hardener)
- `isPgError` ("code" de 5 caracteres) também casa erros do Node (EPIPE, EPERM): só deixa o log menos detalhado. (009, Hardener)
- Página pública anônima pode ir para cache sem `Vary: Cookie`; um logado pode receber a versão sem contato (funcional, não segurança). (009, Hardener)
- [ ] (spec 011, Hardener/QA) `trust proxy` também afeta o limite de `/conta/entrar` (global atrás de proxy, permite travar o login de uma vítima); limiter em memória por processo; chave IP+e-mail não segura credential stuffing nem ataque distribuído (decisão da spec); senha de exatamente 72 bytes aceita sufixo (bcrypt); `bcrypt.hashSync` no boot (~250 ms). Observação do QA: medição única de 375 px sem JS em `/conta/entrar` não reproduziu.
- [ ] `/favicon.ico` devolve 404 (erro no console com JS ligado); adicionar favicon ou `<link rel="icon">`. (015, QA)
- [x] M7: o JSON de `/api/grupos` deve vir do repo, nunca de `res.locals` (`joinedSlugs`). Custo aceito: 1 consulta extra por página para logado (P8). (015, Hardener/QA) — spec 016: `joinedSlugs` só vem do middleware; nada serializa `res.locals`
- (spec 016, Hardener/QA) `/api/grupos` sem rate limit nem helmet/CSP/`nosniff` (M8); 500 da API volta em HTML e consome flash pendente (raro); `change` ao sair de "Nome"/"Local" repete a busca após o debounce e o esqueleto pisca (UX); QA não comparou screenshot com `docs/prototipo.html`. (016)
- (spec 020, QA aprovado) Pendentes só no deploy real: CA7–CA10, 429 da 121ª chamada em `/grupos` (CA11), CA12, CA13; confirmar `healthCheckPath`/`autoDeployTrigger`/região/env no build do plano Free; registrar cold start e 500 no 1º acesso após suspensão do Neon. (020)
- [x] Remover `GET /diag/ip` e `DIAG_IP` depois de descobrir o `TRUST_PROXY` (limite de 30/min contornável com `TRUST_PROXY` errado; teste "sem DIAG_IP" depende do env). (020) — spec 021 (`TRUST_PROXY=3`, conferido em 2026-11-17).
- (spec 021, Hardener/QA) Risco aceito: se o Render mudar o número de proxies, `TRUST_PROXY=3` fica errado (alto → IP falsificável; baixo → rate limit coletivo); só se detecta pelo procedimento do `docs/DEPLOY.md`. Doc com OK pendente: AGENTS §9/§10 e `.env.example` falam em "1 em produção" (o padrão do `env.js`); a produção usa 3. (021) — docs atualizados em 2026-11-17 (AGENTS §9/§10 e `.env.example` citam o 3 do Render).
