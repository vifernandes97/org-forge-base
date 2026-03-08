

# Adicionar Status ao Lead (Em andamento / Ganho / Inativo)

## Conceito
Adicionar coluna `status` na tabela `leads` com 3 valores possíveis:
- **`open`** — "Em andamento" (padrão para leads ativos no funil)
- **`won`** — "Ganho" (marcado manualmente pelo usuário)
- **`inactive`** — "Inativo" (definido automaticamente ao arquivar)

## Mudanças

### 1. Migração de banco de dados
- Adicionar coluna `status text NOT NULL DEFAULT 'open'` na tabela `leads`
- Criar trigger de validação (`status IN ('open', 'won', 'inactive')`)
- Atualizar leads já arquivados (`UPDATE leads SET status = 'inactive' WHERE archived_at IS NOT NULL`)

### 2. Atualizar lógica de arquivar/desarquivar
**`src/services/leads.ts`**: Na função `archiveLead`, incluir `status: 'inactive'`; na `unarchiveLead`, incluir `status: 'open'`.

### 3. Adicionar ação "Marcar como Ganho" / "Reabrir"
**`src/components/leads/LeadDetailSheet.tsx`**: Adicionar botão no header do detalhe do lead para marcar como ganho (ou reabrir se já ganho). Ao marcar como ganho, chamar `updateLead(id, { status: 'won' })`.

### 4. Criar componente de badge de status
**`src/components/leads/StatusBadge.tsx`** (novo): Badge visual com cores distintas:
- Em andamento → azul
- Ganho → verde
- Inativo → cinza

### 5. Exibir status nos cards e lista
- **`src/components/leads/kanban/KanbanCard.tsx`**: Exibir `StatusBadge`
- **`src/components/leads/LeadCard.tsx`**: Exibir `StatusBadge`
- **`src/components/leads/list/ListView.tsx`**: Coluna de status na tabela

### 6. Atualizar tipo TypeScript
**`src/types/index.ts`**: Adicionar `status: LeadStatus` ao tipo `Lead` e criar `type LeadStatus = 'open' | 'won' | 'inactive'`.

### Arquivos alterados
| Arquivo | Ação |
|---------|------|
| Migração SQL | Criar — adicionar coluna + trigger |
| `src/types/index.ts` | Editar — adicionar `LeadStatus` |
| `src/services/leads.ts` | Editar — atualizar archive/unarchive |
| `src/components/leads/StatusBadge.tsx` | Criar |
| `src/components/leads/LeadDetailSheet.tsx` | Editar — botão ganho/reabrir |
| `src/components/leads/kanban/KanbanCard.tsx` | Editar — exibir status |
| `src/components/leads/LeadCard.tsx` | Editar — exibir status |
| `src/components/leads/list/ListView.tsx` | Editar — coluna status |

