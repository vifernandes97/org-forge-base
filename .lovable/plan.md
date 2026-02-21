

# Sprint Final: Gestao de Equipe e Polish

## Resumo
Este sprint cobre duas grandes areas: (1) gestao de equipe com paginas de membros e organizacao, e (2) polish geral da aplicacao incluindo empty states, loading states, toasts, responsividade, acessibilidade e branding.

## 1. Paginas novas

### 1.1 Pagina /settings/team (TeamPage.tsx)

**Secao 1 - Membros atuais:**
- Tabela: avatar, nome, e-mail, role (badge colorido), data de entrada (`accepted_at` ou `created_at`), status (Ativo se `accepted_at`, Pendente se nao)
- Owner: nao pode ser removido nem ter role alterada
- O proprio usuario nao pode alterar sua propria role
- Select para alterar role (apenas owner/admin podem): chama `updateMemberRole(memberId, newRole)` via update em `organization_members`
- Botao remover com AlertDialog de confirmacao: deleta de `organization_members`

**Secao 2 - Convidar membro:**
- Formulario: e-mail (input) + role (select: admin, member, viewer)
- Logica ao convidar:
  1. Buscar profiles onde `email = inputEmail`
  2. Se existe: insert em `organization_members` com `user_id`, `accepted_at = now()`
  3. Se nao existe: insert com `invited_email`, `invited_at = now()`, `accepted_at = null`, `user_id = auth.uid()` (temporario, sera ajustado)
  4. Mostrar toast de sucesso com link copiavel (placeholder para convite)
- Lista de convites pendentes (where `accepted_at IS NULL`) com botao cancelar

**Problema:** `organization_members.user_id` e NOT NULL e referencia `profiles.id`. Para convites pendentes sem usuario existente, precisamos de uma abordagem. A solucao: quando o e-mail nao existe em profiles, apenas mostrar um toast informando que o usuario precisa se registrar primeiro, e criar o registro somente quando existe. Isso evita alterar o schema.

### 1.2 Pagina /settings/organization (OrganizationPage.tsx)

- Formulario: nome (input), slug (input com validacao de unicidade via `checkSlugAvailable`)
- Logo: input de URL de imagem (evita complexidade de Storage por ora)
- Salvar: `update organizations set name, slug, logo_url where id = orgId`
- Botao "Deletar organizacao":
  - Somente owner
  - AlertDialog com input: usuario deve digitar o nome da org para confirmar
  - Ao confirmar: `delete from organizations where id = orgId`
  - Redirecionar para /onboarding ou /login

### 1.3 Sidebar atualizada

Atualizar `settingsNav` em `AppSidebar.tsx`:
```text
Settings >
  Organizacao (/settings/organization) - icone Building2
  Equipe (/settings/team) - icone Users
  Funis (/settings/funnels) - icone GitBranch
  Campos Personalizados (/settings/custom-fields) - icone ListChecks
  Webhooks (/settings/webhooks) - icone Webhook
```

### 1.4 Rotas em App.tsx

Adicionar:
- `/settings/team` -> PrivateRoute + MainLayout + TeamPage
- `/settings/organization` -> PrivateRoute + MainLayout + OrganizationPage

## 2. Services e Hooks

### `src/services/team.ts` (criar)
- `getOrgMembersWithProfiles(orgId)` -- busca `organization_members` com join em `profiles`
- `inviteMember(orgId, email, role)` -- busca profile por email, cria membro
- `updateMemberRole(memberId, role)` -- update em `organization_members`
- `removeMember(memberId)` -- delete de `organization_members`
- `findProfileByEmail(email)` -- select de profiles por email

### `src/services/organizations.ts` (editar)
- `updateOrganization(orgId, data)` -- update em organizations
- `deleteOrganization(orgId)` -- delete de organizations

### `src/hooks/useTeam.ts` (criar)
- `useOrgMembers(orgId)` -- useQuery
- `useInviteMember()` -- useMutation + invalidate
- `useUpdateMemberRole()` -- useMutation + invalidate
- `useRemoveMember()` -- useMutation + invalidate

## 3. Polish - Empty States

Atualizar os seguintes componentes com empty states amigaveis (icone ilustrativo + texto + CTA quando aplicavel):

| Componente | Mensagem |
|------------|----------|
| LeadsPage (sem funil) | "Configure seu primeiro funil para comecar a gerenciar seus leads." + botao ir para /settings/funnels |
| KanbanView (sem leads) | Ja tem empty columns, manter |
| ListView (sem leads) | "Nenhum lead encontrado neste funil." - ja existe, melhorar com icone |
| TasksPage (vazio) | "Tudo em dia! Nenhuma tarefa pendente." + icone CheckCircle |
| ActivityTimeline (vazio) | "Nenhuma atividade registrada ainda." |
| FunnelsPage (vazio) | Ja tem, manter |
| CustomFieldsPage (vazio) | Ja tem, manter |
| WebhooksPage (vazio) | Ja tem na tabela |

## 4. Polish - Loading States

