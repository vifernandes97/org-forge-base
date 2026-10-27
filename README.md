# Org Connect (CRM)

Documentação para manutenção e suporte:
- `AGENTS.md` — regras do domínio que o código deve seguir.
- `docs/MIGRACAO.md` — infraestrutura na VPS (Easypanel), deploy, túnel do banco, webhooks.
- `docs/WHATSAPP.md` — orquestrador WhatsApp → CRM com IA: arquitetura, banco, filas, produção (§14), diagnóstico (§15) e dados alterados (§16).
- `roadmap.md` — o que está feito e o que falta.

---

# Org Connect

Você é um engenheiro de software sênior especializado em Supabase e arquitetura multi-tenant. Crie a fundação do projeto — um CRM multi-tenant.

## Stack obrigatória

- React 18+ com TypeScript (strict mode)

- Supabase (Auth, Database, RLS)

- Tailwind CSS + shadcn/ui

- TanStack Query (React Query) para data fetching

- React Router v6 para rotas

- react-hook-form + zod para validação

- date-fns para datas

- Lucide React para ícones

## Estrutura de pastas

Organize o projeto assim:

src/

├── components/

│   ├── ui/          → componentes shadcn/ui

│   ├── layout/      → Sidebar, Header, PageWrapper

│   └── shared/      → componentes reutilizáveis

├── hooks/           → custom hooks (useAuth, useOrganization, etc.)

├── lib/             → supabaseClient, utils, constants

├── pages/           → páginas por rota

├── types/           → interfaces e types TypeScript

├── contexts/        → AuthContext, OrganizationContext

└── services/        → camada de acesso a dados (queries Supabase)

## Banco de dados — Criar TODAS estas tabelas no Supabase:

### organizations

- id (uuid, PK, default gen_random_uuid())

- name (text, not null)

- slug (text, unique, not null)

- logo_url (text, nullable)

- created_at (timestamptz, default now())

- updated_at (timestamptz, default now())

### profiles

- id (uuid, PK, referencia auth.users.id)

- full_name (text, not null)

- avatar_url (text, nullable)

- email (text, not null)

- created_at (timestamptz, default now())

- updated_at (timestamptz, default now())

### organization_members

- id (uuid, PK, default gen_random_uuid())

- organization_id (uuid, FK → organizations.id, not null)

- user_id (uuid, FK → profiles.id, not null)

- role (text, not null, check: role in ('owner','admin','member','viewer'))

- invited_email (text, nullable)

- invited_at (timestamptz, nullable)

- accepted_at (timestamptz, nullable)

- created_at (timestamptz, default now())

- UNIQUE(organization_id, user_id)

## RLS (Row Level Security) — CRÍTICO

Habilitar RLS em TODAS as tabelas. A lógica base para TODAS as tabelas que têm organization_id:

- SELECT: usuário autenticado é membro da organization_id do registro

- INSERT: usuário autenticado é membro da organization_id sendo inserida E tem role 'owner', 'admin', ou 'member'

- UPDATE: mesma lógica do INSERT

- DELETE: somente 'owner' ou 'admin'

Para a tabela profiles: SELECT/UPDATE somente o próprio usuário.

Para organization_members: SELECT para qualquer membro da org; INSERT/UPDATE/DELETE para owner ou admin.

Crie uma função helper no Supabase:

CREATE FUNCTION public.get_user_org_role(org_id uuid)

RETURNS text AS $$ ... $$ — retorna a role do auth.uid() naquela org.

Crie outra função:

CREATE FUNCTION public.get_user_org_ids()

RETURNS SETOF uuid AS $$ ... $$ — retorna todos organization_ids do auth.uid().

## Autenticação

- Supabase Auth com email/senha.

- Trigger no Supabase: ao criar user em auth.users, criar automaticamente um registro em profiles.

- AuthContext com: user, session, loading, signIn, signUp, signOut.

- Hook useAuth() que expõe o contexto.

## Fluxo de onboarding pós-registro

1. Usuário se registra → profiles é criado automaticamente.

2. Ao fazer primeiro login, verificar se o usuário é membro de alguma organização.

3. Se NÃO, redirecionar para /onboarding onde ele cria uma organização (name, slug).

4. Ao criar org, inserir em organizations E em organization_members com role='owner'.

5. Após isso, redirecionar para /dashboard.

## Rotas e proteção

- /login — pública

- /register — pública

- /onboarding — protegida (requer auth, mas SEM org)

- Todas as outras — protegida (requer auth E org)

- Criar PrivateRoute e OnboardingRoute como wrappers.

## OrganizationContext

- Armazena a organização ativa do usuário.

- Hook useOrganization() retorna: organization, role, isOwner, isAdmin, isMember, isViewer.

- Se o usuário pertence a múltiplas orgs, usar a última acessada (localStorage).

## UI neste sprint

Crie apenas o layout base funcional:

- Página de Login (email + senha, link para registro)

- Página de Registro (nome, email, senha)

- Página de Onboarding (nome da org, slug)

- Layout principal com Sidebar (navegação placeholder) + Header (avatar, nome, org, logout)

- Página Dashboard com texto "Dashboard — em construção"

- Tema claro/escuro com toggle no Header

Design: limpo, profissional, cores neutras (slate/zinc) com accent em azul (blue-600). Sidebar escura. Transições suaves.

NÃO crie nenhuma funcionalidade de leads, funis, ou campos ainda. Apenas a fundação.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://org-forge-base.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/fbaa8793-8e3c-447c-8814-cb4c8d7eb0e0).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
