# Mover negócio para outro funil

Hoje um negócio fica preso ao funil onde foi criado: no detalhe só é possível trocar de etapa, e na lista a ação em massa só move entre etapas do funil atual.

## O que será adicionado

1. **No detalhe do negócio**: nova ação "Mover para outro funil" no menu de ações do topo. Abre uma janela com:
   - seleção do funil de destino (apenas funis da empresa atual, excluindo o atual);
   - seleção da etapa de destino (carrega as etapas do funil escolhido, já sugerindo a primeira etapa);
   - botão confirmar.
2. **Em massa na visão lista**: ao selecionar vários negócios, além de "Mover para etapa", aparece "Mover para funil" com o mesmo par funil + etapa.
3. **Histórico**: cada transferência registra um item na linha do tempo do negócio, por exemplo "Funil alterado: Comercial → Pós-venda (etapa: Novo lead)".
4. Após mover, as listas, o kanban e o detalhe são atualizados automaticamente e aparece um aviso de sucesso.

## Regras

- Só funis da empresa ativa; nada cruza entre empresas.
- Funil e etapa são sempre atualizados juntos, para o negócio nunca ficar em etapa de outro funil.
- O tempo na etapa reinicia na chegada (comportamento já existente ao trocar de etapa).
- Negócios arquivados continuam bloqueados para mover, como já ocorre com a troca de etapa.
- Valor, contato, tags, tarefas, notas e campos personalizados permanecem intactos.

## Detalhes técnicos

- `src/services/leads.ts`: `moveLeadToFunnel(leadId, funnelId, stageId)` e `bulkMoveLeadsToFunnel(leadIds, funnelId, stageId)` atualizando `funnel_id` + `stage_id` na mesma chamada.
- `src/hooks/useLeads.ts`: `useMoveLeadToFunnel` e `useBulkMoveLeadsToFunnel`, invalidando `leads`, `lead`, `leads-kanban`, `leads-list` e `funnel-metrics`.
- Novo componente `src/components/leads/MoveToFunnelDialog.tsx` usando `useFunnels` e `useStages(funnelSelecionado)`; etapa reseta ao trocar o funil.
- Integração em `src/components/leads/LeadDetailSheet.tsx` (ação no cabeçalho) e `src/components/leads/list/BulkActionsBar.tsx` (nova ação em massa, recebendo o funil atual para filtrar).
- Atividade registrada via `createActivity` com `activity_type: 'stage_change'` e metadados de funil de origem/destino (mantém validação de tipos existente no banco).
- Sem mudanças de schema: `leads.funnel_id` e `leads.stage_id` já existem e as políticas atuais permitem a atualização.
