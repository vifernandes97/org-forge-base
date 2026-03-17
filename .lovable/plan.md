

# Exibir `company_name` como nome principal do lead

## Objetivo
Substituir a exibição do campo `name` pelo campo `company_name` em todos os pontos da interface onde o nome do lead aparece como identificador principal. O campo `name` continua existindo no banco e no formulário, mas a UI prioriza `company_name`.

## Lógica de exibição
Usar fallback: `lead.company_name || lead.name` — se `company_name` estiver preenchido, exibe ele; caso contrário, mantém `name`.

## Arquivos a alterar

| Arquivo | O que muda |
|---------|------------|
| `LeadDetailSheet.tsx` | Título no topo do drawer: `company_name \|\| name` |
| `KanbanCard.tsx` | Nome no card: `company_name \|\| name` |
| `DragOverlayCard.tsx` | Nome no overlay: `company_name \|\| name` |
| `ListView.tsx` | Coluna Nome na tabela: `company_name \|\| name` |
| `LeadCard.tsx` | Nome exibido: `company_name \|\| name` |
| `TaskItem.tsx` | Link do lead: `lead.company_name \|\| lead.name` |

Todos os pontos usam a mesma expressão: `lead.company_name || lead.name`.

