# QA — 023 Nome completo na conta e apelido opcional no grupo
Veredito: APROVADO (2ª rodada; a 1ª rodada reprovou por CA10 em `/meus`, corrigido)

Ambiente: `npm ci`, migrate (aplicou a 007; 2ª execução "já em dia, 7 migrations"), seed idempotente. App em `npm start`, Playwright/Chromium (360x800, com e sem JavaScript).

| Critério | Resultado | Evidência |
|---|---|---|
| CA1 Migration 007 | ✅ | `users_display_name_check` = 2..80; `memberships.nickname` nullable; `memberships_nickname_check` mantido; testes de db passam |
| CA2 Criar conta (rótulo, autocomplete, maxlength, hint, 80/81) | ✅ | Playwright: `Nome completo *`, `autocomplete=name`, `maxlength=80`; 81 e 1 caractere cobertos nos testes http |
| CA3 Sobrenome | ✅ | `Ana` → "Informe nome e sobrenome.", `aria-invalid=true`, valor `Ana` reexibido |
| CA4 Normalização | ✅ | `"  Ana   da   Silva  "` criou conta e `/meus` mostra "Ana da Silva" |
| CA5 Contas antigas de uma palavra | ✅ | testes http/db passam (não reexecutado no navegador) |
| CA6 Painel #participar | ✅ | sem JS: rótulo sem `*`, `value=""`, `autocomplete=nickname`, `aria-describedby="h-jnome e-jnome"`, hint "Opcional. Se deixar em branco, usamos seu nome completo (Carla Souza)." |
| CA7 Apelido vazio → NULL | ✅ | com JS (Bruno) e sem JS (só espaços, Carla): "Bem-vindo(a), {nome completo}!" e "Você entrou como {nome completo}"; banco: `nickname IS NULL` |
| CA8 Apelido 1 caractere / regressão | ✅ | sem JS: 422 com "Use pelo menos 2 letras ou deixe em branco." e `aria-invalid=true`; testes http passam |
| CA9 participar.js no navegador | ✅ | modal: 1 caractere → mensagem do CA8 e não envia (URL não mudou); vazio → envia e entra com nome completo |
| CA10 360 px com nome de 80 caracteres | ✅ | 2ª rodada, Chromium 360x800, com e sem JS: nome 40+espaço+39 (conta criada pelo form) e nome de 80 'C' sem espaço (conta antiga inserida no banco, pois o cadastro exige sobrenome): scrollWidth = 360 em `/meus` (`.account-line`), `/grupos`, `/grupos/pace-da-oca` e `#participar`, `/`, `/zonas`, `/sobre`. Sem erros de console |
| CA11 Sem lista de participantes | ✅ | página do grupo para outro membro só mostra o "Cadastrado por" do dono |
| CA12 Docs | ✅ | AGENTS §3, §4, §6, §7, §9 e MILESTONES (M10 → 008) conferidos; `grupo-novo.ejs` com o texto novo |
| CA13 Sem JS / camadas / testes | ✅ | PRG sem JS funcionando; SQL só nos repos; testes e lint ok |

Testes: 905 passaram / 0 falharam (57 arquivos, 2ª rodada) · Lint: ok (eslint + prettier)

Regressão: `/`, `/grupos?zona=sul&nivel=iniciante`, `/grupos/pace-da-oca`, `/zonas`, `/mapa`, `/sobre`, `/encontrar`, `/conta/criar`, `/conta/entrar` respondem 200; `/meus` e `/grupos/novo` deslogado redirecionam 302 para `/conta/entrar?next=...`. Console do navegador: único erro foi o 422 esperado do cadastro com `Ana`.

## Problemas encontrados
Nenhum na 2ª rodada. O bug da 1ª rodada (CA10 em `/meus`, scrollWidth 530) foi corrigido com `.account-line{overflow-wrap:anywhere}`. Migration rodada 2x sem erro; seed idempotente.

## Sugestões não bloqueantes
- Riscos aceitos pelo Hardener (caracteres invisíveis em nome/apelido; rollback com apelidos NULL) seguem abertos, sem mudança.
