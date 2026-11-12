---
description: Roda o pipeline Specifier → Coder → Cleaner → Hardener → QA para um marco ou pedido
model: sonnet
argument-hint: <marco ou pedido, ex.: "M3" ou "filtro por distância">
---

Pipeline do Pace Paulista para: **$ARGUMENTS**

O pipeline é **stateless**: cada etapa roda numa janela limpa (`/clear`) e passa o bastão por `.pipeline/state.md` (ignorado pelo git). Ordem linear: **specifier → coder → cleaner → hardener → qa**.

## Protocolo do orquestrador
- **Início:** se `.pipeline/state.md` existir e a tarefa for continuação, leia-o para saber a etapa atual. Se for tarefa nova, invoque o **specifier** com o pedido (ele cria/sobrescreve o estado).
- Invoque **apenas uma etapa por vez**, passando só o caminho da spec / o essencial do estado. Não escreva código você mesmo.
- **Encerramento:** quando a etapa terminar, **NÃO invoque o próximo agente** e **NÃO continue conversando**. Confira que `.pipeline/state.md` foi atualizado e exiba exatamente:

```text
✅ Etapa [NOME_DO_AGENTE] concluída. Estado salvo em `.pipeline/state.md`.
👉 Execute `/clear` agora e, em seguida, chame o próximo agente: **[NOME_DO_PROXIMO_AGENTE]**
```

- Depois do **specifier**: se a spec tiver perguntas em aberto, mostre-as e pare. Senão, mostre a spec resumida e aguarde meu **OK** antes do Coder (`/clear` + Coder).
- Se o **qa** reprovar, o estado indica a etapa de retorno (máx. 2 voltas; depois pare e explique o impasse).

## Documentação (orquestrador, ao receber cada etapa concluída)
- Acrescente a saída da etapa em `docs/reports/NNN-slug.md` (mesmo NNN-slug da spec), no formato dos relatórios existentes. Os subagentes não escrevem esse arquivo.
- Ao fim do ciclo (QA aprovado), atualize `docs/PENDENCIAS.md` e marque `[x]` (citando a spec) o que foi resolvido. Relatório e pendências entram no mesmo commit da spec.
- Após o QA, me dê: spec, arquivos alterados, veredito e sugestão de commit (Conventional Commits, pt-BR). **Não faça commit nem push** sem eu pedir.
