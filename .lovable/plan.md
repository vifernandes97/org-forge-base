

# Edição Inline no Drawer do Lead

## Objetivo
Transformar os campos do painel esquerdo do drawer em campos editáveis inline (click-to-edit), sem precisar abrir o formulário de edição separado.

## Abordagem
Criar um componente `InlineEditField` reutilizável que alterna entre modo exibição e edição ao clicar. Cada campo no painel esquerdo usará esse componente para permitir edição direta.

## Mudanças

### 1. Novo componente `src/components/leads/InlineEditField.tsx`
- Componente genérico click-to-edit com variantes: `text`, `textarea`, `currency`, `select`
- Ao clicar no valor, transforma em input; ao fazer blur ou Enter, salva; Escape cancela
- Indicador visual sutil (ícone de lápis ou borda pontilhada) no hover

### 2. Atualizar `src/components/leads/LeadDetailSheet.tsx`
- Substituir os campos estáticos do painel esquerdo por `InlineEditField`:
  - **Nome** (header) → input text inline
  - **Email** → input text
  - **Telefone** → input text
  - **Empresa** → input text
  - **Valor** → input currency (formata como R$)
  - **Responsável** → select com membros do time
  - **Prioridade** → select com opções
  - **Fonte** → input text
  - **Notas** → textarea inline
- Cada campo chama `useUpdateLead` ao salvar
- Importar `useTeamMembers` para popular o select de responsável
- Campos que não têm valor mostram placeholder clicável "Adicionar..."

### Comportamento
- Hover: borda pontilhada + ícone de lápis discreto
- Click: transforma em input com foco automático
- Enter/blur: salva via `updateLeadMut.mutateAsync`
- Escape: cancela edição
- Toast de sucesso/erro ao salvar

| Arquivo | Mudança |
|---------|---------|
| `src/components/leads/InlineEditField.tsx` | Novo componente click-to-edit |
| `src/components/leads/LeadDetailSheet.tsx` | Substituir campos estáticos por inline edit |

