
# Sistema de Webhook de Entrada (Inbound)

## Resumo
Criar um sistema completo de captacao automatica de leads via webhooks de entrada, com Edge Function publica que aceita dados de formularios externos (Elementor, Typeform, etc.), mapeamento de campos configuravel, deduplicacao inteligente, e interface de gestao com logs e testes.

## 1. Migration SQL

### Tabela inbound_webhooks
```sql
CREATE TABLE public.inbound_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  api_key text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  funnel_id uuid REFERENCES public.funnels(id) ON DELETE SET NULL,
  target_stage text NOT NULL DEFAULT 'first',
  default_source text NOT NULL DEFAULT 'formulário',
  default_assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  default_tags text[] NOT NULL DEFAULT '{}',
  duplicate_strategy text NOT NULL DEFAULT 'update',
  field_mapping jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_inbound_webhooks_org ON public.inbound_webhooks(organization_id);
CREATE INDEX idx_inbound_webhooks_api_key ON public.inbound_webhooks(api_key);

ALTER TABLE public.inbound_webhooks ENABLE ROW LEVEL SECURITY;
```

Validation trigger para `duplicate_strategy`:
```sql
CREATE OR REPLACE FUNCTION public.validate_inbound_webhook_strategy()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.duplicate_strategy NOT IN ('update','create_new','ignore') THEN
    RAISE EXCEPTION 'Invalid duplicate_strategy: %', NEW.duplicate_strategy;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_inbound_webhook_strategy
  BEFORE INSERT OR UPDATE ON public.inbound_webhooks
  FOR EACH ROW EXECUTE FUNCTION public.validate_inbound_webhook_strategy();
```

RLS policies:
- SELECT: membros da org (`organization_id IN (SELECT get_user_org_ids())`)
- INSERT: owner/admin (`get_user_org_role(organization_id) IN ('owner','admin')`)
- UPDATE: owner/admin
- DELETE: owner/admin

Trigger `update_updated_at_column` no update.

### Tabela inbound_webhook_logs
```sql
CREATE TABLE public.inbound_webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  inbound_webhook_id uuid NOT NULL REFERENCES public.inbound_webhooks(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  action text NOT NULL,
  raw_payload jsonb NOT NULL,
  mapped_data jsonb,
  changes_applied jsonb,
  error_message text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_inbound_logs_org ON public.inbound_webhook_logs(organization_id);
CREATE INDEX idx_inbound_logs_webhook ON public.inbound_webhook_logs(inbound_webhook_id);
CREATE INDEX idx_inbound_logs_action ON public.inbound_webhook_logs(action);
CREATE INDEX idx_inbound_logs_created ON public.inbound_webhook_logs(created_at DESC);

ALTER TABLE public.inbound_webhook_logs ENABLE ROW LEVEL SECURITY;
```

RLS policies:
- SELECT: membros da org
- INSERT: nenhuma policy para anon/authenticated (a Edge Function usa service_role para inserir, bypassa RLS)
- DELETE: owner/admin

## 2. Edge Function: inbound-webhook

Arquivo: `supabase/functions/inbound-webhook/index.ts`

Configuracao em `supabase/config.toml`:
```toml
[functions.inbound-webhook]
verify_jwt = false
```

### Fluxo da funcao:
1. CORS: aceitar todas as origens, metodos POST e OPTIONS
2. Parsear body (JSON, form-urlencoded, multipart)
3. Normalizar payload: extrair `form_fields` se existir, flatten
4. Extrair API key de: header `X-API-Key`, query param `api_key`, campo `api_key` do body
5. Buscar `inbound_webhooks` pela `api_key` usando service_role client
6. Validar: webhook existe e `is_active = true`, senao 401
7. Rate limiting: contar logs dos ultimos 60 segundos para esta api_key; se >= 100, retornar 429
8. Aplicar mapeamento de campos (`field_mapping`): para cada campo CRM, buscar valor no payload pela chave mapeada; se nao mapeado, tentar auto-deteccao por nomes comuns
9. Validar: pelo menos `name` ou `email` presente, senao 422
10. Resolver funil: `inbound_webhook.funnel_id` ou funil `is_default=true` da org
11. Resolver primeira etapa: `stages` do funil com menor `position`
12. Logica de deduplicacao baseada em `duplicate_strategy`:
    - **update**: buscar lead por email na org; se existe, merge inteligente (nunca apagar dados com valores vazios), registrar changes_applied
    - **create_new**: sempre criar novo lead
    - **ignore**: se lead com mesmo email existe, retornar `action: 'ignored'`
