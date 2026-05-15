## Problema

Quando você abre um modal (detalhe do negócio, formulário etc.) em `/leads`, troca de aba no navegador e volta, o modal aparece fechado. O motivo é que toda a árvore da aplicação é desmontada e remontada ao voltar para a aba — perdendo o estado local que controla o modal aberto (`selectedLeadId`, `editOpen`, etc.).

## Causa raiz

Ao retornar a aba, o Supabase Auth dispara automaticamente um evento `TOKEN_REFRESHED`:

1. `AuthContext.onAuthStateChange` chama `setSession`/`setUser` com **novas referências** de objeto, mesmo quando o usuário é o mesmo.
2. `OrganizationContext` tem `useCallback` com dependência `[user]` (objeto), então `fetchOrgs` é recriado.
3. O `useEffect(() => { fetchOrgs() }, [fetchOrgs])` dispara, e `fetchOrgs` chama `setLoading(true)`.
4. `PrivateRoute` observa `orgLoading` e renderiza o spinner de tela cheia.
5. Toda a árvore (incluindo `LeadsPage`, `KanbanView`/`ListView` e o `<Sheet>`) é **desmontada**. O estado local `selectedLeadId` é perdido.
6. Quando termina, a árvore remonta com `selectedLeadId = null` → modal fechado.

## Correção

Trocar a dependência por um identificador estável e evitar o "loading global" em refetches silenciosos.

### `src/contexts/OrganizationContext.tsx`
- Trocar a dependência do `useCallback` de `[user]` para `[user?.id]`, para não recriar `fetchOrgs` quando só a referência do objeto user muda (token refresh).
- Não chamar `setLoading(true)` em refetches subsequentes — apenas no carregamento inicial. Usar uma flag `initialized` ou só setar loading se ainda não há dados carregados.

### `src/contexts/AuthContext.tsx` (defensivo)
- No callback de `onAuthStateChange`, evitar atualizar o estado quando o `user.id` é o mesmo do anterior (apenas atualizar `session` se necessário) — assim eventos `TOKEN_REFRESHED` não causam re-renders desnecessários em consumidores que só usam `user`.

### Verificação
Após o ajuste:
- Abrir um lead em `/leads` → trocar de aba → voltar → o sheet permanece aberto.
- O mesmo deve valer para `LeadFormDialog`, `TaskFormDialog`, diálogos de arquivamento etc., já que todos usam estado local que só era perdido devido à desmontagem da árvore.

Sem alterações em backend, schema ou na lógica dos modais — apenas estabilização dos contextos de Auth e Organization.