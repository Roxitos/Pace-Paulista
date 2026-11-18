# 023 — Nome completo na conta e apelido opcional no grupo
Marco: correção pós-M8 (antes do M10) · Status: **pronta para Coder** (OK do usuário e P1–P8 decididas em 2026-11-18: P3 **mudou** — nome completo exige sobrenome; demais com o default)
Depende de: 010 (criar conta), 014 (participar/sair), 017 (modal), 022 (dono não entra)

Decisões do usuário em 2026-11-17 (não reabrir): em vez de unicidade de nomes, **dois campos**. O cadastro da conta pede **Nome completo, E-mail e Senha** ("Nome completo" substitui o "Nome de exibição", mesma coluna `users.display_name`). No "Entrar no grupo" o campo vira **"Como gostaria de ser chamado?"**, **opcional**; **vazio = nome completo**.

## Objetivo
1. A conta guarda o nome completo da pessoa (nome e sobrenome, até 80 caracteres).
2. O apelido por grupo vira opcional: em branco, o site usa o nome completo da conta onde hoje usa o apelido.

## Fora do escopo
- Lista de participantes de um grupo: ninguém vê os integrantes (P5).
- Editar o nome da conta ou o apelido depois de entrar (não existe tela de edição hoje).
- Exigir sobrenome de contas já existentes ou no login (P1/P3: a regra vale só no cadastro novo).
- CHECK de sobrenome no banco (P3).
- Unicidade de nome ou apelido (descartada pelo usuário).
- Renomear a coluna `display_name` ou o identificador `displayName` no código (só muda o rótulo e o significado).
- Os itens abertos da spec 014 sobre apelido (caracteres invisíveis, 422 de quem já participa) continuam abertos.

## Mudanças

### Banco — nova migration `db/migrations/007_full_name_optional_nickname.sql`
Decisão do usuário (2026-11-18): a 023 usa a **007** e a tabela `password_resets` do M10 passa para a **008** (a 007 do M10 era só proposta no AGENTS, sem arquivo commitado). Numeração contínua e na ordem de deploy. Compatível com o código antigo durante o build (só afrouxa restrições).

```sql
-- Nome completo (spec 023): o "nome de exibição" passa a ser o nome completo da conta.
-- A regra "nome e sobrenome" fica só no form de cadastro: contas antigas de uma palavra continuam válidas.
ALTER TABLE users DROP CONSTRAINT users_display_name_check;
ALTER TABLE users ADD CONSTRAINT users_display_name_check
  CHECK (char_length(display_name) BETWEEN 2 AND 80);

-- Apelido opcional: NULL = usar o nome completo da conta (resolvido na leitura).
ALTER TABLE memberships ALTER COLUMN nickname DROP NOT NULL;
```
O CHECK `memberships_nickname_check` (2–40) continua: com NULL ele passa; string vazia continua recusada. Nomes das constraints são os gerados pelo Postgres para CHECK de coluna nas migrations 002/004; se o `DROP CONSTRAINT` falhar, a migration falha inteira (sem `IF EXISTS` de propósito).

### Domínio / schemas
- `auth.schemas.js` — `parseSignup` / `signupSchema.nome`:
  - **Normalização** (antes de validar, e é o valor gravado e reexibido): remover NUL, `trim`, NFC e **colapsar qualquer sequência de espaços em branco em um espaço** (`/\s+/gu → ' '`). Ex.: `"  Ana   da  Silva "` → `"Ana da Silva"`.
  - **Regras, em ordem, parando no 1º erro** (`abort: true`, como hoje):
    1. ≥ 2 code points → senão `Informe um nome com pelo menos 2 caracteres.` (igual hoje).
    2. ≤ **80** code points → senão `Use no máximo 80 caracteres.`
    3. **Nome e sobrenome**: separando por espaço, **pelo menos 2 palavras**, e **cada palavra contém pelo menos 1 letra** (`\p{L}`) → senão `Informe nome e sobrenome.`
  - Aceitos pela regra 3: acentos e cedilha (`João Conceição`), hífen (`Jean-Luc Picard`), apóstrofo (`Ana D'Ávila`, `Ana D’Ávila`), partículas (`Ana da Silva`, `Pedro dos Santos`). Recusados: `Ana` (1 palavra), `Ana 2`, `Ana -`, `Ana .` (palavra sem letra). Não há lista de caracteres proibidos além disso (P3).
  - `data.displayName` = o valor normalizado.
- `memberships.schemas.js` — `parseJoinForm(body)`:
  - `apelido` vazio depois de `trim` → válido, `data.nickname = null`.
  - Preenchido: 2–40 code points; menos de 2 → `Use pelo menos 2 letras ou deixe em branco.`; mais de 40 → `Use no máximo 40 caracteres.` (igual).
  - `ok` igual. Contrato: `{ values: { apelido, ok }, errors, data: { nickname: string | null } | null }`.

