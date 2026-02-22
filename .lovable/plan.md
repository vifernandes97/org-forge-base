

# Arquivamento de Leads com Motivos Configuráveis

## Resumo
Adicionar funcionalidade de arquivar leads com selecao obrigatoria de motivo, e uma pagina de configuracoes para gerenciar os motivos de arquivamento. Leads arquivados saem do Kanban/lista e podem ser filtrados.

## 1. Migration SQL

### Novas colunas na tabela `leads`
- `archived_at` (timestamptz, nullable, default null) -- quando foi arquivado
- `archive_reason_id` (uuid, nullable, FK para `archive_reasons.id` ON DELETE SET NULL)

### Nova tabela `archive_reasons`
```text
archive_reasons
- id (uuid, PK, default gen_random_uuid())
- organization_id (uuid, FK -> organizations.id ON DELETE CASCADE, not null)
- label (text, not null) -- ex: "Contratou concorrente"
- position (integer, not null, default 0)
- is_active (boolean, not null, default true)
- created_at (timestamptz, default now())
```

RLS: mesma logica multi-tenant (SELECT para membros, INSERT/UPDATE/DELETE para owner/admin).

### Motivos padrao
Inserir via migration usando um trigger ou funcao: nao e possivel pois depende do `organization_id`. Em vez disso, os motivos padrao serao criados automaticamente no frontend quando a lista estiver vazia (seed on first access), ou melhor, serao criados junto com a organizacao.

**Abordagem escolhida:** Alterar a funcao `create_organization_with_owner` para tambem criar os 3 motivos padrao ao criar uma org. Para orgs existentes, o frontend mostrara um botao "Criar motivos padrao" ou os criara automaticamente na primeira vez que abrir a pagina de configuracao.

## 2. Alteracoes no schema existente

### Tabela `leads`
- Adicionar coluna `archived_at` (timestamptz, nullable)
- Adicionar coluna `archive_reason_id` (uuid, nullable, FK -> archive_reasons.id ON DELETE SET NULL)

### Funcao `create_organization_with_owner`
Alterar para inserir 3 motivos padrao:
1. "Contratou concorrente" (position 0)
2. "Nao tem perfil de cliente ideal" (position 1)
3. "Demora no follow-up" (position 2)

## 3. Services e Hooks

### `src/services/archiveReasons.ts` (criar)
- `getArchiveReasons(orgId)` -- lista motivos ativos da org
- `createArchiveReason(orgId, label)` -- insert
- `updateArchiveReason(id, data)` -- update (label, is_active, position)
- `deleteArchiveReason(id)` -- delete
- `seedDefaultReasons(orgId)` -- insere os 3 motivos padrao se nao existirem

### `src/services/leads.ts` (editar)
- `archiveLead(id, reasonId)` -- update: `archived_at = now(), archive_reason_id = reasonId`
- `unarchiveLead(id)` -- update: `archived_at = null, archive_reason_id = null`
- Alterar `getLeadsByFunnel` e `getLeadsListPaginated` para filtrar `archived_at IS NULL` por padrao (leads ativos)

### `src/hooks/useArchiveReasons.ts` (criar)
- `useArchiveReasons()` -- useQuery
- `useCreateArchiveReason()` -- useMutation
- `useUpdateArchiveReason()` -- useMutation
- `useDeleteArchiveReason()` -- useMutation

### `src/hooks/useLeads.ts` (editar)
- `useArchiveLead()` -- useMutation (invalida queries de leads)
- `useUnarchiveLead()` -- useMutation

## 4. Interface - Arquivar Lead

### No `LeadDetailSheet.tsx`
- Adicionar botao "Arquivar" (icone Archive) no header, ao lado dos botoes editar/excluir
- Ao clicar, abre um AlertDialog com:
  - Titulo: "Arquivar lead"
  - Descricao: "Selecione o motivo do arquivamento"
  - Select com motivos de arquivamento da org
  - Botoes Cancelar / Arquivar