13. Ao criar lead: inserir `custom_field_values`, registrar atividade, verificar webhook de saida na etapa, verificar SLA
14. Ao atualizar lead: atualizar campos, registrar atividade com lista de mudancas
15. Logar em `inbound_webhook_logs` (sempre, inclusive erros)
16. Retornar resposta JSON com `success`, `action`, `lead_id`

### Auto-deteccao de campos (fallback):
- name: "name", "nome", "full_name", "nome_completo", "your-name", "your_name"
- email: "email", "e-mail", "your-email", "your_email", "email_address"
- phone: "phone", "telefone", "tel", "your-phone", "whatsapp", "celular"
- company: "company", "empresa", "company_name", "razao_social"

Busca case-insensitive, ignorando hifens e underscores na comparacao.

### Campos extras nao mapeados:
Concatenar no campo `notes` do lead como "Campo extra: valor\n".

## 3. Services

### `src/services/inboundWebhooks.ts` (criar)
- `getInboundWebhooks(orgId)` -- lista webhooks de entrada
- `getInboundWebhook(id)` -- detalhe de um webhook
- `createInboundWebhook(data)` -- insert (gerar api_key como `crypto.randomUUID()`)
- `updateInboundWebhook(id, data)` -- update
- `deleteInboundWebhook(id)` -- delete
- `regenerateApiKey(id)` -- update api_key com novo UUID
- `getInboundWebhookLogs(orgId, filters)` -- logs paginados com filtros
- `getInboundWebhookLogsByWebhook(webhookId, limit)` -- logs recentes de um webhook
- `testInboundWebhook(webhookId, payload)` -- POST para o endpoint com payload de teste

## 4. Hooks

### `src/hooks/useInboundWebhooks.ts` (criar)
- `useInboundWebhooks()` -- lista
- `useInboundWebhook(id)` -- detalhe
- `useCreateInboundWebhook()` -- mutation
- `useUpdateInboundWebhook()` -- mutation
- `useDeleteInboundWebhook()` -- mutation
- `useRegenerateApiKey()` -- mutation
- `useInboundWebhookLogs(filters)` -- logs paginados
- `useInboundWebhookLogsByWebhook(webhookId)` -- logs recentes
- `useTestInboundWebhook()` -- mutation

## 5. Paginas e Componentes

### `src/pages/InboundWebhooksPage.tsx` (criar)
- Lista de webhooks de entrada em cards
- Cada card: nome, status (toggle), data criacao, contagem de leads captados, ultimo lead
- Botao "+ Novo Webhook de Entrada"
- Clicar no card abre a pagina de edicao

### `src/pages/InboundWebhookEditPage.tsx` (criar)
Pagina completa de edicao/criacao com 5 secoes:

**Secao 1 - Configuracao geral:**
- Nome, toggle ativo/inativo
- Funil destino (select), responsavel padrao (select), fonte padrao (input), tags padrao (input)
- Estrategia de duplicados (radio: update/create_new/ignore)

**Secao 2 - URL e API Key (read-only):**
- Endpoint URL (montada com `VITE_SUPABASE_URL`)
- API Key com botoes copiar
- Botao "Regenerar API Key" com confirmacao
- Card de instrucoes para Elementor (colapsavel)

**Secao 3 - Mapeamento de campos:**
- Tabela duas colunas: campo CRM (fixo) + input para nome do campo externo
- Campos fixos: name, email, phone, company, value, notes
- Campos personalizados ativos da org (dinamico)
- Tooltip explicativo

**Secao 4 - Testar webhook:**
- Textarea para payload JSON
- Botao "Enviar teste"
- Resultado inline (sucesso/erro com detalhes)

**Secao 5 - Logs recentes:**
- Ultimos 20 logs deste webhook
- Badge colorido por acao (created/updated/ignored/error)
- Botao "Ver todos" -> /settings/inbound-webhooks/logs

### `src/pages/InboundWebhookLogsPage.tsx` (criar)
- Tabela completa de logs da org
- Filtros: webhook (select), acao (multi-select), periodo (date range)
- Colunas: data/hora, webhook nome, acao, lead, IP
- Expandir mostra: raw_payload, mapped_data, changes_applied, error_message
- Paginacao 50/pagina

## 6. Integracoes

### `src/components/layout/AppSidebar.tsx` (editar)
- Renomear "Webhooks" para "Webhooks de Saida"
- Adicionar "Webhooks de Entrada" abaixo, com icone `ArrowDownToLine` ou similar

