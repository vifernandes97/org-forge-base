# Mesclar negócios duplicados

Permitir juntar dois (ou mais) negócios que são a mesma oportunidade, mantendo um como principal e arquivando os demais como duplicados.

## Como vai funcionar

Dois caminhos para iniciar:

1. **Na lista**: ao marcar 2 ou mais negócios, a barra de ações ganha o botão "Mesclar".
2. **Dentro do negócio**: no painel de detalhes, ação "Mesclar com..." com campo de busca (nome, empresa, e-mail, telefone) para achar o duplicado.

Antes de concluir, aparece uma confirmação mostrando qual negócio será o principal (o usuário pode trocar) e o que será transferido.

Regras dos dados:

- Vale sempre o valor do negócio principal; campos vazios no principal são completados com o valor do duplicado (inclui nome, empresa, e-mail, telefone, valor, fonte, tags, responsável, qualificação e campos personalizados).
- Tags são unidas sem repetição.
- Etapa, funil e status permanecem os do principal.

O que é transferido do duplicado para o principal:

- Todas as tarefas
- Todo o histórico/timeline (anotações, ligações, e-mails, reuniões, mudanças de etapa)
- Anotações do campo de notas são anexadas ao final das notas do principal

O duplicado depois da mesclagem:

- Fica arquivado com o motivo "Duplicado" (criado automaticamente se ainda não existir) e status inativo
- Recebe registro no histórico indicando em qual negócio foi mesclado
- O principal recebe um registro "Negócio mesclado" no histórico, com nome do duplicado

Permissões: apenas proprietário, administrador e membro podem mesclar; visualizador não vê a ação.

## Detalhes técnicos

Banco (migração):

- `leads`: colunas novas `merged_into_lead_id uuid null` (FK para `leads.id`) e `merged_at timestamptz null`.
- Função `merge_leads(p_primary_id uuid, p_duplicate_ids uuid[]) returns jsonb`, `SECURITY DEFINER`, `search_path = public`:
  - valida `auth.uid()`, mesma `organization_id` em todos os ids e papel via `get_user_org_role` em ('owner','admin','member');
  - preenche campos nulos do principal com os do duplicado (coalesce), une `tags`;
  - copia `custom_field_values` do duplicado para chaves ainda sem valor no principal (upsert em `lead_id,field_definition_id`);
  - `UPDATE tasks SET lead_id = principal`, `UPDATE lead_activities SET lead_id = principal`;
  - concatena `notes`;
  - garante `archive_reasons` com label 'Duplicado' na org (insere se faltar) e arquiva o duplicado (`archived_at`, `archive_reason_id`, `status='inactive'`, `merged_into_lead_id`, `merged_at`);
  - insere atividades de auditoria nos dois lados (`activity_type = 'note'` para respeitar a validação existente de tipos, com `metadata` marcando `merge`);
  - retorna resumo (contagem de tarefas/atividades movidas).
  - Observação: os triggers de sync `leads`/`contacts` continuam válidos; o contato do duplicado permanece ligado a ele (arquivado).

Frontend:

- `src/services/leads.ts`: `mergeLeads(primaryId, duplicateIds)` via `supabase.rpc`; `searchLeadsForMerge(orgId, term, excludeId)`.
- `src/hooks/useLeads.ts`: `useMergeLeads` com invalidação de `leads`, `tasks`, `activities` e métricas do funil.
- Novo `src/components/leads/MergeLeadsDialog.tsx`: seleção do principal (radio), resumo do que será transferido, busca de duplicado quando aberto pelo detalhe, botão confirmar com estado de carregamento e toasts.
- `src/components/leads/list/BulkActionsBar.tsx`: botão "Mesclar" habilitado com 2+ selecionados.
- `src/components/leads/LeadDetailSheet.tsx`: item "Mesclar com..." no menu de ações; fecha o painel e reabre no principal após concluir.

Sem alterações de RLS além da migração acima — a função roda como definer e valida permissões internamente.
