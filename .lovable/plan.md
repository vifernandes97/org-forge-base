# Links de convite compartilháveis

Permitir que owners/admins gerem **links únicos** que outras pessoas podem usar para entrar na organização. Cada link tem **expiração** e pode ser configurado como **uso único** ou **múltiplos usos**.

## Como vai funcionar para o usuário

1. Em **Configurações → Time**, owner/admin clica em **"Gerar link de convite"**.
2. Escolhe: papel atribuído (`admin`/`member`/`viewer`), validade (1 dia, 7 dias, 30 dias, nunca) e tipo de uso (1 uso ou ilimitado).
3. Recebe uma URL como `https://app.../invite/<token>` para copiar e compartilhar.
4. Quem abre o link:
   - **Não logado** → vai para registro/login com o token preservado, e ao autenticar entra automaticamente na org.
   - **Logado** → vê tela "Você foi convidado para {Org}" com botão **Aceitar**.
5. Lista de convites ativos exibe: papel, expira em, usos restantes, criado por, ações **Copiar / Revogar**.

## Banco de dados (migration)

Nova tabela `organization_invites`:

| coluna | tipo | nota |
|---|---|---|
| id | uuid PK | |
| organization_id | uuid | |
| token | text unique | random 32 bytes base64url |
| role | org_role | papel atribuído ao aceitar |
| max_uses | int null | null = ilimitado |
| uses_count | int default 0 | |
| expires_at | timestamptz null | null = nunca |
| created_by | uuid | |
| revoked_at | timestamptz null | |
| created_at | timestamptz | |

**RLS**: SELECT/INSERT/UPDATE/DELETE apenas para `owner`/`admin` da org. O aceite usa SECURITY DEFINER (sem RLS).

**Funções SECURITY DEFINER**:
- `get_invite_by_token(p_token)` → retorna dados públicos do convite (org name, role, validade) para a tela de aceite, sem expor a tabela.
- `accept_invite(p_token)` → valida (não revogado, não expirado, `uses_count < max_uses`), insere em `organization_members` com `accepted_at = now()`, incrementa `uses_count`. Idempotente: se já é membro, retorna sucesso silencioso.

## Frontend

**Novos arquivos**
- `src/services/invites.ts` — `listInvites`, `createInvite`, `revokeInvite`, `getInviteByToken`, `acceptInvite`.
- `src/hooks/useInvites.ts` — queries/mutations.
- `src/components/team/InviteLinkDialog.tsx` — formulário (papel, expiração, max_uses) + URL gerada com botão copiar.
- `src/components/team/InviteLinksList.tsx` — tabela de convites ativos.
- `src/pages/AcceptInvitePage.tsx` — rota `/invite/:token`. Lê token, mostra info da org, botão **Aceitar**. Se não logado, redireciona para `/login?invite=<token>` e `/register?invite=<token>`.

**Arquivos modificados**
- `src/pages/TeamPage.tsx` — adicionar botão "Gerar link" e seção "Links de convite".
- `src/App.tsx` — rota pública `/invite/:token`.
- `src/pages/LoginPage.tsx` e `RegisterPage.tsx` — após auth, se houver `?invite=`, redireciona para `/invite/<token>` em vez de `/dashboard`.
- `src/components/shared/OnboardingRoute.tsx` — se houver token de convite na URL, não força criar org (deixa aceitar primeiro).

## Segurança

- Token nunca exposto em listagens públicas; só quem tem o link consegue resolver via `get_invite_by_token`.
- `accept_invite` é a única forma de inserir em `organization_members` por essa via (não depende de role pré-existente).
- Revogação é instantânea (`revoked_at`).
- Expiração e `max_uses` validados server-side dentro da função.
