

# Sistema de Webhooks por Etapa

## Resumo
Criar a tabela `webhook_logs` com RLS multi-tenant, uma Edge Function `fire-webhook` para disparar webhooks com retry automatico (3 tentativas), integrar com o Kanban para substituir o console.log pelo disparo real, e criar a pagina `/settings/webhooks` com logs, filtros e estatisticas.

## 1. Migration SQL

### Tabela webhook_logs

```sql
CREATE TABLE public.webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  stage_id uuid NOT NULL REFERENCES public.stages(id),
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  webhook_url text NOT NULL,
  payload jsonb NOT NULL,
  response_status integer,
  response_body text,
  success boolean NOT NULL,
  attempt_number integer NOT NULL DEFAULT 1,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_logs_org_id ON public.webhook_logs(organization_id);
CREATE INDEX idx_webhook_logs_created_at ON public.webhook_logs(created_at DESC);
CREATE INDEX idx_webhook_logs_success ON public.webhook_logs(success);

ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view webhook logs" ON public.webhook_logs
  FOR SELECT USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Owner/admin/member can insert webhook logs" ON public.webhook_logs
  FOR INSERT WITH CHECK (
    get_user_org_role(organization_id) IN ('owner','admin','member')
  );
```

## 2. Edge Function: fire-webhook

### `supabase/functions/fire-webhook/index.ts`

Funcionalidade:
- Recebe via POST: `webhook_url`, `payload`, `organization_id`, `stage_id`, `lead_id`, `attempt_number` (default 1)
- Faz POST para `webhook_url` com timeout de 10s
- Headers: `Content-Type: application/json`, `X-CRM-Event: lead.stage_changed`, `X-CRM-Signature: HMAC-SHA256` do body usando `SUPABASE_SERVICE_ROLE_KEY` como secret
- Registra resultado em `webhook_logs` usando service role client
- Se falhou e attempt < 3: agenda retry chamando a si mesmo via `setTimeout` equivalente (usando Deno.alarm ou re-invocando a funcao)
  - Retry 1: 60s, Retry 2: 300s, Retry 3: 1800s
  - Na pratica, como edge functions nao suportam delay nativo, o retry sera feito via chamada recursiva com `fetch` ao proprio endpoint apos registrar a falha
- Retorna status do resultado

### Config TOML
Adicionar ao `supabase/config.toml`:
```toml
[functions.fire-webhook]
verify_jwt = false
```

Nota: A funcao valida o `organization_id` internamente e usa service role para inserir logs, entao nao precisa de JWT do usuario.

## 3. Tipos TypeScript

### `src/types/index.ts`
Adicionar:
```text
WebhookLog {
  id, organization_id, stage_id, lead_id, webhook_url,
  payload, response_status, response_body, success,
  attempt_number, error_message, created_at
}
```

## 4. Services

### `src/services/webhooks.ts` (criar)
- `getWebhookLogs(orgId, filters?)` -- lista paginada de webhook_logs com filtros (success, stage_id, date range)
- `getWebhookStats(orgId)` -- estatisticas: total disparados, taxa de sucesso, falhas 24h
- `fireWebhook(data)` -- chama a edge function `fire-webhook` via `supabase.functions.invoke()`

### Funcao `buildWebhookPayload` (criar)
Funcao helper que monta o payload padrao do webhook a partir dos dados do lead, stages, funnel, user e organization. Busca tambem custom_field_values do lead para incluir no payload.

## 5. Hooks

### `src/hooks/useWebhooks.ts` (criar)
- `useWebhookLogs(orgId, filters)` -- useQuery paginado
- `useWebhookStats(orgId)` -- useQuery para estatisticas
- `useFireWebhook()` -- useMutation para disparar webhook

## 6. Componentes

### `src/pages/WebhooksPage.tsx` (criar)
- Header: titulo "Webhooks"
- Card de estatisticas no topo: total disparados, taxa de sucesso (%), falhas 24h
- Filtros: sucesso/falha (select), etapa (select com stages da org), periodo (date range)
- Tabela: data/hora, etapa (nome), lead (nome), URL (truncada), status HTTP, sucesso (icone verde/vermelho), tentativa, botao "Ver detalhes"
- Modal de detalhes: payload JSON formatado + response body
- Paginacao com 50 por pagina