Verificar e garantir skeletons em:
- Dashboard: ja tem via SummaryCards e chart components ✓
- Kanban: ja tem ✓
- Lista: ja tem ✓
- LeadDetailSheet: trocar "Carregando..." por skeleton estruturado
- TasksPage: ja tem ✓
- FunnelsPage: ja tem ✓
- CustomFieldsPage: ja tem ✓
- WebhooksPage: trocar "Carregando..." por skeleton na tabela
- TeamPage: adicionar skeleton
- OrganizationPage: adicionar skeleton

## 5. Polish - Toasts

Revisar e adicionar toasts onde faltam:
- LeadFormDialog: verificar se tem toast de sucesso/erro
- KanbanView: lead movido (nao precisa toast a cada drag, seria muito)
- TeamPage: "Membro convidado", "Role atualizada", "Membro removido"
- OrganizationPage: "Organizacao atualizada", "Organizacao excluida"
- Filtros salvos: verificar se SaveFilterDialog tem toast

## 6. Polish - Responsividade

- MainLayout: ja usa SidebarProvider com collapsible ✓
- Kanban: verificar `overflow-x-auto` e touch scroll - ja tem ✓
- LeadDetailSheet: usar `w-full sm:max-w-lg` - ja tem ✓
- Dashboard: grid responsivo - ja tem ✓
- Tabelas (ListView, TeamPage, WebhooksPage): adicionar `overflow-x-auto` wrapper
- Cards do dashboard: grid responsivo ja configurado ✓

## 7. Polish - Acessibilidade

- Adicionar `aria-label` em botoes icon-only que nao tem (Pencil, Trash2, Eye, etc.)
- Inputs com labels associados (verificar formularios)
- Focus management: Sheet e Dialog ja gerenciam focus via Radix ✓
- Contraste: verificar badges e cores - usar classes do Tailwind que respeitam tema ✓

## 8. Polish - Branding

### Titulo da aba dinamico
- Criar hook `useDocumentTitle` ou efeito no `OrganizationContext` que atualiza `document.title`
- Quando logado com org: `{org.name} - CRM`
- Quando logado sem org: `CRM`
- Quando deslogado: `CRM`

### Favicon
- Atualizar `index.html` com favicon SVG inline simples (icone de funil/pipeline)
- Atualizar titulo default para "CRM"

## Arquivos criados/modificados

| Arquivo | Acao |
|---------|------|
| src/services/team.ts | Criar |
| src/hooks/useTeam.ts | Criar |
| src/pages/TeamPage.tsx | Criar |
| src/pages/OrganizationPage.tsx | Criar |
| src/services/organizations.ts | Editar (updateOrg, deleteOrg) |
| src/components/layout/AppSidebar.tsx | Editar (novos itens settings) |
| src/App.tsx | Editar (novas rotas) |
| src/pages/LeadsPage.tsx | Editar (empty state melhorado) |
| src/pages/TasksPage.tsx | Editar (empty state melhorado) |
| src/components/leads/LeadDetailSheet.tsx | Editar (skeleton loading) |
| src/pages/WebhooksPage.tsx | Editar (skeleton loading) |
| src/contexts/OrganizationContext.tsx | Editar (document.title) |
| index.html | Editar (favicon, titulo) |

## Detalhes Tecnicos

### Convite de membros
Como `user_id` em `organization_members` e NOT NULL, a abordagem sera:
1. Buscar profile por email
2. Se encontrado: criar membro normalmente com `user_id = profile.id`
3. Se nao encontrado: mostrar toast informando "Usuario nao encontrado. Ele precisa se registrar primeiro." e nao criar o registro
4. Isso simplifica e evita alteracoes de schema

Alternativa mais completa (se quisermos convites pendentes reais): seria necessario tornar `user_id` nullable ou criar tabela separada `pending_invites`. Mas isso adiciona complexidade de schema. A abordagem simples acima e adequada para o sprint final.

### Documento title
No `OrganizationContext`, adicionar um `useEffect` que atualiza `document.title`:
```text
useEffect(() => {
  document.title = organization ? `${organization.name} — CRM` : 'CRM';
}, [organization]);
```

### Favicon SVG
Usar um SVG simples em `public/favicon.svg` com icone de pipeline/funil e referenciar em `index.html`:
```text
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
```

### RLS para team operations
As operacoes de equipe ja estao cobertas pelas RLS existentes:
- SELECT em `organization_members`: membros da org podem ver ✓
- UPDATE em `organization_members`: owner/admin podem atualizar ✓
- DELETE em `organization_members`: owner/admin podem deletar ✓
- INSERT em `organization_members`: owner/admin podem inserir ✓
- SELECT em `profiles`: membros da org podem ver profiles de colegas ✓

Nao sao necessarias novas migrations.

### Skeleton no LeadDetailSheet
Substituir o "Carregando..." por:
- Skeleton no header (nome, badges)
- Skeleton nas tabs (linhas de info)
- Manter mesma estrutura visual

### Acessibilidade - aria-labels
Adicionar em:
- LeadDetailSheet: botoes Pencil ("Editar lead"), Trash2 ("Excluir lead")
- WebhooksPage: botao Eye ("Ver detalhes")
- ListView: botoes de paginacao
- Header: avatar menu ("Menu do usuario")

