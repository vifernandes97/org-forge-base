

# Correções no Drawer de Detalhes do Lead

## 1. Ícones repetidos no painel "Contato"

Atualmente `Building2` é usado tanto em **Empresa** quanto em **Razão Social**. Vou diferenciar:

- **Empresa** → manter `Building2` (prédio)
- **Razão Social** → usar `BadgeCheck` ou `FileBadge` (documento/registro formal)

Arquivo: `src/components/leads/LeadDetailSheet.tsx`

## 2. Tooltip com label do campo no hover

Hoje o usuário só vê o ícone + o valor (ou placeholder em itálico). Não fica claro o que cada linha representa, especialmente quando preenchida.

**Mudança em `src/components/leads/InlineEditField.tsx`:**
- Adicionar prop `label?: string` (já existe na interface mas não é usada).
- Envolver o componente em modo display com `<Tooltip>` do shadcn (`@/components/ui/tooltip`) exibindo a `label` ao passar o mouse.
- Aplicar somente quando `label` for fornecida.

**Mudança em `src/components/leads/LeadDetailSheet.tsx`:**
- Passar `label` em cada `InlineEditField` do painel esquerdo: "Email", "Telefone (WhatsApp)", "Empresa", "Razão Social", "Instagram", "Valor", "Responsável", "Fonte", "Prioridade", "Qualificação".

## 3. Migrar "Média de festas" para Campo Personalizado da org oniplataforma

Hoje `media_de_festas` é uma coluna nativa da tabela `leads` usada por todas as orgs, mas é uma necessidade exclusiva do `vinicius@oniplataforma.com.br` (org `oniplataforma`, id `ff7bbd31-…`).

### 3.1. Migração de dados (SQL)

Executar uma migration que:

1. Cria a definição de campo personalizado para a org oniplataforma:
   ```sql
   INSERT INTO custom_field_definitions (organization_id, field_name, field_label, field_type, position)
   VALUES ('ff7bbd31-e907-4a2e-8d9f-ad1d53a35aaa', 'media_de_festas', 'Média de festas', 'text', 100)
   RETURNING id;
   ```
2. Copia os 142 valores existentes de `leads.media_de_festas` para `custom_field_values` referenciando o `id` retornado acima (apenas para leads dessa org).
3. Remove a coluna `media_de_festas` da tabela `leads` (`ALTER TABLE leads DROP COLUMN media_de_festas`).

### 3.2. Limpeza de código

- **`src/components/leads/LeadDetailSheet.tsx`**: remover o `InlineEditField` de "Média de festas" (linhas 359-365) e o ícone `PartyPopper` do import. O valor passará a aparecer automaticamente na seção "Campos Personalizados" do drawer (já implementada nas linhas 468-486).
- **`src/components/leads/LeadFormDialog.tsx`**: remover o campo `media_de_festas` do schema Zod e do formulário.
- **`src/services/leads.ts`**: remover `media_de_festas` da interface `LeadInput`.
- **`src/pages/LeadsPage.tsx`** (export CSV): remover a coluna se existir.
- **`supabase/functions/inbound-webhook/index.ts`**: remover `media_de_festas` do `fieldMapping` e dos arrays/objetos de mapeamento. (Caso se queira manter compatibilidade com webhooks já existentes da oniplataforma, fica como tarefa futura — por ora será capturado como campo "extra" e gravado em `notes`.)
- `src/types/index.ts` e `src/integrations/supabase/types.ts` serão atualizados automaticamente após a migration.

## Tabela de mudanças

| Arquivo | Ação |
|---------|------|
| `supabase/migrations/<nova>.sql` | Criar custom field, copiar valores, dropar coluna |
| `src/components/leads/InlineEditField.tsx` | Suporte a tooltip via prop `label` |
| `src/components/leads/LeadDetailSheet.tsx` | Diferenciar ícone de Razão Social, passar `label` em todos os campos, remover bloco Média de festas e import `PartyPopper` |
| `src/components/leads/LeadFormDialog.tsx` | Remover campo `media_de_festas` do schema/form |
| `src/services/leads.ts` | Remover `media_de_festas` de `LeadInput` |
| `supabase/functions/inbound-webhook/index.ts` | Remover mapeamento de `media_de_festas` |

