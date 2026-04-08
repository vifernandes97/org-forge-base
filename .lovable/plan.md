

# Arquivamento em Massa de Leads

## Resumo
Adicionar um botão "Arquivar" na barra de ações em massa que abre um dialog para selecionar o motivo de arquivamento. O motivo selecionado será aplicado a todos os leads selecionados.

## Mudanças

### 1. `src/services/leads.ts` — nova função `bulkArchiveLeads`
```ts
export async function bulkArchiveLeads(leadIds: string[], reasonId: string) {
  const { error } = await supabase
    .from('leads')
    .update({ archived_at: new Date().toISOString(), archive_reason_id: reasonId, status: 'inactive' })
    .in('id', leadIds);
  if (error) throw error;
}
```

### 2. `src/hooks/useLeads.ts` — novo hook `useBulkArchiveLeads`
Mutation que chama `bulkArchiveLeads` e invalida as queries `leads-kanban` e `leads-list`.

### 3. `src/components/leads/list/BulkActionsBar.tsx`
- Importar `useActiveArchiveReasons` e `useBulkArchiveLeads`.
- Adicionar um `Select` com ícone `Archive` e placeholder "Arquivar", listando os motivos de arquivamento ativos.
- Ao selecionar um motivo, chamar `bulkArchiveLeads` com os IDs selecionados e o motivo escolhido.
- Exibir toast de sucesso e limpar seleção.

| Arquivo | Ação |
|---------|------|
| `src/services/leads.ts` | Nova função `bulkArchiveLeads` |
| `src/hooks/useLeads.ts` | Novo hook `useBulkArchiveLeads` |
| `src/components/leads/list/BulkActionsBar.tsx` | Select de arquivamento em massa |