### Repo — `memberships.repo.js`
- `insertMembership(userId, groupId, nickname)`: aceita `nickname = null` (SQL igual).
- `findNickname(userId, slug)`: devolve o nome **efetivo** — `COALESCE(m.nickname, u.display_name)` com `JOIN users u ON u.id = m.user_id`; demais condições iguais (inclusive `g.owner_id IS DISTINCT FROM m.user_id`). Continua devolvendo `string | null` (null = não participa), então `groups.service` e as views não mudam de contrato.

### Rotas — `groups.routes.js`
- `renderDetail`: o valor inicial do form deixa de ser `user.displayName`; passa a `{ apelido: '', ok: false }` (P6). Nada mais muda nas rotas.

### Views
- `conta-criar.ejs`, campo `nome`: rótulo `Nome completo *`, `maxlength="80"`, `autocomplete="name"`; hint novo (tabela). Side-note "O que guardamos": itens 2 e 3 trocados pelos textos da tabela.
- `grupo-novo.ejs`, side-note "O que acontece depois": `Seu nome de exibição aparece…` → texto da tabela.
- `grupo-detalhe.ejs`, painel `#participar`:
  - Rótulo `Como gostaria de ser chamado?` (sem `*`); input sem nome pré-preenchido (vem de `joinValues.apelido`, que agora começa vazio), `autocomplete="nickname"`, placeholder igual (`Seu primeiro nome ou apelido`), `maxlength="40"`.
  - Hint novo `<span class="hint" id="h-jnome">…</span>` antes do `.err`, com o nome da conta via `<%= user.displayName %>`; `aria-describedby="h-jnome e-jnome"`.
  - Nota do rodapé do form trocada (tabela).
  - "Bem-vindo(a), {…}!" e "Você entrou como {…}" **sem mudança no template**: já usam `membership.nickname`, que agora vem efetivo do repo.
- `public/js/participar.js` (validação no submit): vazio passa; 1 caractere → `Use pelo menos 2 letras ou deixe em branco.`; o resto igual. Sem validação de sobrenome no cliente (não há JS no cadastro de conta).
- CSS: só se o CA10 falhar a 360 px — `overflow-wrap:anywhere` (+ `min-width:0` se preciso) no elemento que estourar. Nada de cor solta.

### Docs (no mesmo PR)
- **AGENTS §3**: árvore de migrations ganha `007_full_name_optional_nickname.sql` e a nota vira "próxima livre: 008 (M10)".
- **AGENTS §4** DDL: `display_name … CHECK (char_length(display_name) BETWEEN 2 AND 80) -- nome completo (spec 023)`; `nickname TEXT CHECK (char_length(nickname) BETWEEN 2 AND 40), -- NULL = nome completo da conta (spec 023)`; nota `-- 007_full_name_optional_nickname.sql`; o bloco proposto do M10 (`password_resets`) passa de "007 (M10, proposta…)" para "008 (M10, proposta…)".
- **AGENTS §6 Contas**: "Nome completo (coluna `display_name`): espaços colapsados, 2–80 chars, **nome e sobrenome** (≥ 2 palavras, cada uma com ≥ 1 letra) só no cadastro: «Informe nome e sobrenome.». Contas antigas de uma palavra continuam válidas."
- **AGENTS §6 Participar**: "Apelido **opcional** (“Como gostaria de ser chamado?”); vazio = nome completo da conta (gravado como NULL); preenchido, 2–40 chars: «Use pelo menos 2 letras ou deixe em branco.». Não há lista de participantes: ninguém vê os integrantes de um grupo."
- **AGENTS §7** "Cadastrado por {display_name}" → "Cadastrado por {nome completo}".
- **AGENTS §9**: "Dados pessoais mínimos: e-mail, nome completo (público só em “Cadastrado por …”), apelido opcional por grupo (visto só pela própria pessoa)."
- **MILESTONES.md**: linha do M10 "migration 007" → "migration 008".
- **PENDENCIAS.md**: nada a mudar sobre a numeração (o orquestrador registra a decisão).

