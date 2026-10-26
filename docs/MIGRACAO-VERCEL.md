# Migração: Lovable Cloud (Supabase) → Vercel + Neon

> Aberto em 2026-10-25. Decisões do dono: banco no **Neon via Vercel**;
> **manter o SQL** (RLS e funções) e trocar só o que é Supabase; auth própria
> com **Better Auth**. Os dados saem pelo export oficial do Lovable Cloud.

## 1. O que existe hoje (medido no repo)

| Peça | Hoje | Tamanho |
| --- | --- | --- |
| Front | Vite + React SPA, `supabase-js` direto nos `services/` | 25 arquivos; 22 tabelas; ~300 chamadas de query builder (85 `.filter`, embeds com `!inner` e FK nomeada, 20 com `count`) |
| RPC | `supabase.rpc(...)` | 23 funções chamadas pelo front |
| Regra de acesso | RLS + funções `SECURITY DEFINER` | 97 policies, 61 funções, 49 usos de `auth.uid()`, 2 de `auth.role()` |
| Auth | Supabase Auth (e-mail + senha, auto-confirm) | `signUp`, `signInWithPassword`, `onAuthStateChange`, `getSession`, `getUser`, `signOut` |
| Usuário no banco | `profiles.id → auth.users(id)` + trigger `on_auth_user_created` (`handle_new_user`) | 1 FK, 1 trigger |
| Edge functions | `inbound-webhook` (752 l.), `fire-webhook` (381 l.), ambas com service role | 2 |
| Saída de webhook | trigger `dispatch_pending_webhook` em `webhook_logs` → `pg_net` → `fire-webhook` com a anon key embutida | 1 trigger |
| Extensões | `unaccent`, `pg_net` | — |
| Storage / Realtime | não usados | — |

## 2. Arquitetura alvo

```
Navegador (SPA na Vercel)
 ├─ /api/auth/*        → Vercel Function: Better Auth (sessão + plugin jwt, JWKS)
 ├─ Neon Data API      → PostgREST-compatível; valida o JWT pelo nosso JWKS;
 │                       RLS com auth.uid() (pg_session_jwt)
 ├─ /api/inbound-webhook → Vercel Function (porta da edge function, conexão de serviço)
 └─ /api/fire-webhook    → Vercel Function interna (só cron/servidor, nunca anon)
Neon Postgres (via Vercel Marketplace)
```

**Por que a Neon Data API.** Ela fala o mesmo dialeto do PostgREST que o
`supabase-js` usa (o `supabase-js` é o `postgrest-js` por baixo), e o
`pg_session_jwt` dela já fornece `auth.uid()` (uuid, do `sub`) e
`auth.user_id()`. Com isso as ~300 chamadas do front e as 97 policies **não
mudam**: troca-se o cliente, não as consultas. A alternativa, reescrever cada
consulta como endpoint próprio, é o trabalho de semanas que queremos evitar.

**Por que Better Auth próprio, e não o Neon Auth gerenciado.** Precisamos
(a) manter os **mesmos ids** dos usuários (todas as FKs apontam para eles) e
(b) importar os **hashes bcrypt** do Supabase para ninguém redefinir senha. No
Better Auth próprio as duas coisas são configuração (`generateId` uuid +
`password.verify` aceitando bcrypt). No gerenciado, não há garantia de
importação.

## 3. Riscos a provar antes de migrar (Fase 0 — spike)

1. **Compatibilidade da Data API** com o que o front usa de verdade: embeds
   com FK nomeada (`profiles!leads_assigned_to_fkey`), `!inner`,
   `.filter()` em coluna embutida, `.or()`, `count: 'exact'`, `range`, e
   `rpc` com `jsonb`. Se algo faltar → plano B: o mesmo motor
   PostgREST-compatível rodando numa Vercel Function nossa (subzero), com o
   mesmo JWT e o mesmo RLS.
2. **JWKS próprio aceito pela Data API** (provedor JWT "outro", `sub` = uuid
   do usuário, `role` = `authenticated`).
3. **Leitura sem login:** `get_invite_by_token` é `GRANT ... TO anon`. Na Data
   API o papel é `anonymous`: regravar os `GRANT`/`REVOKE` de `anon` para ele.
