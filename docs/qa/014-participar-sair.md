# QA — 014 Participar e sair de grupo
Veredito (2ª volta, só CA11): APROVADO

| Critério | Resultado | Evidência |
|---|---|---|
| CA11 sem JS / 360 px | ✅ | Chromium/Playwright 360×800 com JavaScript desligado, apelido de 40 "W". scrollWidth (html/body/viewport): visitante 360/360/360; logado com painel aberto 360; erro 422 (apelido "a") 360; **sucesso (`#participar` após o POST) 360**; **participante (GET seguinte) 360**; "saiu" 360. PRG e âncora funcionam sem JS |
| CA11 sem SQL fora de `*.repo.js` | ✅ | grep de SELECT/INSERT/UPDATE/DELETE em `src/`: só aparece em repos (e um comentário em `auth.service.js`) |
| CA11 nenhum JS novo | ✅ | `git status` sem alterações em `public/js`; só `public/css/app.css` (regras `min-width:0`, `overflow-wrap:anywhere`, coluna `minmax(0,1fr)`) |
| CA12 testes/lint | ✅ | 803/803 (47 arquivos); eslint e prettier ok |

Observações:
- Na primeira carga fria do Chromium, o visitante em `/grupos/pace-da-oca` mediu 375 uma vez (mesmo efeito não reproduzível já registrado na 1ª volta, problema 2); em 3 recargas seguintes mediu 360. Não bloqueante.
- Dados de teste criados nesta volta (usuário `qa14b*` e a participação) foram removidos. Resta no banco local o usuário 14 (`w1794848844577@t.com`) com participação de apelido "W"x40 no grupo 5, criado às 17:07 antes desta volta (não é do QA); pode ser limpo pelo orquestrador.
- Demais critérios (CA1–CA10) seguem válidos da 1ª volta; o diff desta volta só toca CSS e comentários.

---
## Histórico: 1ª volta (REPROVADO)
Veredito: REPROVADO (devolver ao Coder: bug de CSS no CA11)

| Critério | Resultado | Evidência |
|---|---|---|
| CA1 deslogado | ✅ | Página sem `id="participar"`; POST sem `_csrf` → 403; com `_csrf` → 303 `/conta/entrar` (participar e sair) |
| CA2 logado sem participação | ✅ | `href="#participar"`, painel sem `open`, `#j-nome` com `value` = display_name, `maxlength=40` (Playwright sem JS) |
| CA3 participar válido | ✅ | Apelido "  Zé QA  " → "Zé QA"; 303 `/grupos/<slug>#participar`; contagem 48→49; "Bem-vindo(a), Zé QA!", "Você agora faz parte do", "Primeiro treino: sábado, 21 de novembro, 6h30.", link `/mapa/<slug>`, "Você entrou como", form `/sair`; novo GET sem boas-vindas e sem painel |
| CA4 idempotência | ✅ | Testes automatizados (participar.test.js); não repetido à mão |
| CA5 inválido | ✅ | 422; "Informe um nome ou apelido com pelo menos 2 letras." e "Confirme que leu as orientações."; `aria-invalid=true`; painel `open`; 41 caracteres → "Use no máximo 40 caracteres."; vazio → 1 autofocus |
| CA6 404 | ✅ | `/grupos/nao-existe/participar` 404; `/grupos/A_B/participar` e `/sair` 404 (pending coberto por teste) |
| CA7 sair | ✅ | 303 `/grupos/<slug>`; "Você saiu do grupo." com `role="status"`; contagem 49→48; link `#participar` volta; recarregar não repete o aviso |
| CA8 sem próximo encontro | ✅ (inspeção) | `grupo-detalhe.ejs` usa `locals.nextSession \|\| null`; nenhum teste renderiza com `nextSession: null` |
| CA9 hostis | ✅ | `apelido=a&apelido=bb` → 422 (usa o 1º, "a"); NUL → 303; `<script>` escapado (`&lt;script&gt;`), 0 ocorrências cruas; sem 500 |
| CA10 flash | ✅ | Flash `joined` não aparece em outro grupo nem na volta; tabela `session` sem apelido (0 linhas com o apelido) |
| CA11 sem JS / 360 px | ❌ | Sem JS, PRG e âncora funcionam. 360×800 ok em visitante, logado, erro, sucesso (apelido curto), participante e "saiu". **Estoura com apelido de 40 caracteres sem espaço** (ver problema 1) |
| CA12 testes/lint | ✅ | 802/802; lint e prettier ok; migrate 2x em dia (6 migrations) |

Testes: 802 passaram / 0 falharam (47 arquivos) · Lint: ok

Regressão (Playwright 360 px, sem JS): `/`, `/grupos`, `/grupos?zona=sul`, `/mapa`, `/zonas`, `/encontrar`, `/meus`, `/conta/entrar` e detalhe de grupos demo respondem 200 com scrollWidth 360.

## Problemas encontrados
1. **(bloqueante, CA11)** Apelido de 40 caracteres sem espaço (ex.: 40 × "W") causa scroll horizontal (scrollWidth 700 em vez de 360):
   - Estado sucesso (`#participar` após o POST) e estado participante (GET seguinte).
   - Elementos que passam de 360 px: `div.form-alert.good` e o `<b>` do apelido em "Você entrou como …", o `form.stack` e os botões "Sair do grupo" e "Ver rota" (esticados pelo conteúdo).
   - Reproduzir: logar, abrir `/grupos/pace-da-oca#participar`, apelido `WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW`, marcar o checkbox, confirmar, viewport 360×800.
   - Mesma classe do bug da 013. Correção sugerida: `overflow-wrap:anywhere` e `min-width:0` em `.form-alert span`/`.form-alert` (e no `<b>` do apelido), fora do bloco literal do protótipo. Adicionar teste de regressão se possível.
2. (não bloqueante, não reproduzível) Na primeira navegação após abrir o Chromium sem JS, `/` mediu 375 uma vez (menu do cabeçalho). Não se repetiu em nova carga nem com JS e não envolve a spec 014; provável efeito de fontes e animação na 1ª carga.

## Sugestões não bloqueantes
- Adicionar teste de renderização com `nextSession: null` (CA8 hoje só por inspeção).
- Pendências do Hardener seguem válidas: sem rate limit (M8), 422 sem erro visível para quem já participa, apelido só com caracteres invisíveis.
- Dados de teste do QA (usuários `qa14*`) foram removidos do banco local.
