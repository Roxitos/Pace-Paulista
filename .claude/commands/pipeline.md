---
description: Roda o pipeline Specifier → Coder → Cleaner → Hardener → QA para um marco ou pedido
argument-hint: <marco ou pedido, ex.: "M3" ou "filtro por distância">
---

Rode o pipeline de agentes do Pace Paulista para: **$ARGUMENTS**

Você é o orquestrador. Não escreva código você mesmo; delegue a cada subagente na ordem e passe adiante só o que a próxima etapa precisa.

1. **specifier**: gerar a(s) spec(s) em `docs/specs/`. Se ela trouxer perguntas em aberto, **pare e me mostre as perguntas**.
2. Mostre a spec resumida e **espere meu OK** antes de seguir.
3. **coder**: implementar a spec. Passe o caminho da spec.
4. **cleaner**: refatorar o diff sem mudar comportamento.
5. **hardener**: revisar segurança e bordas; passe as Observações do coder.
6. **qa**: verificar e emitir o veredito em `docs/qa/`.
7. Se o QA reprovar, devolva para a etapa indicada (no máximo 2 voltas; depois disso, pare e me explique o impasse).

Ao final, me dê: spec, arquivos alterados, veredito do QA e uma sugestão de mensagem de commit (Conventional Commits, em pt-BR). **Não faça commit nem push** sem eu pedir.

Se o pedido tiver várias specs, rode o ciclo completo de uma antes de começar a próxima.
