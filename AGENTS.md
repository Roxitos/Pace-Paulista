# Pace Paulista — contexto do projeto para agentes

> Este arquivo é a fonte de verdade para qualquer agente (Claude, Copilot, Cursor etc.) que trabalhar neste repositório.
> Leia inteiro antes de escrever código. Se algo aqui conflitar com o código, **pare e pergunte** em vez de adivinhar.
> O `.claude/CLAUDE.md` só importa este arquivo (`@../AGENTS.md`): edite aqui, não lá.

---

## 1. O que é o produto

**Pace Paulista** conecta corredores de São Paulo a grupos de corrida compatíveis com **zona da cidade, pace, dias/horário e nível**.

Slogan: *"Encontre seu grupo. Encontre seu ritmo."*

### Origem
O projeto nasceu como um **protótipo de página única** (HTML + CSS + JS puro, roteamento por `#hash`, dados em `localStorage`).
O arquivo original está em `docs/prototipo.html` e é a **referência visual e de comportamento**: layout, textos, cores, ícones SVG, selos das zonas, mensagens de erro e regras de negócio vêm de lá.

### Objetivo desta fase (v1)
Transformar o protótipo em um **site real, monolítico**, com:

1. **Banco de dados compartilhado** — todos os visitantes veem os mesmos grupos e participações.
2. **Login e contas** — cadastro/login por e-mail e senha; "Meus grupos" passa a ser vinculado à conta.

Todo o resto do protótipo (busca, filtros, detalhes, zonas, mapa esquemático, "Encontrar meu grupo", cadastro de grupo) deve continuar funcionando igual, agora persistido no servidor.

### Estado atual
- **v1 no ar desde 2026-11-17**: https://pace-paulista.onrender.com/ (Render Free + Neon Free; ver §10 e `docs/DEPLOY.md`).
- Marcos **M1–M8 concluídos** (specs 001–021). Produção roda **com os grupos demo** até o M9 (`ALLOW_DEMO_SEED=1`).
- **M11 — Mapa real** (spec 024, pedido do usuário em 2026-11-25; entrou antes do M10): aba "Mapa" com Leaflet + OpenStreetMap e o ponto de encontro de cada grupo.
- **Fase atual: M10 — Recuperar senha por e-mail** (decisão do usuário, 2026-11-17; vem antes do M9). Regras em §6 "Recuperar senha" e §9.

### Fora do escopo (não implementar sem pedido explícito)
- Moderação/aprovação de grupos (deixar só a coluna `status` preparada) — M9.
- Street View, satélite, geolocalização do visitante e busca de endereço no mapa. Marcar o ponto no cadastro de grupo é a spec 025 (até lá, grupo real novo fica sem pino).
- Notificações, confirmação de presença por encontro, chat.
- **Qualquer e-mail além da recuperação de senha**: boas-vindas, confirmação de e-mail, avisos ao dono do grupo (pendências em `docs/PENDENCIAS.md`).
- Login social (Google etc.).
- SPA/React. Este é um monólito com renderização no servidor.

---

## 2. Stack e decisões de arquitetura

| Camada | Escolha | Por quê |
|---|---|---|
| Runtime | **Node.js 22 LTS** | Reaproveita o JS do protótipo |
| Servidor web | **Express 5** | Simples, didático, padrão de mercado |
| Views | **EJS** (server-side rendering) + JS vanilla progressivo | Monólito: o HTML sai pronto do servidor; JS só melhora a experiência |
| Banco | **PostgreSQL 16** | Relacional, arrays, `citext`, CHECKs |
| Acesso ao banco | **`pg` (node-postgres) com SQL escrito à mão** | Objetivo de aprendizado é SQL. **Não usar ORM** (Prisma, Sequelize, TypeORM) |
| Migrations | Arquivos `.sql` numerados + script `scripts/migrate.js` | Sem mágica; tabela `schema_migrations` controla o que já rodou |
| Sessão | **`express-session` + `connect-pg-simple`** | Sessão em cookie httpOnly, guardada no Postgres |
| Senhas | **`bcrypt`** (cost 12) | |
| Validação | **`zod`** | Mesmo schema valida form e gera mensagens |
| Segurança | `helmet`, `express-rate-limit`, CSRF por token na sessão (`csrf-sync`) | |
| E-mail (M10) | **API HTTP do provedor via `fetch` nativo**, sem SDK nem `nodemailer` | O Render Free bloqueia SMTP (portas 25/465/587); `fetch` evita dependência nova. Provedor com plano grátis a escolher na spec (ex.: Resend, Brevo) |
| Mapa (M11) | **Leaflet 1.9.4** + tiles do OpenStreetMap | Mapa com ruas sem chave de API; servido do próprio site |
| Testes | **`vitest` + `supertest`** | |
| Dev | `docker compose` (Postgres), `node --watch`, `dotenv` | |
| Lint/format | ESLint + Prettier | |

**Módulos ES** (`"type": "module"` no `package.json`). Sem TypeScript na v1 (pode entrar depois).

### Princípio do monólito
Um único processo Node serve **páginas HTML, arquivos estáticos e (poucos) endpoints JSON**. Um único banco. Um único deploy.
A organização interna é **por módulo de domínio** (auth, groups, memberships, matching), cada um com camadas `routes → service → repo`:

- **routes**: lê `req`, valida com zod, chama service, renderiza view ou redireciona. Sem SQL aqui.
- **service**: regras de negócio. Sem `req`/`res` aqui.
- **repo**: SQL puro e parametrizado (`$1, $2`). Único lugar que fala com o banco.
- **domain/**: funções puras (pace, agenda, match, filtros). Sem I/O. 100% testáveis.

---

## 3. Estrutura de pastas

```
pace-paulista/
├── AGENTS.md                 ← este arquivo
├── .github/                  ← CI (lint + testes) e template de PR
├── .claude/                  ← CLAUDE.md (só importa o AGENTS.md), subagentes do pipeline e /pipeline
├── docs/
│   ├── prototipo.html        ← protótipo original (referência visual; não editar)
│   ├── CONVENTIONS.md        ← estilo de código, testes e git
│   ├── MILESTONES.md, PENDENCIAS.md, DEPLOY.md ← DEPLOY.md: passo a passo Render + Neon
│   └── specs/, reports/, qa/ ← saídas do pipeline, numeradas NNN-slug.md
├── docker-compose.yml        ← Postgres local
├── render.yaml               ← Blueprint do Render (Web Service Free; migrate e seed no build)
├── .env.example
├── package.json
├── scripts/
│   ├── cli.js                ← utilitários dos scripts: isMain(), mensagens de erro de conexão
│   ├── migrate.js            ← aplica db/migrations/*.sql em ordem (confere checksum; recusa host -pooler)
│   └── seed.js               ← insere os grupos de demonstração
├── db/
│   ├── docker-init/          ← cria o banco pace_paulista_test no 1º `db:up`
│   ├── migrations/
│   │   ├── 001_extensions.sql
│   │   ├── 002_users.sql
│   │   ├── 003_groups.sql
│   │   ├── 004_memberships.sql
│   │   ├── 005_sessions.sql
│   │   ├── 006_groups_start_time_check.sql
│   │   ├── 007_full_name_optional_nickname.sql
│   │   └── 008_groups_lat_lng.sql                ← próxima livre: 009 (M10)
│   └── seeds/
│       └── demo-groups.js
├── src/
│   ├── server.js             ← só faz app.listen e registra SIGTERM/SIGINT
│   ├── lifecycle.js          ← gracefulShutdown: fecha o servidor e o pool no deploy
│   ├── app.js                ← monta o Express (middlewares, rotas, /healthz, erros); exportado p/ testes
│   ├── config/env.js         ← lê e valida variáveis de ambiente (zod)
│   ├── db/pool.js            ← Pool do pg + helper tx(fn) para transações
│   ├── domain/
│   │   ├── constants.js      ← ZONAS, DIAS, NIVEIS, PERIODOS, PACE_FAIXAS (copiar do protótipo)
│   │   ├── pace.js           ← parsePace, fmtPace, fmtFaixa
│   │   ├── schedule.js       ← periodoDe, proximos (fuso America/Sao_Paulo), fmtHora, fmtDias*
│   │   ├── filters.js        ← normaliza a query string dos filtros e monta os chips (o WHERE fica no groups.repo)
│   │   ├── match.js          ← calcMatch (algoritmo de compatibilidade)
│   │   ├── map.js            ← ZPOLY, ZLABEL, ZCENTRO e pins do mapa esquemático
│   │   ├── redirect.js       ← valida o ?next= (só caminhos internos)
│   │   └── slug.js
│   ├── modules/
│   │   ├── account/          ← account.routes.js (/conta/*, /meus; usa o auth.service)
│   │   ├── auth/             ← auth.service.js, users.repo.js, auth.schemas.js (sem rotas próprias)
│   │   ├── groups/           ← groups.routes.js (inclui participar/sair), .service, .repo, .schemas
│   │   ├── memberships/      ← memberships.service.js, .repo.js, .schemas.js (rotas no groups.routes)
│   │   ├── matching/         ← matching.routes.js, matching.service.js, matching.schemas.js (usa domain/match.js)
│   │   ├── pages/            ← pages.routes.js, pages.service.js (home, zonas, mapa, sobre, /api/mapa/:slug)
│   │   └── email/            ← M10 (a criar): email.service.js — sendEmail() via fetch na API do provedor;
│   │                            em dev/teste, transporte em memória/console (ver §6 "Recuperar senha")
│   ├── middlewares/
│   │   ├── locals.js         ← res.locals.currentPath, flash, helpers de view
│   │   ├── session.js        ← express-session + connect-pg-simple
│   │   ├── csrf.js           ← csrf-sync; res.locals.csrfToken() (marca a resposta Cache-Control: private, no-store)
│   │   ├── currentUser.js    ← res.locals.user a partir da sessão (sem password_hash)
│   │   ├── joinedGroups.js   ← slugs dos grupos do usuário (cards e badge do cabeçalho)
│   │   ├── requireAuth.js    ← redireciona p/ /conta/entrar?next=...
│   │   ├── redirectIfAuthenticated.js ← páginas "só deslogado"
│   │   ├── securityHeaders.js ← helmet/CSP
│   │   ├── rateLimits.js     ← limites de leitura, API, cadastro de grupo e participar/sair
│   │   ├── notFound.js
│   │   └── errorHandler.js
│   └── views/
│       ├── helpers.js        ← P + ic() (ícones), SEAL + seal(), zstyle(), currentNav()
│       ├── layout.ejs
│       ├── partials/         ← header, footer, csrf, demo-tag, zone-chip, level-meter, group-card,
│       │                        page-head, track-deco, form-errors, filter-options, search-chips,
│       │                        search-results, match-card, map-detail
│       └── pages/            ← home, grupos, grupo-detalhe, zonas, mapa, encontrar, grupo-novo,
│                                meus, sobre, conta-entrar, conta-criar, csrf (sessão expirada), 404, 500
├── public/
│   ├── favicon.svg
│   ├── css/app.css           ← CSS do protótipo extraído (ver §8)
│   └── js/                   ← módulos ES, sem bundler
│       ├── ui.js             ← compartilhado: ic() (cópia do P), toast(), isPlainClick()
│       ├── app.js            ← todas as páginas: menu mobile, avisos do servidor → toast, contador de caracteres
│       ├── participar.js     ← modal "Entrar no grupo" (trap de foco, Esc)
│       ├── filtros.js        ← filtros ao vivo na /grupos (progressive enhancement)
│       ├── mapa.js           ← seleção de pin/lista (/api/mapa/:slug); monta o mapa real se o Leaflet carregar
│       └── mapa-real.js      ← Leaflet: tiles OSM, marcadores, flyTo (recebe o Leaflet por parâmetro)
└── tests/
    ├── domain/   ← funções puras, schemas, services com repo falso
    ├── db/       ← migrate, seed, schema, repos (banco de teste)
    ├── http/     ← supertest, um arquivo por fluxo/página
    ├── client/   ← JS do navegador
    ├── scripts/, server/, helpers/
```

---

## 4. Modelo de dados (PostgreSQL)

Convenções: nomes de tabelas/colunas em **inglês, snake_case**; valores de enum **em português** (iguais aos do protótipo, pois aparecem em URLs e formulários). Pace sempre em **segundos por km** (inteiro).

```sql
-- 001_extensions.sql
CREATE EXTENSION IF NOT EXISTS citext;

-- 002_users.sql
CREATE TABLE users (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email          CITEXT NOT NULL UNIQUE,
  password_hash  TEXT   NOT NULL,
  display_name   TEXT   NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 80), -- nome completo (spec 023)
  role           TEXT   NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 003_groups.sql
CREATE TABLE groups (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug               TEXT    NOT NULL UNIQUE,
  name               CITEXT  NOT NULL UNIQUE CHECK (char_length(name) BETWEEN 3 AND 50),
  zone               TEXT    NOT NULL CHECK (zone IN ('norte','oeste','centro','leste','sul')),
  location           TEXT    NOT NULL CHECK (char_length(location) BETWEEN 3 AND 80),
  meeting_point      TEXT    NOT NULL DEFAULT 'Combinado no grupo',
  days               TEXT[]  NOT NULL CHECK (cardinality(days) >= 1
                       AND days <@ ARRAY['seg','ter','qua','qui','sex','sab','dom']),
  start_time         TIME    NOT NULL,
  pace_min_s         INT     NOT NULL CHECK (pace_min_s BETWEEN 180 AND 720),
  pace_max_s         INT     NOT NULL CHECK (pace_max_s BETWEEN 180 AND 720),
  distance           TEXT,
  level              TEXT    NOT NULL CHECK (level IN ('iniciante','intermediario','avancado')),
  base_participants  INT     NOT NULL DEFAULT 1 CHECK (base_participants BETWEEN 1 AND 999),
  description        TEXT    NOT NULL CHECK (char_length(description) BETWEEN 30 AND 400),
  profile_tags       TEXT[]  NOT NULL DEFAULT ARRAY['Novo na plataforma'],
  contact            TEXT,   -- opcional: NULL nos grupos demo; o form de cadastro continua exigindo (spec 003)
  is_demo            BOOLEAN NOT NULL DEFAULT false,
  status             TEXT    NOT NULL DEFAULT 'published'
                       CHECK (status IN ('pending','published','rejected')), -- moderação: v2
  owner_id           BIGINT  REFERENCES users(id) ON DELETE SET NULL,     -- NULL nos grupos demo
  map_pin            INT[],  -- [x,y] no SVG esquemático (fallback sem JS); NULL = calcular pela zona
  lat                DOUBLE PRECISION, -- ponto de encontro no mapa real (008); lat e lng juntos ou NULL,
  lng                DOUBLE PRECISION, --   dentro da caixa de SP; NULL = grupo sem pino
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (pace_min_s < pace_max_s)
);
CREATE INDEX groups_zone_idx  ON groups (zone)  WHERE status = 'published';
CREATE INDEX groups_days_idx  ON groups USING GIN (days);

-- 004_memberships.sql
CREATE TABLE memberships (
  user_id    BIGINT NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  group_id   BIGINT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  nickname   TEXT   CHECK (char_length(nickname) BETWEEN 2 AND 40), -- NULL = nome completo da conta (spec 023)
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, group_id)
);
CREATE INDEX memberships_group_idx ON memberships (group_id);

-- 005_sessions.sql  → usar o schema oficial do connect-pg-simple (tabela "session")
-- 006_groups_start_time_check.sql → CHECK (start_time < '24:00'): TIME aceita '24:00:00'
-- 007_full_name_optional_nickname.sql → display_name até 80; memberships.nickname nullable

-- 008_groups_lat_lng.sql → lat/lng + CHECKs (par e caixa de SP) e coordenadas dos 11 demos (spec 024)

-- 009 (M10, proposta; a spec fecha os detalhes): tokens de recuperação de senha
CREATE TABLE password_resets (
  token_hash  TEXT        PRIMARY KEY,            -- SHA-256 do token; o token em claro só vai no e-mail
  user_id     BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX password_resets_user_idx ON password_resets (user_id);
```

### Regras derivadas
- **Participantes exibidos** = `base_participants + COUNT(memberships do grupo exceto a do dono)`. Calcular na query (subquery ou `LEFT JOIN ... GROUP BY`), nunca guardar o total.
- **Grupo público** = `status = 'published'`. Na v1 todo grupo novo já nasce `published`.
- **Dono do grupo** (`owner_id`) é quem cadastrou. Na v1 o dono **exclui** o próprio grupo pela UI (spec 022; participações caem em cascata) e **não edita** (v2). Grupos demo não são excluíveis. O dono **não entra** no próprio grupo: `base_participants` já o inclui.
- **Excluir conta** apaga o usuário → `memberships` caem em cascata, grupos dele ficam com `owner_id = NULL`.

---

## 5. Rotas

URLs reais (sem `#hash`). Todas em português, iguais às do protótipo onde possível.

### Páginas (GET, renderizam EJS)
| Rota | Auth | Página do protótipo | Observações |
|---|---|---|---|
| `/` | — | `PageHome` | Estatísticas vêm do banco (nº de grupos, faixa de pace min–max). Destaques: 3 slugs fixos em `constants.js` |
| `/grupos` | — | `PageGrupos` | Filtros via **query string**: `?zona=sul&zona=leste&nome=&local=&dia=&periodo=&pace=&nivel=`. Funciona sem JS |
| `/grupos/zona/:zona` | — | `#grupos-<zona>` | Redireciona 301 para `/grupos?zona=<zona>` |
| `/grupos/novo` | ✅ | `PageCadastrar` | |
| `/grupos/:slug` | — | `PageDetalhe` | 404 se não existir ou não estiver `published` |
| `/zonas` | — | `PageZonas` | |
| `/mapa` e `/mapa/:slug` | — | `PageMapa` | `:slug` pré-seleciona o grupo. Aba "Mapa" no menu. Com JS: mapa real (Leaflet/OSM); sem JS: esquema SVG |
| `/encontrar` | — | `PageEncontrar` | Formulário de compatibilidade via **query string** (GET, como `/grupos`; spec 008). Sem respostas → form vazio; respostas inválidas → 422 com o form preenchido; válidas → resultados calculados no servidor. Nada é salvo |
| `/meus` | ✅ | `PageMeus` | Grupos em que entrei + grupos que cadastrei + "Conta e dados" |
| `/sobre` | — | `PageSobre` | Atualizar "Status do protótipo": banco e login viram **ATIVO** |
| `/conta/entrar` | só deslogado | novo | Aceita `?next=/caminho` (validar: só caminhos internos começando com `/`) |
| `/conta/criar` | só deslogado | novo | |

### Ações (POST, padrão Post/Redirect/Get, todas com CSRF)
| Rota | Auth | O que faz |
|---|---|---|
| `POST /grupos` | ✅ | Cria grupo. Erro → re-renderiza o form com valores e mensagens (status 422). Sucesso → redirect `/grupos/:slug?criado=1` (tela de sucesso do protótipo) |
| `POST /grupos/:slug/participar` | ✅ | Body: `apelido`, `ok`. Idempotente (`ON CONFLICT DO NOTHING`); dono → 303 para a página do grupo, sem gravar |
| `POST /grupos/:slug/sair` | ✅ | Remove membership |
| `POST /grupos/:slug/excluir` | ✅ | Só o dono; grupo demo ou de outro → 404. Confirmação em 2 passos (`?excluir=1` na página do grupo, `?excluir-grupo=<slug>` em `/meus`). Sucesso → flash e redirect `/meus` |
| `POST /conta/criar` | — | Cria usuário, já loga, redirect `next` ou `/meus` |
| `POST /conta/entrar` | — | Rate limit: 10 tentativas / 15 min por IP+email |
| `POST /conta/sair` | ✅ | Destroi sessão (logout é sempre POST) |
| `POST /conta/excluir` | ✅ | Substitui o "Apagar meus dados deste navegador". Pede confirmação (mesma UI de 2 passos do protótipo) |

### Recuperar senha (M10 — nomes propostos; a spec confirma)
| Rota | Auth | O que faz |
|---|---|---|
| `GET /conta/recuperar` | só deslogado | Form com o e-mail. Link "Esqueci minha senha" em `/conta/entrar` |
| `POST /conta/recuperar` | só deslogado | Se a conta existir, gera token e envia o e-mail. **Sempre** a mesma resposta (PRG + flash), exista ou não a conta |
| `GET /conta/redefinir/:token` | só deslogado | Token válido → form de nova senha; inválido/expirado/usado → página de erro com link para pedir outro |
| `POST /conta/redefinir/:token` | só deslogado | Troca a senha, marca o token como usado, encerra as outras sessões do usuário, redirect `/conta/entrar` com flash |

### Infra e JSON
| Rota | Uso |
|---|---|
| `GET /healthz` | Healthcheck do Render. Não consulta o banco |
| `GET /api/grupos?<mesmos filtros>` | `public/js/filtros.js` atualiza resultados sem recarregar e faz `history.replaceState` com a query |
| `GET /api/mapa/:slug` | `public/js/mapa.js` troca o grupo selecionado no mapa sem recarregar |

Sem JS, o form de filtros faz GET normal em `/grupos` e tudo funciona.

### Fluxo "Entrar no grupo"
- Visitante **deslogado** clica "Entrar no grupo" → vai para `/conta/entrar?next=/grupos/<slug>%23participar`.
- **Logado** → abre o modal do protótipo (JS) com campo apelido pré-preenchido com `display_name`; sem JS, `/grupos/:slug#participar` mostra o mesmo form inline.
- Dono vê "Você organiza este grupo." no lugar do botão; sem painel/modal.
- Sucesso → flash "Bem-vindo(a), {apelido}!" + próximo treino, e redirect para a página do grupo.

---

## 6. Regras de negócio (portar exatamente do protótipo)

Todas as funções abaixo vão para `src/domain/` como **funções puras** e precisam de testes unitários.

### Constantes (`constants.js`)
```js
ZONAS = {
  norte:  { nome:'Zona Norte', curto:'Norte',  cor:'#5E9A22', on:'#FFFFFF', marco:'Serra da Cantareira' , desc:'…' },
  oeste:  { nome:'Zona Oeste', curto:'Oeste',  cor:'#7A3FA0', on:'#FFFFFF', marco:'Ponte Estaiada'      , desc:'…' },
  centro: { nome:'Centro',     curto:'Centro', cor:'#E8892B', on:'#17171A', marco:'Avenida Paulista'    , desc:'…' },
  leste:  { nome:'Zona Leste', curto:'Leste',  cor:'#C8402F', on:'#FFFFFF', marco:'Arena Corinthians'   , desc:'…' },
  sul:    { nome:'Zona Sul',   curto:'Sul',    cor:'#3A78C2', on:'#FFFFFF', marco:'Oca do Ibirapuera'   , desc:'…' },
}
ZONA_ORDEM = ['norte','oeste','centro','leste','sul']
DIA_ORDEM  = ['seg','ter','qua','qui','sex','sab','dom']
NIVEIS     = { iniciante:{nome:'Iniciante',n:1}, intermediario:{nome:'Intermediário',n:2}, avancado:{nome:'Avançado',n:3} }
PERIODOS   = { cedo:'Antes das 7h', manha:'Das 7h às 12h', tarde:'Das 12h às 18h', noite:'A partir das 18h' }
PACE_FAIXAS= { ate5:{nome:'Até 5:00 min/km',min:0,max:300}, '5a6':{nome:'5:00 a 6:00 min/km',min:300,max:360},
               '6a7':{nome:'6:00 a 7:00 min/km',min:360,max:420}, mais7:{nome:'Acima de 7:00 min/km',min:420,max:9999} }  // segundos; formato do protótipo (spec 005)
DESTAQUES  = ['correria-do-carmo','pace-da-oca','pelotao-paulista']
```
Textos `desc` das zonas, selos SVG (`SEAL`), ícones (`P`) e polígonos do mapa (`ZPOLY`, `ZLABEL`, `ZCENTRO`): **copiar literalmente de `docs/prototipo.html`**.

### Pace
- Entrada do usuário no formato `m:ss` (regex `^\d{1,2}:[0-5]\d$`), válida entre **3:00 e 12:00** (180–720 s).
- Exibição: `fmtPace(330) → "5:30"`; faixa: `"5:30–6:30 min/km"`.
- Cadastro: `pace_min_s < pace_max_s`, senão erro em `paceMax`: *"O pace mais lento precisa ser maior que o mais rápido."*

### Filtros da busca
- `zona`: lista (OR entre zonas). `nome` e `local`: `ILIKE '%termo%'` (escapar `%` e `_`). `dia`: `$1 = ANY(days)`.
- `periodo`: pela hora de `start_time` → `<7 cedo`, `<12 manha`, `<18 tarde`, senão `noite`.
- `pace`: grupos cuja faixa **cruza** a faixa escolhida: `pace_min_s < faixa.max AND pace_max_s > faixa.min`.
- `nivel`: igualdade.
- Ordenação padrão: zona (ordem `ZONA_ORDEM`), depois nome.

### Próximos encontros (`proximos(grupo, n=4)`)
- Próximas `n` datas nos próximos 28 dias cujo dia da semana está em `days`, no horário `start_time`, **depois de agora**.
- ⚠️ Calcular **no fuso `America/Sao_Paulo`**, não no fuso do servidor (servidores costumam rodar em UTC). Usar `Intl`/`Temporal` ou `date-fns-tz`.
- Formatação em `pt-BR`.

### Compatibilidade (`calcMatch(grupo, q)`) — `/encontrar`
Entrada `q = { zona | 'qualquer', pace (s), dias[], nivel, periodo? }`.

| Critério | Peso máx. | Pontos |
|---|---|---|
| Zona | 30 | 30 se `qualquer` ou igual (motivo "Fica na {zona}" só se não for `qualquer`) |
| Pace | 35 | 35 se dentro da faixa; senão distância à borda ≤ 30 s → 20; ≤ 60 s → 8 |
| Dias | 20 | 20 se houver ≥1 dia em comum ("Treina {dias}") |
| Nível | 15 | 15 se igual; diferença de 1 nível → 6 |
| Período | 10 | só conta (no máximo) se `q.periodo` foi informado; 10 se bate |

`pct = round(pontos / máximo * 100)`. Mostrar grupos com **pct ≥ 40**, ordenados desc, **no máximo 6**. Calcular em JS no servidor (dataset pequeno); não precisa ser SQL.

Detalhes do protótipo que a tabela acima não mostra (spec 008, que segue o protótipo): são **5 motivos** (um por critério que pontua no máximo; pace a até 60 s e nível vizinho pontuam sem motivo), "dentro da faixa" **inclui as bordas** (diferente do filtro de pace da `/grupos`) e o **empate** é desfeito pela ordem de criação (`ORDER BY g.id`, ordenação estável), como no protótipo.

### Cadastro de grupo — validações e mensagens
| Campo | Regra | Mensagem |
|---|---|---|
| nome | ≥ 3 chars, único (case-insensitive) | "Informe um nome com pelo menos 3 caracteres." / "Já existe um grupo com esse nome." |
| zona | obrigatório | "Escolha a zona do grupo." |
| local | ≥ 3 | "Informe o local de encontro." |
| dias | ≥ 1 | "Selecione pelo menos um dia." |
| horário | `HH:MM` | "Informe o horário do treino." |
| paceMin / paceMax | ver Pace | "Use o formato 5:30, entre 3:00 e 12:00." |
| nível | obrigatório | "Selecione o nível do grupo." |
| descrição | 30–400 | "A descrição precisa de pelo menos 30 caracteres (faltam N)." |
| contato | ≥ 3; canal do grupo, não telefone pessoal | "Informe um contato público do grupo." |
| organizador | checkbox marcado | "Confirme que você organiza o grupo." |
| participantes | opcional, 1–999 (default 1) | — |

- **Slug**: nome sem acentos, minúsculo, não-alfanuméricos → `-`, máx. 40 chars; se existir, sufixo `-2`, `-3`…
- Unicidade de nome **também** garantida pelo `UNIQUE` do banco: tratar erro `23505` e devolver a mesma mensagem.
- Topo do form: *"Corrija N campos para continuar."*; foco no primeiro campo com erro; `aria-invalid="true"`.

### Participar
- Apelido **opcional** (“Como gostaria de ser chamado?”); vazio = nome completo da conta (gravado como NULL); preenchido, 2–40 chars: «Use pelo menos 2 letras ou deixe em branco.». Não há lista de participantes: ninguém vê os integrantes de um grupo.
- Checkbox de orientações obrigatório: "Confirme que leu as orientações."

### Contas
- E-mail válido e único: "Já existe uma conta com esse e-mail."
- Nome completo (coluna `display_name`): espaços colapsados, 2–80 chars, **nome e sobrenome** (≥ 2 palavras, cada uma com ≥ 1 letra) só no cadastro: «Informe nome e sobrenome.». Contas antigas de uma palavra continuam válidas.
- Senha mínimo **8** caracteres. Nunca logar senha; nunca devolver `password_hash`.
- Login com erro genérico: "E-mail ou senha incorretos." (não revelar qual dos dois).
- `req.session.regenerate()` no login e no cadastro (evita fixação de sessão).

### Recuperar senha (M10)
- **Resposta neutra**: `POST /conta/recuperar` responde igual exista ou não a conta (mesma mensagem, mesmo redirect; não revelar cadastro). O envio não pode atrasar a resposta de forma que denuncie a conta.
- **Token**: 32 bytes de `crypto.randomBytes` em base64url; no banco só o **SHA-256** (`token_hash`). Validade curta (proposta: **1 h**), **uso único**. Pedir de novo invalida os tokens anteriores do usuário.
- **Nova senha**: mesmas regras do cadastro (mín. 8, bcrypt cost 12). Depois da troca: token marcado `used_at`, **todas as sessões do usuário apagadas** da tabela `session`, e o usuário entra de novo pelo login (não logar automaticamente — a spec pode mudar isto).
- **E-mail**: assunto e corpo em pt-BR, HTML simples com o visual do site (CSS inline) + versão texto. Link absoluto montado com `APP_URL` (nunca com o `Host` da requisição: evita envenenamento do link). Falha do provedor é logada (sem o token e sem o e-mail completo) e o usuário vê a mesma resposta neutra.
- **Envio**: `sendEmail({ to, subject, html, text })` no `modules/email`, via `fetch` na API do provedor, com timeout. Em dev/teste sem chave, transporte em memória (testes leem a mensagem enviada) ou console **só fora de produção**. Em produção a chave é obrigatória (`env.js` falha no boot sem ela).
- **Rate limit**: `POST /conta/recuperar` por IP **e** por e-mail (proposta: 5 / 15 min); `POST /conta/redefinir/:token` por IP.
- Mensagens (propostas; a spec fixa): "Se existir uma conta com esse e-mail, enviamos um link para criar uma nova senha." / "Esse link expirou ou já foi usado. Peça um novo."

---

## 7. Dados de demonstração (seed)

`scripts/seed.js` insere os 11 grupos fictícios do protótipo com `is_demo = true`, `owner_id = NULL`, `status = 'published'`. Deve ser **idempotente** (`ON CONFLICT (slug) DO NOTHING`). Descrições, `meeting_point`, `profile_tags` e `map_pin`: copiar do array `DEMO` em `docs/prototipo.html`.

| slug | nome | zona | local | dias | hora | pace | nível | part. |
|---|---|---|---|---|---|---|---|---|
| correria-do-carmo | Correria do Carmo | leste | Parque do Carmo | sab | 06:30 | 5:30–6:30 | intermediario | 48 |
| tiete-em-movimento | Tietê em Movimento | leste | Parque Ecológico do Tietê | ter, qui | 19:00 | 6:00–7:30 | iniciante | 31 |
| pelotao-paulista | Pelotão Paulista | centro | Avenida Paulista | dom | 07:00 | 4:45–5:45 | intermediario | 72 |
| minhocao-noturno | Minhocão Noturno | centro | Elevado Presidente João Goulart (Minhocão) | qua | 20:30 | 5:00–6:00 | intermediario | 39 |
| pace-da-oca | Pace da Oca | sul | Parque Ibirapuera | seg, qua, sex | 06:00 | 4:15–5:00 | avancado | 56 |
| primeiro-km-ibira | Primeiro Km Ibira | sul | Parque Ibirapuera | sab | 08:00 | 7:00–8:30 | iniciante | 64 |
| represa-run-club | Represa Run Club | sul | Parque Guarapiranga | dom | 07:30 | 5:30–6:45 | intermediario | 22 |
| villa-lobos-runners | Villa-Lobos Runners | oeste | Parque Villa-Lobos | ter, qui | 06:15 | 5:00–6:00 | intermediario | 45 |
| raia-usp | Raia Olímpica | oeste | Cidade Universitária (USP) | sab | 07:00 | 4:00–4:45 | avancado | 27 |
| cantareira-trail | Cantareira Trail | norte | Parque Estadual Alberto Löfgren (Horto Florestal) | dom | 07:00 | 6:30–8:00 | intermediario | 33 |
| juventude-em-pace | Juventude em Pace | norte | Parque da Juventude | ter, qui | 19:30 | 6:00–7:00 | iniciante | 41 |

A UI continua marcando grupos demo com a etiqueta **"Fictício · demo"** e o aviso "Versão de demonstração" na home enquanto existirem grupos demo publicados. Grupos reais mostram "Cadastrado por {nome completo}" (ou "Cadastrado por você" para o dono).

---

## 8. Design e front-end

- **Extrair o `<style>` do protótipo para `public/css/app.css` sem redesenhar.** O visual é parte do produto (tema "pista de atletismo": asfalto, raias, faixa vermelha, tracejados).
- Tokens em `:root` (não renomear): `--verde #5E9A22`, `--roxo`, `--laranja`, `--vermelho`, `--azul`, `--amarelo #E8B923`, `--pista #B3262E`, `--asfalto #17171A`, `--concreto #F7F4EC`, + tokens de superfície. Dark mode via `prefers-color-scheme` e `[data-theme]` já existe — manter.
- Fontes: Anton (display), Inter (texto), JetBrains Mono (números/pace), via Google Fonts.
- Cor da zona por elemento: `style="--z:<cor>;--zon:<on>"` (helper `zstyle(zona)` disponível nas views).
- Ícones: o objeto `P` + função `ic(nome, cls)` viram um helper de view (`partials/icons.ejs` ou função em `res.locals`).
- Os "componentes" JS do protótipo (`GroupCard`, `LevelMeter`, `ZoneChip`, `PageHead`, `TrackDeco`, `seal`) viram **partials EJS** com o mesmo HTML.
- **Escape**: sempre `<%= %>`. `<%- %>` só para partials e SVGs internos, **nunca** com dado vindo do usuário/banco.
- **Acessibilidade** (já presente no protótipo, manter): foco visível, `aria-current` na navegação, toggles de zona como checkboxes (`label.ztog` + `:has(input:checked)`, mesmo visual do protótipo, para funcionar sem JS — spec 005), `aria-live` na contagem de resultados, modal com trap de foco e `Esc`, `prefers-reduced-motion`.
- **Mapa** (spec 024): Leaflet 1.9.4 servido de `node_modules` em `/vendor/leaflet` (não 2.x); tiles do OSM com atribuição; o esquema SVG (`map_pin`, `ZPOLY`…) segue como fallback sem JS.
- JS do cliente é **progressivo**: toda ação precisa funcionar sem JS (forms normais). JS só adiciona modal, filtro ao vivo, toast, menu mobile.
- Mobile first: testar em 360 px de largura, sem scroll horizontal.

---

## 9. Segurança e LGPD

- Toda query **parametrizada**. Proibido concatenar input em SQL.
- CSRF em todo POST. Cookies de sessão: `httpOnly`, `sameSite=lax`, `secure` em produção, `maxAge` 30 dias.
- `helmet` com CSP permitindo apenas `self`, `fonts.googleapis.com`, `fonts.gstatic.com` e, em `img-src`, `tile.openstreetmap.org`. Sem scripts e handlers inline (mover `<script>` para `public/js`); única exceção: `style-src-attr 'unsafe-inline'`, porque as cores das zonas e `--p` vão em `style="…"`.
- Rate limit em `/conta/entrar` e `/conta/criar`; leitura (`/grupos`, `/encontrar`) 120/min por IP, API 300/min por IP, `POST /grupos` 20/h por usuário, participar/sair 60/15 min por usuário.
- `trust proxy` vem de `TRUST_PROXY` (número de proxies, nunca `true`). Padrão do `env.js` em produção: 1; **no Render o valor correto é 3** (conferido em 2026-11-17, procedimento em `docs/DEPLOY.md`).
- `img-src` inclui `https://tile.openstreetmap.org` (tiles do mapa; o navegador do visitante fala com o OSM, citado no `/sobre`); os tiles levam `referrerPolicy: strict-origin-when-cross-origin` e o cabeçalho global continua `same-origin`.
- Recuperar senha (M10): token só como hash no banco; nunca logar token, link nem corpo do e-mail; página de redefinir com `Cache-Control: no-store` e `Referrer-Policy: no-referrer` (o token está na URL); a chave da API de e-mail é segredo (painel do Render, nunca no git).
- `DATABASE_URL` de produção exige `sslmode` `require`, `verify-ca` ou `verify-full` (usar `verify-full`).
- `?next=` só aceita caminhos internos (começam com `/` e não com `//`).
- Dados pessoais mínimos: e-mail, nome completo (público só em “Cadastrado por …”), apelido opcional por grupo (visto só pela própria pessoa). Contato do grupo deve ser canal público do grupo (hint já existe no form).
- "Excluir minha conta" apaga de verdade (LGPD). Texto da página `/sobre` e do rodapé deve deixar de dizer "Nenhum dado é enviado a servidores".

---

## 10. Ambiente e comandos

`.env.example`:
```
NODE_ENV=development
PORT=3000
DATABASE_URL=postgres://pace:pace@localhost:5432/pace_paulista
DATABASE_URL_TEST=postgres://pace:pace@localhost:5432/pace_paulista_test
SESSION_SECRET=troque-por-uma-string-longa-e-aleatoria
TZ_APP=America/Sao_Paulo
# TRUST_PROXY=1        # nº de proxies; no Render é 3
# ALLOW_DEMO_SEED=1
# M10 (nomes propostos; a spec confirma):
# APP_URL=http://localhost:3000   # base dos links nos e-mails; produção: https://pace-paulista.onrender.com
# EMAIL_API_KEY=                  # obrigatória em produção; sem ela, dev/teste usam o transporte em memória
# EMAIL_FROM="Pace Paulista <nao-responda@...>"
```

Scripts esperados no `package.json`:
```
npm run dev        # node --watch src/server.js
npm start          # node src/server.js
npm run db:up      # docker compose up -d --wait db (Postgres só em 127.0.0.1:5432; cria também pace_paulista_test)
npm run migrate    # node scripts/migrate.js
npm run seed       # node scripts/seed.js (bloqueado com NODE_ENV=production, salvo ALLOW_DEMO_SEED=1)
npm test           # vitest run (usa banco de teste: DATABASE_URL_TEST; precisa do Postgres de pé)
npm run lint
```

Primeira execução: `npm i && npm run db:up && npm run migrate && npm run seed && npm run dev` → http://localhost:3000.

### Produção (no ar desde 2026-11-17)
- URL: https://pace-paulista.onrender.com/
- Render (Web Service Free, região Virginia, `render.yaml`) + Neon (Postgres 16 Free, us-east-1, conexão **direta**, `sslmode=verify-full`).
- Deploy automático a cada merge na `main` com o CI verde. Build: `npm ci && npm run migrate && npm run seed` (o Free não tem pre-deploy); se falhar, a versão anterior continua no ar. Healthcheck `GET /healthz`.
- Hiberna após ~15 min ocioso (cold start ~50 s); rate limits em memória zeram a cada hibernação/deploy.
- Migrations rodam **antes** da troca de versão: precisam ser compatíveis com o código antigo (adicionar num deploy, remover/renomear no seguinte).
- Env novo (ex.: `EMAIL_API_KEY`): segredo → `sync: false` no `render.yaml` e valor no painel; não-segredo → `value` no `render.yaml`.
- Passo a passo e operação: `docs/DEPLOY.md`.

---

## 11. Como os agentes devem trabalhar aqui

1. **Idioma**: textos de UI, mensagens de erro, commits e comentários em **português do Brasil**. Identificadores de código e banco em inglês, exceto valores de domínio (`norte`, `iniciante`, `seg`…).
2. **Fidelidade ao protótipo**: antes de criar uma página, abra a função correspondente em `docs/prototipo.html` e reproduza HTML, classes CSS e textos. Não invente copy nova sem necessidade.
3. **Camadas**: SQL só em `*.repo.js`; regra de negócio só em `service`/`domain`; rotas finas.
4. **Migrations são imutáveis** depois de commitadas. Mudou o schema? Nova migration numerada.
5. **Sem dependências novas** sem justificar no PR (especialmente ORMs, frameworks de front, bundlers).
6. **Testes obrigatórios** para: tudo em `src/domain/`, validações dos schemas zod, e um teste HTTP por fluxo (criar conta → login → cadastrar grupo → participar → sair → excluir conta).
7. **Definição de pronto** de uma tarefa: roda local com os comandos da §10, `npm test` e `npm run lint` passam, funciona sem JS, sem erros no console, responsivo em 360 px.
8. Em dúvida sobre regra de produto, **pergunte** — não decida sozinho.

### Pipeline de agentes
Todo trabalho passa por cinco subagentes em `.claude/agents/`, orquestrados por `/pipeline <marco ou pedido>`:

```
Specifier → (OK humano) → Coder → Cleaner → Hardener → QA
   spec em docs/specs/                                  veredito em docs/qa/
```
Cada etapa roda numa janela limpa: ao terminar, o agente grava o handoff em `.pipeline/state.md` (ignorado pelo git), **não chama o próximo** e pede ao usuário `/clear` + o próximo agente. Modelos fixos, esforço `default`: specifier=opus, coder=sonnet, cleaner=haiku, hardener=opus, qa=sonnet, orquestrador=sonnet.

O orquestrador registra a saída de cada etapa em `docs/reports/NNN-slug.md` e mantém `docs/PENDENCIAS.md` (riscos, pendências e perguntas por marco), que o Specifier lê antes de cada spec.

| Agente | Faz | Não faz |
|---|---|---|
| `specifier` | Spec testável com critérios de aceite | Código |
| `coder` | Implementa a spec + testes | Refatorar fora da área, decidir produto |
| `cleaner` | Refatora sem mudar comportamento | Funcionalidade nova |
| `hardener` | Segurança, autorização, bordas (teste antes da correção) | Mudar regra de produto |
| `qa` | Verifica critérios, sem JS, 360 px, regressão | Corrigir código |

Estilo de código e comentários: `docs/CONVENTIONS.md`. Marcos M1–M8: `docs/MILESTONES.md`.

---

## 12. Roadmap (depois da v1)
- **M10 (atual)**: recuperar senha por e-mail.
- **M9**: conteúdo real — moderação (grupo novo `pending` → admin aprova em `/admin`), dono edita/arquiva o próprio grupo (excluir já existe desde a spec 022), validade dos dados (`last_confirmed_at`), tirar os demos. Detalhes em `docs/PENDENCIAS.md`.
- Outros e-mails, reaproveitando o `modules/email` do M10: boas-vindas, confirmação de e-mail, aviso ao dono para confirmar os dados do grupo.
- Marcar o ponto no mapa ao cadastrar grupo (spec 025); mini-mapa na página do grupo. (O mapa real em si saiu no M11.)
- Confirmação de presença por encontro (tabela `attendances`) e notificações.
- Login com Google.
- Migrar para TypeScript.
