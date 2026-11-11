# Pendências por marco

Riscos aceitos, pendências e perguntas abertas levantadas pelo pipeline. **O Specifier lê este arquivo antes de cada spec** e incorpora (ou responde) os itens do marco. Ao resolver um item, marque `[x]` e cite a spec.

Origem: `001` = [relatório 001](reports/001-scaffold-base.md), `002` = [relatório 002](reports/002-home-estatica.md).

## Perguntas de produto em aberto
- [ ] **M3** — Home sem grupos: qual texto/layout de "sem grupos" e estado vazio dos destaques? Hoje: pace omitido, "0 grupos cadastrados", zonas "0 grupos", destaques vazios. (002)
- [ ] **M3+** — Corrigir "Selo da Centro" → "Selo do Centro"? (texto literal do protótipo) (002)
- [ ] **M5/M6** — 4xx que não são 404 (400/413) usam a página genérica "Algo deu errado" mantendo o status. Querem texto próprio? (001)

## M2 — Banco
- [ ] CHECKs garantem `zone`, `level`, `days` (`cardinality(days) >= 1`), `start_time` e pace 180–720 inteiro; hoje zona/nível desconhecido em destaque → 500 de propósito, `days` vazio → " · 6h". (002)
- [ ] Validar `DATABASE_URL` e exigir `SESSION_SECRET` forte em produção no `env.js`. (001)
- [ ] Seed reaproveita `db/seeds/demo-groups.js`. (002)
- [ ] Docker Desktop instalado mas ainda não inicializado na máquina (abrir o app, aceitar termos, talvez WSL2 + reinício).

## M3 — Leitura
- [ ] SQL parametrizado; `ILIKE` com `%` e `_` escapados; tratar `23505`/`23514`; `tx()` em escritas múltiplas. (001)
- [ ] `src/` deixa de importar `db/seeds/demo-groups.js` e passa a ler do banco. (002)
- [ ] Formato de `PACE_FAIXAS` diverge: AGENTS.md `[min,max]` × protótipo `{nome,min,max}` — decidir na spec. (Specifier 001)
- [ ] Slugs continuam `[a-z0-9-]` (já há `encodeURIComponent` nos links). (002)

## M4 — Compatibilidade / cadastro
- [ ] zod no cadastro de grupo (`parsePace`, dias, horário) e `slug()` com geração/validação. (002)

## M5 — Contas
- [ ] CSRF, sessão, cookies (`httpOnly`, `sameSite=lax`, `secure`), `requireAuth`, `session.regenerate`. (001)
- [ ] `?next=` só caminhos internos (`/…`, nunca `//…`) — a home já gera `/conta/entrar?next=/grupos/<slug>%23participar`. (001, 002)
- [ ] Rate limit em `/conta/entrar` e `/conta/criar`. (001)
- [ ] Ao montar body-parser: `limit` explícito em `express.urlencoded` (o `errorHandler` já trata 400/413). (001)
- [ ] Excluir conta: cascata e sessão destruída. (001)

## M8 — Produção
- [ ] helmet + CSP (`self`, fonts.googleapis.com, fonts.gstatic.com). `style="--z:…"`, `style="font-size:14px"` e o `extra` do 404/500 exigem `style-src-attr 'unsafe-inline'` ou classes CSS. (001, 002)
- [ ] Não publicar antes de M3/M5: links da home levam a 404. (002)

## Riscos aceitos
- `npm audit`: 4 moderados (GHSA-g3hv-75wg-m249, minimatch via eslint 10), só devDependencies; `--omit=dev` = 0. Reavaliar quando sair eslint 10.x corrigido. (001)
- `throw null` / `next(null)` → Express trata como "sem erro" e responde 404. (001)
- `.prettierignore` com `*.md` e `.claude/` além da spec. (001)
