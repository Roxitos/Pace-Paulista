# Relatório — 009 Sessão, CSRF e `requireAuth` (M5 Contas, spec 1 de 4)
Marco: M5 · Spec: [`docs/specs/009-sessao-csrf-requireauth.md`](../specs/009-sessao-csrf-requireauth.md) · QA: — (ainda não rodou)
Branch: `feat/m5-contas` (recriada a partir de `origin/main`; sem commit ainda) · Data: 2026-11-12

## Linha do tempo
| Etapa | Resultado |
|---|---|
| Reinício do M5 | Usuário cancelou o ciclo anterior (spec 010 implementada e Cleaner interrompido), descartou o trabalho não commitado e a branch local antiga, e pediu recomeço da `main`. A remota antiga `origin/feat/m5-contas` (`83f5921`) **não** pôde ser apagada (push de delete falhou 3 vezes com "remote end hung up"); segue no GitHub |
| Specifier | M5 dividido em 4 specs sequenciais (009–012), todas "aguardando OK do usuário"; 13 perguntas de produto abertas (P1–P13). Coder **não** começou |

## Decisões de produto
Respostas do usuário em 2026-11-12 (parciais; **sem OK para o Coder**, specs mantidas salvas):
- **P1** sim · **P3** rotas em `auth/auth.routes.js` (AGENTS §3 não muda) · **P5/P6** sim · **P7** não bloquear nomes · **P9** sim · **P10** padrão (nenhuma mensagem ao sair) · **P12** sim · **P13** não pede senha para excluir · **Marco**: excluir conta fica no M5 (spec 012; atualizar `MILESTONES.md` ao fechar o M5).
- **P2** (spec 009, a ajustar antes do Coder): 403 de CSRF mostra "Sua sessão expirou ou ocorreu um problema de segurança na atualização. Por favor, atualize a página e tente novamente." e oferece um botão **"Atualizar e tentar de novo"** (renovar o token em segundo plano via AJAX foi sugerido como alternativa; ficaria no M7, pois o JS é só melhoria progressiva).
- **P4/P8**: "ainda há verificar" — textos novos de criar conta, entrar e sair seguem **abertos**.
- **P11** (texto da confirmação de exclusão): **sem resposta**, aberta.

## Specifier
Specs, uma por PR, nesta ordem:
1. [`009-sessao-csrf-requireauth.md`](../specs/009-sessao-csrf-requireauth.md): sessão no Postgres (`pp.sid`, httpOnly, sameSite lax, `secure` em produção, 30 dias); CSRF em todo POST (`_csrf`), token gerado só quando uma página desenha um form; usuário nas views com `Cache-Control: private, no-store`; `requireAuth`; `safeNext`; limite de 16 kB no body; `SESSION_SECRET` vazio vale como ausente; log do Postgres sem `err.detail`; `/meus` mínima (só "Conta e dados").
2. [`010-criar-conta.md`](../specs/010-criar-conta.md): `/conta/criar`, regras de e-mail e senha do AGENTS §6, bcrypt cost 12, `23505` para e-mail duplicado, `regenerate` no cadastro, 10 tentativas/15 min por IP, aviso "O que guardamos" (nome de exibição público).
3. [`011-entrar-sair-header.md`](../specs/011-entrar-sair-header.md): `/conta/entrar` com erro genérico e tempo de resposta igual para e-mail inexistente, 10 falhas/15 min por IP+e-mail, `POST /conta/sair`, ícone do header por estado, `/sobre` com login ATIVO, teste HTTP do fluxo completo do M5.
4. [`012-excluir-conta.md`](../specs/012-excluir-conta.md): exclusão em 2 passos sem JS (`/meus?excluir=1` + `POST /conta/excluir`), cascata em `memberships`, `owner_id = NULL`, sessão destruída, aviso na home via `/?conta=excluida`.

### Perguntas em aberto
- **P1** `/meus` no M5 só com "Conta e dados"?
- **P2** token CSRF inválido → página genérica de erro com 403?
- **P3** rotas em `src/modules/account/` ou em `auth/auth.routes.js` (se `account/`, atualizar AGENTS §3)?
- **P4/P8** aprovar os textos novos de criar conta, entrar e sair (protótipo não tem conta).
- **P5/P6** limite de criar conta: 10/15 min por IP, 429, "Muitas tentativas. Espere alguns minutos e tente de novo."?
- **P7** bloquear nomes de exibição que imitem a marca? (padrão: não)
- **P9** header: só trocar destino e rótulo do ícone?
- **P10** mensagem depois de sair? (padrão: nenhuma)
- **P11** texto da confirmação de exclusão (grupos do usuário continuam publicados sem o nome dele, AGENTS §4).
- **P12** aviso de conta excluída via `?conta=excluida`?
- **P13** pedir a senha para excluir a conta? (padrão: não)

### Alertas do Specifier
- **Excluir conta muda de marco:** `MILESTONES.md` coloca a exclusão no M6; a spec 012 a traz para o M5. Confirmar.
- Dependências novas: `express-session`, `connect-pg-simple`, `csrf-sync` (009); `bcrypt`, `express-rate-limit` (010). Todas previstas no AGENTS §2.
- Fica para o M8: `trust proxy` em produção (cookie `secure` e IP do rate limit).

## Orquestrador
- Estado do pipeline em `.pipeline/state.md` (ignorado pelo git): próximo agente Coder, **bloqueado** até o OK do usuário.
- Ambiente: sem Docker; Postgres local do ciclo anterior pode continuar de pé em 127.0.0.1:5432.

## Coder
— (não rodou)

## Cleaner
— (não rodou)

## Hardener
— (não rodou)

## QA
— (não rodou)
