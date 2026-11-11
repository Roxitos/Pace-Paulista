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

### Fora do escopo da v1 (não implementar sem pedido explícito)
- Moderação/aprovação de grupos (deixar só a coluna `status` preparada).
- Mapa real (Leaflet/OSM com coordenadas). Manter o mapa esquemático em SVG.
- Notificações, confirmação de presença por encontro, chat.
- Login social (Google etc.), recuperação de senha por e-mail.
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
│   ├── MILESTONES.md, PENDENCIAS.md
│   └── specs/, reports/, qa/ ← saídas do pipeline, numeradas NNN-slug.md
├── docker-compose.yml        ← Postgres local
├── .env.example
├── package.json
├── scripts/
│   ├── migrate.js            ← aplica db/migrations/*.sql em ordem
│   └── seed.js               ← insere os grupos de demonstração
├── db/
│   ├── migrations/
│   │   ├── 001_extensions.sql
│   │   ├── 002_users.sql
│   │   ├── 003_groups.sql
│   │   ├── 004_memberships.sql
│   │   └── 005_sessions.sql
│   └── seeds/
│       └── demo-groups.js
├── src/
│   ├── server.js             ← só faz app.listen
│   ├── app.js                ← monta o Express (middlewares, rotas, erros); exportado p/ testes
│   ├── config/env.js         ← lê e valida variáveis de ambiente (zod)
│   ├── db/pool.js            ← Pool do pg + helper tx(fn) para transações
│   ├── domain/
│   │   ├── constants.js      ← ZONAS, DIAS, NIVEIS, PERIODOS, PACE_FAIXAS (copiar do protótipo)
│   │   ├── pace.js           ← parsePace, fmtPace, fmtFaixa
│   │   ├── schedule.js       ← periodoDe, proximos (fuso America/Sao_Paulo), fmtHora, fmtDias*
│   │   ├── filters.js        ← normaliza a query string dos filtros e monta os chips (o WHERE fica no groups.repo)
│   │   ├── match.js          ← calcMatch (algoritmo de compatibilidade)
│   │   └── slug.js
│   ├── modules/
│   │   ├── auth/             ← auth.routes.js, auth.service.js, users.repo.js, auth.schemas.js
│   │   ├── groups/           ← groups.routes.js, groups.service.js, groups.repo.js, groups.schemas.js
│   │   ├── memberships/      ← memberships.routes.js, memberships.service.js, memberships.repo.js
│   │   ├── matching/         ← matching.routes.js (usa domain/match.js)
│   │   └── pages/            ← pages.routes.js (home, zonas, mapa, sobre)
│   ├── middlewares/
│   │   ├── locals.js         ← res.locals.user, csrfToken, currentPath, flash, helpers de view
│   │   ├── requireAuth.js    ← redireciona p/ /conta/entrar?next=...
│   │   ├── notFound.js
│   │   └── errorHandler.js
│   └── views/
│       ├── layout.ejs
│       ├── partials/         ← header, footer, icons (função ic), seal, zone-chip, level-meter,
│       │                        group-card, page-head, track-deco, empty-state, form-errors, flash,
│       │                        filter-options
│       └── pages/            ← home, grupos, grupo-detalhe, zonas, mapa, encontrar, grupo-novo,
│                                meus, sobre, conta-entrar, conta-criar, 404, 500
├── public/
│   ├── css/app.css           ← CSS do protótipo extraído (ver §8)
│   └── js/
│       ├── app.js            ← menu mobile, toast, modal "Entrar no grupo", contador de caracteres
│       ├── filtros.js        ← filtros ao vivo na /grupos (progressive enhancement)
│       └── mapa.js           ← seleção de pin/lista no mapa esquemático
└── tests/
    ├── domain/*.test.js
    └── http/*.test.js
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
  display_name   TEXT   NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 40),
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
  map_pin            INT[],  -- [x,y] no SVG esquemático; NULL = calcular pela zona
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
  nickname   TEXT   NOT NULL CHECK (char_length(nickname) BETWEEN 2 AND 40),
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, group_id)
);
CREATE INDEX memberships_group_idx ON memberships (group_id);

-- 005_sessions.sql  → usar o schema oficial do connect-pg-simple (tabela "session")
```

### Regras derivadas
- **Participantes exibidos** = `base_participants + COUNT(memberships)` do grupo. Calcular na query (subquery ou `LEFT JOIN ... GROUP BY`), nunca guardar o total.
- **Grupo público** = `status = 'published'`. Na v1 todo grupo novo já nasce `published`.
- **Dono do grupo** (`owner_id`) é quem cadastrou. Na v1 o dono não edita/exclui pela UI (v2), mas a coluna existe.
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
| `/mapa` e `/mapa/:slug` | — | `PageMapa` | `:slug` pré-seleciona o grupo |
| `/encontrar` | — | `PageEncontrar` | Formulário de compatibilidade |
| `/meus` | ✅ | `PageMeus` | Grupos em que entrei + grupos que cadastrei + "Conta e dados" |
| `/sobre` | — | `PageSobre` | Atualizar "Status do protótipo": banco e login viram **ATIVO** |
| `/conta/entrar` | só deslogado | novo | Aceita `?next=/caminho` (validar: só caminhos internos começando com `/`) |
| `/conta/criar` | só deslogado | novo | |

### Ações (POST, padrão Post/Redirect/Get, todas com CSRF)
| Rota | Auth | O que faz |
|---|---|---|
| `POST /grupos` | ✅ | Cria grupo. Erro → re-renderiza o form com valores e mensagens (status 422). Sucesso → redirect `/grupos/:slug?criado=1` (tela de sucesso do protótipo) |
| `POST /grupos/:slug/participar` | ✅ | Body: `apelido`, `ok`. Idempotente (`ON CONFLICT DO NOTHING`) |
| `POST /grupos/:slug/sair` | ✅ | Remove membership |
| `POST /encontrar` | — | Calcula compatibilidade no servidor e re-renderiza `/encontrar` com resultados. Nada é salvo |
| `POST /conta/criar` | — | Cria usuário, já loga, redirect `next` ou `/meus` |
| `POST /conta/entrar` | — | Rate limit: 10 tentativas / 15 min por IP+email |
| `POST /conta/sair` | ✅ | Destroi sessão (logout é sempre POST) |
| `POST /conta/excluir` | ✅ | Substitui o "Apagar meus dados deste navegador". Pede confirmação (mesma UI de 2 passos do protótipo) |

### JSON (só para melhoria progressiva)
| Rota | Uso |
|---|---|
| `GET /api/grupos?<mesmos filtros>` | `public/js/filtros.js` atualiza resultados sem recarregar e faz `history.replaceState` com a query |

Sem JS, o form de filtros faz GET normal em `/grupos` e tudo funciona.

### Fluxo "Entrar no grupo"
- Visitante **deslogado** clica "Entrar no grupo" → vai para `/conta/entrar?next=/grupos/<slug>%23participar`.
- **Logado** → abre o modal do protótipo (JS) com campo apelido pré-preenchido com `display_name`; sem JS, `/grupos/:slug#participar` mostra o mesmo form inline.
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
- Apelido 2–40 chars: "Informe um nome ou apelido com pelo menos 2 letras."
- Checkbox de orientações obrigatório: "Confirme que leu as orientações."

### Contas
- E-mail válido e único: "Já existe uma conta com esse e-mail."
- Senha mínimo **8** caracteres. Nunca logar senha; nunca devolver `password_hash`.
- Login com erro genérico: "E-mail ou senha incorretos." (não revelar qual dos dois).
- `req.session.regenerate()` no login e no cadastro (evita fixação de sessão).

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

A UI continua marcando grupos demo com a etiqueta **"Fictício · demo"** e o aviso "Versão de demonstração" na home enquanto existirem grupos demo publicados. Grupos reais mostram "Cadastrado por {display_name}" (ou "Cadastrado por você" para o dono).

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
- JS do cliente é **progressivo**: toda ação precisa funcionar sem JS (forms normais). JS só adiciona modal, filtro ao vivo, toast, menu mobile.
- Mobile first: testar em 360 px de largura, sem scroll horizontal.

---

## 9. Segurança e LGPD

- Toda query **parametrizada**. Proibido concatenar input em SQL.
- CSRF em todo POST. Cookies de sessão: `httpOnly`, `sameSite=lax`, `secure` em produção, `maxAge` 30 dias.
- `helmet` com CSP permitindo apenas `self`, `fonts.googleapis.com` e `fonts.gstatic.com`. Sem scripts inline (mover `<script>` para `public/js`).
- Rate limit em `/conta/entrar` e `/conta/criar`.
- `?next=` só aceita caminhos internos (começam com `/` e não com `//`).
- Dados pessoais mínimos: e-mail, nome de exibição, apelido por grupo. Contato do grupo deve ser canal público do grupo (hint já existe no form).
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
```

Scripts esperados no `package.json`:
```
npm run dev        # node --watch src/server.js
npm start          # node src/server.js
npm run db:up      # docker compose up -d --wait db (Postgres só em 127.0.0.1:5432; cria também pace_paulista_test)
npm run migrate    # node scripts/migrate.js
npm run seed       # node scripts/seed.js (bloqueado com NODE_ENV=production)
npm test           # vitest run (usa banco de teste: DATABASE_URL_TEST; precisa do Postgres de pé)
npm run lint
```

Primeira execução: `npm i && npm run db:up && npm run migrate && npm run seed && npm run dev` → http://localhost:3000.

Deploy sugerido (v1): um serviço Node + Postgres gerenciado (Render, Railway ou Fly.io). `npm run migrate` roda no release, antes de subir a nova versão.

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
- Moderação: grupo novo `pending` → admin aprova em `/admin`.
- Dono edita/arquiva o próprio grupo.
- Mapa real com Leaflet + OpenStreetMap (colunas `lat`, `lng`).
- Confirmação de presença por encontro (tabela `attendances`) e notificações.
- Recuperação de senha por e-mail; login com Google.
- Migrar para TypeScript.
