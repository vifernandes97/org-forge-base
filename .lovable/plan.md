

# CRM Multi-Tenant — Fundação

## 1. Backend (Supabase Database & Security)

### Tabelas
- **organizations** — dados da organização (name, slug, logo_url)
- **profiles** — perfil do usuário vinculado a auth.users (full_name, email, avatar_url)
- **organization_members** — associação usuário↔org com role (owner, admin, member, viewer), suporte a convites

### Funções Helper
- `get_user_org_role(org_id)` — retorna a role do usuário na org
- `get_user_org_ids()` — retorna todos os org IDs do usuário

### RLS (Row Level Security)
- **profiles**: SELECT/UPDATE apenas o próprio usuário
- **organizations**: SELECT para membros; INSERT/UPDATE para owner/admin/member; DELETE para owner/admin
- **organization_members**: SELECT para membros da org; INSERT/UPDATE/DELETE para owner/admin

### Trigger
- Auto-criação de profile ao registrar usuário via auth.users

## 2. Autenticação
- Login e registro com email/senha via Supabase Auth
- AuthContext com user, session, loading, signIn, signUp, signOut
- Hook `useAuth()` para acessar o contexto

## 3. Fluxo de Onboarding
- Após primeiro login, verificar se o usuário pertence a alguma organização
- Se não, redirecionar para `/onboarding` para criar organização (nome + slug)
- Ao criar org, inserir em organizations e organization_members com role='owner'
- Redirecionar para `/dashboard`

## 4. OrganizationContext
- Armazena organização ativa do usuário
- Hook `useOrganization()` com: organization, role, isOwner, isAdmin, isMember, isViewer
- Suporte a múltiplas orgs com persistência em localStorage

## 5. Rotas e Proteção
- `/login` e `/register` — rotas públicas
- `/onboarding` — requer auth, sem org
- Todas as demais — requer auth + org
- Componentes `PrivateRoute` e `OnboardingRoute` como wrappers

## 6. UI — Layout Base
- **Página de Login** — email + senha, link para registro
- **Página de Registro** — nome, email, senha
- **Página de Onboarding** — nome da org, slug com validação
- **Layout principal** — Sidebar escura com navegação placeholder + Header com avatar, nome, org ativa e logout
- **Dashboard** — página placeholder "em construção"
- **Toggle claro/escuro** no Header
- Design limpo e profissional: cores slate/zinc, accent azul (blue-600), transições suaves

## 7. Estrutura de Pastas
Organização em: components (ui, layout, shared), hooks, lib, pages, types, contexts, services — conforme especificado

