# Separar tarefas por empresa (workspace)

## O que está acontecendo

As tarefas hoje são buscadas apenas por "quem é o responsável" e por negócio — sem levar em conta a empresa ativa. Confirmei no código: a busca de tarefas do usuário e a contagem do sininho/badge filtram só por usuário, e a lista de tarefas de um negócio filtra só pelo negócio. Além disso, o resultado guardado em memória não distingue empresas, então ao trocar de empresa a lista anterior continua aparecendo.

## O que será feito

- Toda busca de tarefas passa a filtrar também pela empresa ativa:
  - Minhas tarefas (página Tarefas)
  - Contadores de atrasadas/hoje usados no menu lateral
  - Tarefas dentro de um negócio
- O cache em memória passa a ser separado por empresa, então trocar de empresa nunca mostra a lista da anterior.
- Enquanto a empresa ativa ainda não está carregada, a busca não roda (evita lista "piscando" com dados errados).

## Detalhes técnicos

- `src/services/tasks.ts`: `getMyTasks`, `getTaskBadgeCounts` e `getLeadTasks` recebem `orgId` e aplicam `.eq('organization_id', orgId)` nas queries (incluindo os dois counts do badge).
- `src/hooks/useTasks.ts`: usar `useOrganization()` em `useMyTasks`, `useTaskBadgeCounts` e `useLeadTasks`; incluir o `organization.id` nas `queryKey` (`['my-tasks', orgId, userId]`, `['task-badge-counts', orgId, userId]`, `['lead-tasks', orgId, leadId]`) e em `enabled`. Atualizar as `invalidateQueries` correspondentes (prefixo continua funcionando).
- Sem alteração de banco de dados: as tabelas já têm `organization_id` e RLS por empresa; o problema é só o filtro/cache no app.

## Verificação

- Checagem de tipos do projeto.
- Teste no navegador: abrir Tarefas em uma empresa, trocar no seletor da barra lateral e confirmar que a lista e os contadores mudam e não repetem os dados da outra.
