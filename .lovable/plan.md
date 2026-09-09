# Corrigir negócios de outra empresa aparecendo ao trocar de workspace

## O que está acontecendo

A tela de Negócios guarda o último funil escolhido em uma única memória do navegador, compartilhada entre todas as empresas. Ao trocar de empresa, essa memória continua apontando para o funil da empresa anterior, e a lista/kanban busca os negócios apenas por funil — sem checar a empresa. Resultado: por um instante (ou até recarregar a página) você vê os negócios da outra empresa.

## O que vai ser feito

1. Guardar o funil escolhido separadamente para cada empresa, em vez de uma memória única.
2. Ao trocar de empresa, limpar imediatamente a seleção de funil e só voltar a mostrar negócios depois que os funis da nova empresa carregarem.
3. Passar a filtrar as buscas de negócios (kanban, lista e exportação) também pela empresa atual, para nunca trazer registros de outra empresa mesmo que o funil esteja desatualizado.
4. Separar o cache por empresa, para que dados carregados em uma empresa não sejam reaproveitados em outra.
5. Enquanto os funis da nova empresa carregam, mostrar o estado de carregamento em vez de uma lista antiga.

## Detalhes técnicos

- `src/pages/LeadsPage.tsx`: trocar `LS_FUNNEL_KEY` fixo por chave por organização (`crm_leads_funnel_id:<orgId>`); resetar `selectedFunnelId` quando `organization?.id` muda; efeito de auto-seleção passa a depender de `[funnels, orgId]`; `handleExportCSV` envia o `orgId`.
- `src/services/leads.ts`: `getLeadsByFunnel` e `getLeadsListPaginated` recebem `orgId` e adicionam `.eq('organization_id', orgId)` junto ao filtro de `funnel_id`.
- `src/hooks/useLeads.ts`: `useLeadsByFunnel` e `useLeadsList` leem a organização do contexto, incluem `orgId` nas `queryKey` (`['leads-kanban', orgId, ...]`, `['leads-list', orgId, ...]`) e em `enabled`; atualizar as invalidações e o update otimista de mover etapa para as novas chaves.
- Verificar se `useStages`/`ArchivedSummaryPanel` também dependem só de `funnelId` e ajustar a chave se necessário.
- Sem mudanças de banco: as políticas de RLS já isolam por organização; o vazamento era de estado/cache no cliente.

## Verificação

Typecheck e, no preview, trocar de empresa na barra lateral e confirmar que a tela de Negócios recarrega vazia/carregando e depois exibe apenas os negócios da empresa ativa, inclusive após recarregar a página.