## Regras e mensagens
| Campo / lugar | Regra | Texto exato |
|---|---|---|
| Criar conta, rótulo | — | `Nome completo *` |
| Criar conta, hint | — | `Nome e sobrenome. Aparece como “Cadastrado por …” nos grupos que você cadastrar.` |
| Criar conta, `nome` | NUL removido, trim, NFC, espaços colapsados; é o valor gravado | — |
| Criar conta, `nome` < 2 | code points | `Informe um nome com pelo menos 2 caracteres.` (igual hoje) |
| Criar conta, `nome` > 80 | code points | `Use no máximo 80 caracteres.` |
| Criar conta, `nome` sem sobrenome | < 2 palavras ou palavra sem letra | `Informe nome e sobrenome.` |
| Criar conta, "O que guardamos", item 2 | — | `Seu nome completo, que fica público nos grupos que você cadastrar.` |
| Criar conta, "O que guardamos", item 3 | — | `O apelido que você escolher (opcional) em cada grupo em que entrar.` |
| Cadastrar grupo, "O que acontece depois", item 2 | — | `Seu nome completo aparece como “Cadastrado por …” na página do grupo.` |
| Entrar no grupo, rótulo | sem `*` | `Como gostaria de ser chamado?` |
| Entrar no grupo, hint | `{nome}` = `display_name`, escapado | `Opcional. Se deixar em branco, usamos seu nome completo ({nome}).` |
| Entrar no grupo, apelido vazio | grava `NULL` | — |
| Entrar no grupo, apelido 1 caractere | servidor e `participar.js` | `Use pelo menos 2 letras ou deixe em branco.` (substitui "Informe um nome ou apelido com pelo menos 2 letras.") |
| Entrar no grupo, apelido > 40 | — | `Use no máximo 40 caracteres.` (igual) |
| Entrar no grupo, sem checkbox | — | `Confirme que leu as orientações.` (igual) |
| Entrar no grupo, nota final | — | `O apelido é opcional. Ele fica na sua conta e é apagado quando você sai do grupo ou exclui a conta.` |
| Boas-vindas / "Você entrou como" | `COALESCE(nickname, display_name)` | textos iguais aos de hoje |

## Critérios de aceite
- [ ] CA1 — Migration 007: aplica num banco com 001–006; depois dela `users.display_name` aceita 80 caracteres e recusa 81 (`23514`), e aceita uma palavra só (sem CHECK de sobrenome); `memberships.nickname` aceita `NULL` e ainda recusa `''` e 41 caracteres. `tests/db/migrate.test.js` lista a 007.
- [ ] CA2 — `GET /conta/criar` mostra `Nome completo *`, `autocomplete="name"`, `maxlength="80"`, o hint novo e os textos novos do "O que guardamos". `POST /conta/criar` com nome de 80 caracteres (2 palavras) cria a conta; com 81 → 422 e `Use no máximo 80 caracteres.` no campo; com 1 caractere → mensagem de mínimo de hoje.
- [ ] CA3 — Sobrenome: `POST /conta/criar` com `nome=Ana` → 422, `Informe nome e sobrenome.` no campo com `aria-invalid="true"` e o form reexibido com `Ana`; nada gravado. `Ana da Silva`, `João D'Ávila` e `Jean-Luc Picard` passam; `Ana 2` e `Ana -` recusam com a mesma mensagem.
- [ ] CA4 — Normalização: `nome="  Ana   da\tSilva  "` cria a conta com `display_name = 'Ana da Silva'` (conferido no banco), e é esse o nome mostrado depois. Em 422 por outro campo, o form reexibe o nome já colapsado.
- [ ] CA5 — Contas existentes: nada é migrado nem pedido de novo; uma conta com `display_name` de uma palavra (inserida direto no banco) entra normalmente, entra em grupo e cadastra grupo, e vê o mesmo nome em "Conta e dados" e em "Cadastrado por …" (P1).
- [ ] CA6 — Logado, `GET /grupos/<slug>` (não dono, não membro): painel com `Como gostaria de ser chamado?` sem `*`, input `name="apelido"` **sem** `value` com o nome da conta, `autocomplete="nickname"`, hint com o nome da conta escapado e `aria-describedby="h-jnome e-jnome"`, e a nota final nova.
- [ ] CA7 — `POST /participar` com `apelido` vazio (ou só espaços) e `ok` → `303`; a linha em `memberships` tem `nickname IS NULL`; a página seguinte mostra `Bem-vindo(a), {nome completo}!` e depois `Você entrou como {nome completo}`.
- [ ] CA8 — Com `apelido=Aninha` → grava `Aninha` e as telas mostram `Aninha` (regressão da 014). Participação antiga com apelido gravado continua mostrando o apelido. `apelido` de 1 caractere → 422 com `Use pelo menos 2 letras ou deixe em branco.` e `aria-invalid="true"`; sem `ok` → erro do checkbox como hoje; nada gravado.
- [ ] CA9 — `participar.js`: no modal, enviar com o campo vazio não mostra erro e segue para o servidor; com 1 caractere mostra a mesma mensagem do CA8 e não envia (inspeção do código + QA no navegador).
- [ ] CA10 — 360 px sem scroll horizontal com `display_name` de 80 caracteres em 2 palavras longas (ex.: 40 + espaço + 39, sem outros espaços): card em `/grupos` ("Cadastrado por …" visto por outro usuário), cabeçalho de `/grupos/<slug>`, hint do painel `#participar` (aberto sem JS) e "Conta e dados" em `/meus`.
- [ ] CA11 — Nenhuma tela lista os participantes de um grupo (P5): a página do grupo para outro membro não mostra nome nem apelido de ninguém além do próprio.
- [ ] CA12 — `grupo-novo.ejs` com o texto novo; AGENTS §3, §4, §6, §7 e §9 atualizados conforme "Docs" (`.claude/CLAUDE.md` só importa, não editar).
- [ ] CA13 — Funciona sem JS (form normal, PRG); nada de SQL fora de `*.repo.js`; `npm test` e `npm run lint` passam.

