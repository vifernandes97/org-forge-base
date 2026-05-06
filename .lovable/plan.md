
# Auditoria de convites de organização

Registrar e exibir todos os eventos relevantes do ciclo de vida dos links de convite: **geração**, **cópia**, **revogação**, **exclusão** e **aceitação** — com autor, data/hora, papel e contexto (org, IP quando aplicável).

## Banco de dados (migration)

Nova tabela `organization_invite_logs`:

| coluna | tipo | nota |
|---|---|---|
| id | uuid PK | |
| organization_id | uuid not null | escopo de RLS |
| invite_id | uuid null | null se o convite já foi excluído |
| invite_token_preview | text | últimos 6 chars do token (para identificar sem expor) |
| event_type | text not null | `created`, `copied`, `revoked`, `deleted`, `accepted`, `accept_failed` |
| actor_user_id | uuid null | quem disparou (null para aceite anônimo via token inválido) |
| actor_email | text null | snapshot do email do autor no momento |
| role | org_role null | papel do convite |
| metadata | jsonb default '{}' | extras: `reason` em accept_failed, `already_member`, etc. |
| created_at | timestamptz default now() | |

Índices: `(organization_id, created_at DESC)`, `(invite_id)`.

**RLS**: SELECT apenas para `owner`/`admin` da org. INSERT bloqueado para clientes — todos os logs são gravados via funções SECURITY DEFINER.

## Funções SECURITY DEFINER

- **`log_invite_event(p_org_id, p_invite_id, p_token, p_event, p_metadata)`** — função interna para gravar logs. Captura `auth.uid()` e o email via `profiles`.
- **`accept_invite`** (existente) — adicionar gravação de log `accepted` (com `already_member` no metadata) ao final do fluxo de sucesso.
- **`get_invite_by_token`** — não loga (consulta de leitura, executada antes do aceite).
- Aceite com falha (revogado/expirado/esgotado) → o `accept_invite` passará a inserir log `accept_failed` com motivo no `metadata` antes de levantar exceção, usando bloco `EXCEPTION` para não impedir o erro.

## Frontend

### Geração, revogação e exclusão
Em `src/services/invites.ts`, após cada operação bem-sucedida (`createInvite`, `revokeInvite`, `deleteInvite`), chamar `supabase.rpc('log_invite_event', ...)` com o `event_type` apropriado. Para `deleteInvite`, gravar o log **antes** do DELETE (porque o `invite_id` ficará órfão; mantemos `invite_token_preview` e `role` no log).

### Cópia
Em `InviteLinksList.tsx` → `handleCopy`, após `clipboard.writeText` chamar `logInviteEvent(invite.id, 'copied')`. Adicionar wrapper `logInviteEvent` em `services/invites.ts`.

### Aceitação
A gravação de `accepted` / `accept_failed` ocorre dentro da função SQL `accept_invite` — não requer mudança no frontend.

### Visualização — nova aba "Histórico" em `TeamPage.tsx`
- Adicionar `Tabs` na página: **Membros** (atual) | **Links de convite** (atual) | **Histórico de convites** (novo).
- Novo componente `src/components/team/InviteAuditLog.tsx`:
  - Tabela: Data/hora, Evento (badge colorida), Autor (avatar + nome), Papel, Token (`••••XXXXXX`), Detalhes.
  - Paginação simples (20 por página, server-side via `range`).
  - Filtro por tipo de evento (multi-select) e busca por autor.
- Novo hook `useInviteAuditLog(page, filters)` em `src/hooks/useInvites.ts`.
- Novo serviço `listInviteLogs(orgId, page, filters)` em `src/services/invites.ts`.
- Visível apenas para `owner`/`admin` (a aba é renderizada condicionalmente).

## Segurança

- Tokens completos nunca são gravados — apenas preview de 6 caracteres.
- RLS garante que membros comuns não vejam logs.
- `log_invite_event` valida que `auth.uid()` é membro da org (exceto quando chamado via `accept_invite`, onde o usuário ainda pode não ser membro).
- A gravação de eventos é best-effort: falhas no log não revertem a operação principal (tratadas com `BEGIN/EXCEPTION` no SQL e `try/catch` silencioso no client).

## Arquivos

**Novos**
- `supabase/migrations/<timestamp>_invite_audit_log.sql`
- `src/components/team/InviteAuditLog.tsx`

**Modificados**
- `src/services/invites.ts` — adicionar `logInviteEvent`, `listInviteLogs`; chamar log em create/revoke/delete.
- `src/hooks/useInvites.ts` — adicionar `useInviteAuditLog`; invalidar `['invite-logs']` após mutações.
- `src/components/team/InviteLinksList.tsx` — log de `copied` em `handleCopy`.
- `src/pages/TeamPage.tsx` — adicionar `Tabs` com a nova aba "Histórico".
