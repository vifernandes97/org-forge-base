# Webhook enviado na timeline de Atividades

Hoje os disparos de webhook ficam apenas em "Webhooks > Logs". Vou registrá-los também na aba **Atividades** do lead, para ficarem visíveis junto com mudanças de etapa, notas, ligações etc.

## O que será feito

### 1. Novo tipo de atividade: `webhook_sent`

- Migração SQL: atualizar o trigger `validate_activity_type` para aceitar `webhook_sent` (e `webhook_failed`).
- `src/types/index.ts`: adicionar `'webhook_sent' | 'webhook_failed'` ao type `ActivityType`.
- `ActivityIcon.tsx`: novo ícone (`Webhook` do lucide), cor indigo para sucesso e vermelho para falha.

### 2. Inserir activity ao disparar webhook

Em `supabase/functions/fire-webhook/index.ts`, depois de gravar em `webhook_logs`, inserir também em `lead_activities` (apenas quando houver `lead_id` e somente na primeira tentativa, para não duplicar nas retentativas):

- `activity_type`: `webhook_sent` se sucesso, `webhook_failed` se falhou (após esgotar retries — na 3ª tentativa que ainda falhar, ou na 1ª se sucesso).
- `title`: ex. `Webhook enviado` / `Webhook falhou`
- `description`: URL do webhook + status HTTP (`POST https://... → 200`) ou erro (`Timeout after 10s`).
- `metadata`: `{ webhook_url, response_status, attempt_number, stage_id }`.
- `user_id`: usar o `moved_by.id` presente em `payload.transition.moved_by` quando existir; fallback para o `user_id` do lead (owner).

Lógica:
- Se `success === true` e `attempt_number === 1` → registra `webhook_sent`.
- Se `success === true` e `attempt_number > 1` → registra `webhook_sent` (com nota "após N tentativas").
- Se `success === false` e `attempt_number === 3` → registra `webhook_failed`.
- Em falhas intermediárias (1ª/2ª) não registra para evitar ruído (apenas log técnico em Webhooks).

Também atualiza `leads.last_activity_at`.

### 3. UI

A `ActivityTimeline` já renderiza qualquer `activity_type` via `ActivityIcon` — basta os 2 novos casos no `config`. Sem alterações estruturais.

## Arquivos

- nova migration SQL (atualiza trigger)
- `src/types/index.ts`
- `src/components/leads/activities/ActivityIcon.tsx`
- `supabase/functions/fire-webhook/index.ts`

## Resultado

Ao mover um lead para uma etapa que dispara webhook (manual ou via automação), a timeline do lead passa a mostrar uma linha "Webhook enviado → 200" logo abaixo do "Moveu de X para Y".
