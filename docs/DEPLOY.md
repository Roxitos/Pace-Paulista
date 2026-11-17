# Deploy — Render + Neon (custo zero)

Passo a passo para publicar o Pace Paulista. O `render.yaml` na raiz descreve o serviço.

## 0. Custo zero
Tudo no plano **Free**: Render Web Service Free e Neon Free. Nenhum cartão é necessário.
Limites conhecidos: 1 serviço Free no Render basta (750 h/mês de instância cobrem um serviço 24 h, ~744 h); o Neon Free tem 0,5 GB e horas de compute limitadas. Confira a página de planos de cada um no dia do deploy.

## 1. Neon
1. Crie o projeto `pace-paulista`, **Postgres 16** (igual a dev e CI), região **AWS US East (N. Virginia)**, plano Free.
2. Copie a connection string com **"Connection pooling" desligado** (host **sem** `-pooler`).
3. Troque os parâmetros no fim da URL por `?sslmode=verify-full` (o Neon entrega `sslmode=require&channel_binding=require`).

## 2. Render
1. New → Blueprint → este repositório (usa o `render.yaml`).
2. Cole a URL do passo 1 em `DATABASE_URL`.
3. O 1º deploy roda `npm ci && npm run migrate && npm run seed` no **build** (o Free não tem pre-deploy) e só troca a versão depois de `/healthz` responder. Se o migrate ou o seed falharem, o build falha e a versão anterior continua no ar.

## 3. Conferir no SQL Editor do Neon
```sql
SELECT extname FROM pg_extension WHERE extname = 'citext';          -- 1 linha
SELECT column_name FROM information_schema.columns WHERE table_name = 'session'; -- sid, sess, expire
SELECT count(*) FROM schema_migrations;                             -- 6
SHOW standard_conforming_strings;                                   -- on
SELECT count(*) FROM groups WHERE is_demo;                          -- 11
```

## 4. Hibernação e cold start (leia)
- No Free, o Render **hiberna o serviço após ~15 min sem tráfego**. A 1ª visita depois disso espera ~50 s (tela de carregamento do Render) e depois fica normal.
- O Neon também suspende o banco após ~5 min ocioso e acorda sozinho (1–2 s a mais na 1ª consulta; o pool aceita até 15 s de espera).
- Efeitos: o limite de requisições (em memória) zera a cada hibernação; as sessões de login **não** se perdem (ficam no Postgres).
- Para o site não hibernar em horário de uso, **opcional e sem código**: um monitor gratuito (ex.: UptimeRobot, plano free, intervalo de 5 min) apontando para `https://<seu-serviço>.onrender.com/healthz`. Cuidados: mantém a instância acordada 24 h (~744 h/mês, abaixo das 750 h do Free, **só com este serviço**); não mantém o Neon acordado (o `/healthz` não consulta o banco); confirme nos termos atuais do Render que ping externo é permitido.

## 5. Operação
- Deploy automático a cada push na `main`, depois do CI verde.
- Migration com erro faz o build falhar e a versão anterior continua no ar.
- A migration roda **antes** de a nova versão subir, então precisa ser compatível com o código antigo: adicione coluna/tabela em um deploy e só remova/renomeie no seguinte.
- *Rollback* do Render volta o código, **não** o schema (migrations só vão para frente); o Neon tem restauração por horário dentro do histórico do plano Free.
- Trocar `SESSION_SECRET` desloga todo mundo.
- Para ensaiar uma migration arriscada, crie uma branch no Neon e rode `npm run migrate` local com `NODE_ENV=development` e a `DATABASE_URL` da branch (conexão direta).
- O migrate recusa host `-pooler`: o `pg_advisory_lock` não funciona pelo pooler.

## 6. M9: tirar os demos
Remova `ALLOW_DEMO_SEED` **e** o `&& npm run seed` do `buildCommand` no `render.yaml`, no mesmo PR (sem a flag o seed sai com código 1 e o build falha). Depois apague os demos do banco.
