

# Ajuste do Menu Lateral — Consolidar Configurações

## Objetivo
Remover do sidebar os itens: Equipe, Campos Personalizados, Webhooks de Saída, Webhooks de Entrada e Motivos de Arquivamento. Esses itens passam a ser abas/seções dentro de uma única página "Configurações". No sidebar ficam apenas: Dashboard, Leads, Tarefas, Funis e Configurações (link único).

## Mudanças

### 1. Criar página `SettingsPage.tsx`
Nova página com navegação por **Tabs** contendo:
- **Organização** (conteúdo atual de OrganizationPage)
- **Equipe** (conteúdo atual de TeamPage)
- **Campos Personalizados** (conteúdo atual de CustomFieldsPage)
- **Webhooks de Saída** (conteúdo atual de WebhooksPage)
- **Webhooks de Entrada** (conteúdo atual de InboundWebhooksPage)
- **Motivos de Arquivamento** (conteúdo atual de ArchiveReasonsPage)

A tab ativa será controlada via query param ou estado local.

### 2. Atualizar `AppSidebar.tsx`
O grupo "Configurações" passa a ter apenas 2 itens:
- **Funis** → `/settings/funnels`
- **Configurações** → `/settings` (nova rota única)

### 3. Atualizar `App.tsx`
- Adicionar rota `/settings` → `SettingsPage`
- Manter rotas de Funis (`/settings/funnels`, `/settings/funnels/:id`)
- Manter sub-rotas de webhooks de entrada (`/settings/inbound-webhooks/logs`, `/settings/inbound-webhooks/:id`) pois são páginas de edição separadas
- Remover rotas individuais: `/settings/team`, `/settings/custom-fields`, `/settings/webhooks`, `/settings/inbound-webhooks`, `/settings/organization`, `/settings/archive-reasons`

### Arquivos alterados
| Arquivo | Ação |
|---------|------|
| `src/pages/SettingsPage.tsx` | Criar — página com Tabs |
| `src/components/layout/AppSidebar.tsx` | Editar — simplificar menu |
| `src/App.tsx` | Editar — ajustar rotas |