4. **`auth.role()`** (2 funções aceitam `service_role`): shim em SQL lendo o
   claim `role`; a conexão de serviço das Functions seta o claim.
5. **`pg_net` não existe no Neon.** A saída de webhook vira fila: o trigger
   continua gravando `webhook_logs` com `pending_dispatch` (já é assim), e um
   **Vercel Cron** despacha. Cron por minuto exige o plano **Pro** da Vercel
   (no Hobby, só 1×/dia) — decisão do dono.

### Achados do ensaio local (2026-10-25, Postgres 18.6)

- `neon/aplicar-schema.sh <url> [shims]` aplica as 54 migrações (Supabase,
  depois Drizzle) sobre `neon/00_supabase_shim.sql` e fecha com `neon/9*.sql`.
  Passa inteiro em PG 18.
- **Drift:** `execute_automations()` existe em produção e nenhuma migração a
  cria. O replay usa um stub; **o schema de verdade vem do export**, e o
  export será comparado com o replay (`pg_dump --schema-only` dos dois).
- Duas migrações de dados miram a organização da Oniplataforma
  (`ff7bbd31-…`); o replay a cria vazia antes delas.
- Sem os `GRANT` padrão do Supabase (default privileges a
  `anon`/`authenticated`/`service_role`), tudo dá "permission denied": o shim
  os recria.
- RLS conferido: a pessoa A cria organização e funil pelas RPCs e vê 1/1/4
  (org/funil/etapas); a pessoa B vê 0/0/0; anônimo vê 0 e não executa
  `accept_invite`.
- Neon `dev`: São Paulo, PG 18.6, `pg_session_jwt` 0.5.0 disponível, sem
  `pg_net`.

### Achados no Neon `dev` (2026-10-25)

- O schema `auth` é da Data API (`cloud_admin`): tem `auth.uid()`,
  `auth.jwt()`, `auth.user_id()`, e não aceita objetos nossos. Por isso
  `auth.users` → `app_auth.users` e `auth.role()` →
  `app_auth.request_role()`, trocados por `neon/traduzir.sed` (no replay e,
  depois, no schema do export).
- A Data API **exige JWT em toda requisição**, inclusive do papel anônimo.
  Única leitura sem login: `get_invite_by_token` (página do convite) → vira
  Function nossa (`/api/invite`).
- O pooler do Neon recusa `search_path` na conexão. O Better Auth usa um
  papel próprio, `app_auth_svc`, com `search_path = app_auth` no papel e
  acesso só a esse schema (`neon/criar-papel-auth.sh`; senha só no
  `.env.local`).
- `generateId: 'uuid'` → o id do usuário vem do default do banco.
- Front: só `src/integrations/supabase/client.ts` mudou. Ele exporta o mesmo
  `supabase` (from/rpc pelo `@supabase/postgrest-js` 2.97.0, o mesmo que o
  `supabase-js` usava; auth no formato do supabase-js sobre o Better Auth;
  `functions.invoke` → `/api/<nome>`). `@supabase/supabase-js` saiu.
- Better Auth testado em processo contra a `dev`: cadastro e login 200, JWT
  RS256 com `kid`, `/jwks` publicado, profile criado pelo trigger.
- **Data API intermitente ("jwk not found" em ~60%)** com o JWKS servido pela
  Function (`/api/auth/jwks`), mesmo com uma chave só, `kid` igual ao do
  token e o Neon Auth removido. Teste: JWKS **estático** em
  `public/.well-known/jwks.json` (CDN, sem Function nem banco). Se a chave
  do `app_auth.jwks` for trocada, este arquivo tem que ser regerado
  (`curl …/api/auth/jwks`) e publicado antes de o token novo sair.
- **Deploy durante a migração:** a Production Branch da Vercel aponta para
  `migracao-vercel` (preview tem proteção de login, e o Neon precisa ler o
  JWKS). As env de Production apontam para a branch `dev` do Neon. Na
  virada, volta para `main`.

## 4. Fases