## Testes esperados
- db (`tests/db/`): CA1 (um caso por limite: 80 ok, 81 recusa, uma palavra aceita, nickname NULL ok, `''` recusa); `findNickname` devolve `display_name` quando `nickname` é NULL e o apelido quando preenchido.
- unit (`tests/domain/auth-schemas.test.js`): 80 passa, 81 dá a mensagem nova (troca o caso de 41); sobrenome: `Ana` recusa, `Ana 2` recusa, `Ana da Silva` / `João D'Ávila` / `Jean-Luc Picard` passam (um `it` para aceitos e um para recusados, sem tabela grande); colapso de espaços (`"  Ana   da\tSilva  "` → `values.nome` e `data.displayName` = `"Ana da Silva"`). Ajustar os fixtures de nome válido que tiverem uma palavra só.
- unit (`tests/domain/memberships-schemas.test.js`): vazio e só espaços → `data.nickname === null`; 1 caractere → mensagem nova; 41 recusa (ajustar o caso atual).
- http (arquivo que já cobre o cadastro de conta): CA2 (rótulo/hint + 81 → 422), CA3 (só `Ana` → 422; os demais casos ficam no unit), CA4 (valor gravado no banco). Ajustar os `nome` de uma palavra usados por helpers de teste que criam conta via `POST /conta/criar`.
- http (`tests/http/participar.test.js`): CA6 (substitui o teste do `value="Ana Souza"`), CA7, CA8 (só o caso de 1 caractere; o de 41 já está no unit).
- Sem teste novo de cliente para o CA9 (o `tests/client/participar.test.js` cobre só a montagem; o QA verifica no navegador).

## Decisões (usuário, 2026-11-18)
- **P1 — Contas existentes** (default aprovado): o `display_name` atual passa a valer como nome completo, sem pedir de novo e sem tela para editar; contas de uma palavra continuam válidas.
- **P2 — Limite de 80, migration 007** (default aprovado; numeração trocada com o M10 por decisão do usuário, 2026-11-18: 023 = 007, M10 = 008).
- **P3 — Sobrenome obrigatório** (**mudou**; o default era não exigir): após normalizar (trim, NFC, espaços colapsados), ≥ 2 palavras, cada uma com ≥ 1 letra; acentos, hífen, apóstrofo e partículas aceitos; mensagem `Informe nome e sobrenome.`. Validado só no zod do cadastro (`auth.schemas.js`), **sem CHECK no banco** para não invalidar contas antigas (P1).
- **P4 — "Cadastrado por"** (default aprovado): mostra o `display_name` inteiro, agora o nome completo.
- **P5 — Lista de participantes** (default aprovado): não existe; ninguém vê os integrantes de um grupo. O nome/apelido só aparece para a própria pessoa.
- **P6 — Apelido vazio grava `NULL`** (default aprovado), resolvido na leitura com `COALESCE`; o campo começa vazio.
- **P7 — LGPD / textos** (default aprovado): side-notes de criar conta e cadastrar grupo, nota do painel e AGENTS §9; `/sobre` e rodapé não mudam.
- **P8 — Textos** (default aprovado): os da tabela "Regras e mensagens" valem como finais.

Decisões técnicas (não de produto): coluna e identificadores continuam `display_name`/`displayName`; `autocomplete="name"` no cadastro e `nickname` no apelido (com `given-name`, o autopreenchimento encheria o campo opcional e anularia o "vazio = nome completo").

## Riscos
- Produção já tem participações com apelido gravado: continuam como estão (CA8).
- A regra de sobrenome é fácil de burlar (`Ana Ana`) e recusa quem tem nome de uma palavra só; aceito pelo usuário (P3). Contas antigas e novas convivem com regras diferentes (P1).
- Nome de 80 caracteres em "Cadastrado por …" aumenta o risco de layout a 360 px (CA10) e o de personificação já aceito na spec 010 (P7 de lá).