## 7. Integracoes com codigo existente

### `src/components/leads/kanban/KanbanView.tsx` (editar)
No `handleDragEnd`, substituir o `console.log('[Webhook placeholder]...')` por:
- Verificar se `toStage.webhook_url` esta definida
- Se sim, chamar `fireWebhook` de forma assincrona (fire-and-forget, sem bloquear a UI)
- Montar o payload completo com dados do lead, transicao, funil, usuario e organizacao
- Buscar custom_field_values do lead para incluir no payload (pode usar cache do TanStack Query ou fetch inline)

### `src/components/layout/AppSidebar.tsx` (editar)
- Adicionar "Webhooks" ao array `settingsNav` com icone `Webhook` do lucide-react e url `/settings/webhooks`

### `src/App.tsx` (editar)
- Adicionar rota `/settings/webhooks` -> PrivateRoute + MainLayout + WebhooksPage

## Arquivos criados/modificados

| Arquivo | Acao |
|---------|------|
| supabase/migrations/xxx.sql | Criar (tabela webhook_logs) |
| supabase/functions/fire-webhook/index.ts | Criar |
| src/types/index.ts | Editar (WebhookLog) |
| src/services/webhooks.ts | Criar |
| src/hooks/useWebhooks.ts | Criar |
| src/pages/WebhooksPage.tsx | Criar |
| src/components/leads/kanban/KanbanView.tsx | Editar (disparo real) |
| src/components/layout/AppSidebar.tsx | Editar (item Webhooks) |
| src/App.tsx | Editar (rota /settings/webhooks) |

## Detalhes Tecnicos

### Edge Function fire-webhook

```text
1. Recebe POST com { webhook_url, payload, organization_id, stage_id, lead_id, attempt_number }
2. Cria Supabase client com service role key
3. Faz fetch(webhook_url, { method: 'POST', headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(10000) })
4. Registra em webhook_logs: success, response_status, response_body, attempt_number
5. Se falhou e attempt_number < 3:
   - Calcula delay: [60, 300, 1800][attempt_number - 1] segundos
   - Re-invoca a si mesmo com attempt_number + 1 via fetch ao proprio URL (fire-and-forget)
   - Usa setTimeout com o delay calculado antes de fazer o retry fetch
6. Retorna { success, attempt_number, response_status }
```

Nota sobre retry: Edge functions tem limite de execucao de ~150s. Para delays longos (5min, 30min), o retry sera implementado via re-invocacao da funcao com um header `X-Retry-Delay` que a funcao usara para aguardar antes de executar. Para delays > 150s, a funcao simplesmente registrara a falha e nao fara retry automatico (limitacao da plataforma). Uma alternativa seria usar pg_cron para agendar retries, mas isso adiciona complexidade. A implementacao inicial fara retry imediato para as 3 tentativas com delays curtos (1s, 5s, 10s) para manter simplicidade.

### HMAC Signature
Usar `crypto.subtle.importKey` + `crypto.subtle.sign` com HMAC-SHA256 no Deno para gerar a assinatura do payload. A chave sera o `SUPABASE_SERVICE_ROLE_KEY` (ja disponivel como secret).

### Payload no Kanban
No KanbanView, ao detectar que `toStage.webhook_url` existe:

```text
const payload = {
  event: 'lead.stage_changed',
  timestamp: new Date().toISOString(),
  lead: { id, name, email, phone, company, value, tags, priority, source, custom_fields: {} },
  transition: {
    previous_stage: { id: fromStage.id, name: fromStage.name },
    new_stage: { id: toStage.id, name: toStage.name },
    funnel: { id: funnel.id, name: funnel.name },
    moved_by: { id: user.id, name: user.full_name },
    moved_at: new Date().toISOString()
  },
  organization: { id: organization.id, name: organization.name }
}

// Fire-and-forget
supabase.functions.invoke('fire-webhook', {
  body: { webhook_url: toStage.webhook_url, payload, organization_id, stage_id, lead_id }
})
```

### Estatisticas da pagina de webhooks
Queries agregadas:
- Total: `count(*)` com filtro de org
- Sucesso: `count(*) where success = true` / total
- Falhas 24h: `count(*) where success = false AND created_at > now() - 24h`