### Fase 0 — Spike (1 tela, ponta a ponta)
- Projeto Neon pela Vercel (região `sa-east-1` se houver; senão a mais perto),
  branch `dev`.
- Restaurar **só o schema** (`supabase/migrations` + `drizzle/migrations`) no
  Neon, com os ajustes da Fase 1.
- Better Auth numa Function + Data API com o JWKS dele.
- Uma tela real (Negócios/Kanban, a que mais usa embeds) lendo e escrevendo
  pela Data API. **Critério:** os 5 riscos acima respondidos.

### Fase 1 — Banco
- Schema `auth` compatível: tabela `auth.users` deixa de existir; `profiles.id`
  passa a referenciar o `user` do Better Auth (FK nova; migração aditiva).
- `handle_new_user` vira hook `user.create.after` do Better Auth (ou trigger
  na tabela `user`).
- Shims: `auth.role()`; `anon` → `anonymous`; remover `dispatch_pending_webhook`
  via `pg_net` (o insert em `webhook_logs` fica).
- `unaccent` no Neon; conferir `search_path` das funções `SECURITY DEFINER`.

### Fase 2 — Auth e cliente no front
- `src/integrations/supabase/client.ts` → cliente novo com a **mesma
  superfície** (`from`, `rpc`) sobre `@neondatabase/postgrest-js`, pegando o
  JWT do Better Auth (renovação antes dos ~15 min).
- `services/auth.ts` e `AuthContext` → `better-auth/react` (sessão, login,
  cadastro, sair). Remover `previewAuthStorage` (só existe para o editor do
  Lovable).
- Tipos: regerar `types.ts` a partir do Neon (mesmo formato, para os
  `services/` não mudarem).

### Fase 3 — Webhooks
- `inbound-webhook` → `api/inbound-webhook.ts` (Node), mesma lógica, conexão
  de serviço (`postgres`), **mesmo contrato** (método, corpo, token).
  A URL muda: atualizar na Oniplataforma no dia da virada.
- `fire-webhook` → `api/fire-webhook.ts`, chamado só por: botão "testar"
  (com sessão) e Cron (com `CRON_SECRET`). Hoje qualquer um com a anon key
  pública pode chamá-lo com uma `webhook_url` arbitrária — corrigido de
  graça na migração.
- `api/cron/dispatch-webhooks.ts` + `vercel.json` (`crons`).

### Fase 4 — Dados (ensaio)
- Export do Lovable Cloud (Cloud → Database → Settings → Export; 1 por 24 h).
- Restaurar o `public` no Neon `dev`; limpar o que é Supabase (papéis
  `supabase_*`, schemas `storage`, `realtime`, `graphql`, `vault`, grants a
  `authenticator`).
- `auth.users` → `user` + `account` do Better Auth, **mesmo id**, hash bcrypt
  em `account.password` (`providerId = 'credential'`).
- Conferência: contagem por tabela origem × destino; login de 2 usuários
  reais com a senha antiga; checagem de RLS com um usuário de cada papel.

### Fase 5 — Deploy e virada
- Vercel: projeto ligado ao repo, `vercel.json` com rewrite da SPA, env
  (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `VITE_DATA_API_URL`,
  `CRON_SECRET`). **Nenhum segredo com `VITE_`.**
- Ensaio completo no Neon `dev` → teste no navegador (cada tela, webhooks de
  entrada e saída).
- **Dia da virada:** congelar escrita no Lovable → export final → restaurar no
  Neon `main` → trocar a URL na Oniplataforma → DNS/domínio.
- Lovable Cloud **só é removido** depois de uma semana de uso sem incidente.
  "Remove database" apaga banco, backups e contas de vez.

## 5. Pendências do dono

- [ ] Baixar o export do Lovable Cloud (ensaio) e dizer onde o arquivo está.
- [ ] Plano da Vercel: Pro (cron por minuto) ou Hobby (despacho de webhook
      de saída 1×/dia — não serve).
- [ ] Domínio final do app.
- [ ] Segredos das edge functions anotados do painel do Lovable, se houver.
- [ ] Depois da virada, o editor do Lovable deixa de funcionar com este
      projeto (ele espera o Supabase dele).