- Ao confirmar: chama `archiveLead(leadId, reasonId)`, registra atividade, toast de sucesso, fecha sheet

### No `KanbanCard.tsx` e `ListView.tsx`
- Adicionar opcao "Arquivar" no menu de contexto ou acoes rapidas (se existirem)
- Leads arquivados nao aparecem no Kanban nem na lista por padrao

### Indicador de lead arquivado
- Se um lead arquivado for aberto (ex: via link direto), mostrar banner no topo do sheet: "Este lead esta arquivado. Motivo: {motivo}" + botao "Desarquivar"

## 5. Interface - Filtro de Arquivados

### No `LeadFilterBar.tsx`
- Adicionar toggle ou checkbox "Mostrar arquivados" que inclui leads arquivados nos resultados
- Quando ativo, leads arquivados aparecem com visual diferenciado (opacidade reduzida ou badge "Arquivado")

## 6. Interface - Configuracao de Motivos

### Nova pagina `src/pages/ArchiveReasonsPage.tsx`
- Titulo: "Motivos de Arquivamento"
- Lista dos motivos com:
  - Label (editavel inline ou via dialog)
  - Toggle ativo/inativo
  - Botao excluir (com confirmacao)
- Botao "+ Novo Motivo"
- Se lista vazia: botao "Criar motivos padrao" que insere os 3

### Sidebar
- Adicionar "Motivos de Arquivamento" ao settingsNav com icone `ArchiveX` ou `Archive`

### Rota
- `/settings/archive-reasons` -> ArchiveReasonsPage

## 7. Atividade de arquivamento

Ao arquivar um lead, registrar atividade:
- `activity_type`: usar 'note' (ja suportado pelo trigger de validacao)
- `title`: "Lead arquivado"
- `description`: "Motivo: {label do motivo}"
- `metadata`: `{ source: 'archive', reason_id, reason_label }`

Ao desarquivar:
- `title`: "Lead desarquivado"

## Arquivos criados/modificados

| Arquivo | Acao |
|---------|------|
| supabase/migrations/xxx.sql | Criar (tabela archive_reasons, colunas em leads, RLS, update create_organization_with_owner) |
| src/services/archiveReasons.ts | Criar |
| src/hooks/useArchiveReasons.ts | Criar |
| src/pages/ArchiveReasonsPage.tsx | Criar |
| src/services/leads.ts | Editar (archiveLead, unarchiveLead, filtro archived_at) |
| src/hooks/useLeads.ts | Editar (useArchiveLead, useUnarchiveLead) |
| src/components/leads/LeadDetailSheet.tsx | Editar (botao arquivar, banner arquivado) |
| src/components/leads/kanban/KanbanView.tsx | Editar (filtrar arquivados) |
| src/components/layout/AppSidebar.tsx | Editar (novo item settings) |
| src/App.tsx | Editar (nova rota) |
| src/types/index.ts | Editar (interface ArchiveReason, campos em Lead) |
| src/components/leads/filters/LeadFilterBar.tsx | Editar (toggle mostrar arquivados) |

## Detalhes Tecnicos

### Filtro de arquivados nas queries
Adicionar `.is('archived_at', null)` nas funcoes `getLeadsByFunnel` e `getLeadsListPaginated` por padrao. Quando o filtro "mostrar arquivados" estiver ativo, remover esse filtro ou usar `.not('archived_at', 'is', null)` para mostrar apenas arquivados.

### LeadFilters (types)
Adicionar campo `show_archived?: boolean` ao tipo `LeadFilters`.

### Motivos padrao para orgs existentes
Na pagina `ArchiveReasonsPage`, ao carregar, se a lista estiver vazia, mostrar um card com botao "Criar motivos padrao" que chama `seedDefaultReasons(orgId)`. Isso insere:
1. "Contratou concorrente"
2. "Nao tem perfil de cliente ideal"
3. "Demora no follow-up"

### Validacao ao arquivar
O motivo e obrigatorio. O select nao pode estar vazio ao confirmar o arquivamento.