### `src/App.tsx` (editar)
- Rota `/settings/inbound-webhooks` -> InboundWebhooksPage
- Rota `/settings/inbound-webhooks/new` -> InboundWebhookEditPage (modo criacao)
- Rota `/settings/inbound-webhooks/:id` -> InboundWebhookEditPage (modo edicao)
- Rota `/settings/inbound-webhooks/logs` -> InboundWebhookLogsPage

### `src/types/index.ts` (editar)
Adicionar interfaces:
- `InboundWebhook`
- `InboundWebhookLog`
- `InboundWebhookLogFilters`

## Arquivos criados/modificados

| Arquivo | Acao |
|---------|------|
| supabase/migrations/xxx.sql | Criar (2 tabelas + RLS + trigger) |
| supabase/functions/inbound-webhook/index.ts | Criar (Edge Function) |
| supabase/config.toml | Editar (verify_jwt = false para inbound-webhook) |
| src/types/index.ts | Editar (novas interfaces) |
| src/services/inboundWebhooks.ts | Criar |
| src/hooks/useInboundWebhooks.ts | Criar |
| src/pages/InboundWebhooksPage.tsx | Criar |
| src/pages/InboundWebhookEditPage.tsx | Criar |
| src/pages/InboundWebhookLogsPage.tsx | Criar |
| src/components/layout/AppSidebar.tsx | Editar |
| src/App.tsx | Editar (novas rotas) |

## Detalhes Tecnicos

### Geracao de API Key
No client, ao criar webhook: `crypto.randomUUID()` gera um UUID v4 como api_key. Para regenerar, gera novo UUID e atualiza.

### Rate Limiting na Edge Function
Contar registros em `inbound_webhook_logs` onde `inbound_webhook_id` = webhook.id e `created_at > now() - 1 minute` usando service_role. Se count >= 100, retornar 429.

### Parsing multiformat na Edge Function
```text
const contentType = req.headers.get('content-type') || '';
if (contentType.includes('application/json')) {
  rawData = await req.json();
} else if (contentType.includes('application/x-www-form-urlencoded')) {
  const text = await req.text();
  rawData = Object.fromEntries(new URLSearchParams(text));
} else if (contentType.includes('multipart/form-data')) {
  const formData = await req.formData();
  rawData = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string') rawData[key] = value;
  }
}
// Normalizar: se rawData.form_fields existe, usar form_fields
if (rawData.form_fields && typeof rawData.form_fields === 'object') {
  rawData = rawData.form_fields;
}
```

### Normalizacao de nomes de campo para auto-deteccao
Funcao helper que remove hifens, underscores, e converte para lowercase para comparar:
```text
function normalizeFieldName(name: string): string {
  return name.toLowerCase().replace(/[-_\s]/g, '');
}
```
Isso permite que "your-name", "your_name", "Your Name" sejam todos reconhecidos.

### Merge inteligente (update)
Para cada campo do lead:
- Se valor novo e nao-vazio E diferente do atual -> sobrescrever, registrar mudanca
- Se valor novo e vazio/null/undefined -> manter valor existente
- Tags: merge (uniao do array existente com novos tags, sem duplicatas)
- Custom fields: upsert com mesma logica

### Webhook de saida e SLA
Apos criar um lead via inbound webhook:
- Verificar se a primeira etapa (`target_stage`) tem `webhook_url` definido -> invocar `fire-webhook`
- Verificar se a etapa tem `sla_hours` definido -> criar task de follow-up com `due_date = now() + sla_hours`

### URL do endpoint para o usuario
Montada no client usando `import.meta.env.VITE_SUPABASE_URL`:
```text
`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/inbound-webhook`
```

### Instrucoes Elementor (colapsavel no UI)
Texto estatico com passos numerados explicando como configurar o webhook no Elementor, incluindo onde encontrar os IDs dos campos.

### Permissoes
- Owner/Admin: CRUD completo em inbound_webhooks, ver logs
- Member: somente leitura (ver webhooks e logs)
- Viewer: sem acesso (esconder item do sidebar se role = viewer -- ou simplesmente mostrar mas as queries retornam vazio)

### config.toml
Adicionar secao:
```toml
[functions.inbound-webhook]
verify_jwt = false
```
Nota: o arquivo config.toml e auto-gerenciado, mas a secao de functions precisa estar presente para desabilitar JWT.
