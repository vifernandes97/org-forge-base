## Objetivo

Fazer o webhook de saída (`lead.stage_changed` e demais eventos de lead) enviar o registro completo do negócio, nomes legíveis de etapa/funil e os campos personalizados da organização — tudo antes da assinatura HMAC.

## Onde alterar

Todo o enriquecimento fica em um único ponto: `supabase/functions/fire-webhook/index.ts`. É por onde passam os dois caminhos de disparo (automação via trigger no banco e movimentação no Kanban), então nada precisa mudar no banco nem no frontend.

## Como funciona hoje

O payload chega pronto do gatilho, com apenas um subconjunto de campos (`lead_id`, `stage_id`, `previous_stage_id`, `funnel_id`, nome, email, telefone, valor, tags...). A função apenas serializa, assina com HMAC e faz o POST.

## Mudanças

1. **Etapa de enriquecimento** logo após o parse do corpo da requisição e **antes** de `JSON.stringify` + cálculo da assinatura, usando o client de service role que já existe.

2. **Registro completo do negócio**: busca a linha inteira do negócio pelo `lead_id` e faz merge de todas as colunas no corpo. Os campos atuais têm precedência (retrocompatibilidade total: `lead_id`, `lead_name`, `event`, `timestamp` não são sobrescritos). Assim entram automaticamente `created_at`, `updated_at`, `notes`, `status`, `priority`, `qualification`, `company_name`, `company_instagram`, `archived_at`, `archive_reason_id`, `last_activity_at`, `stage_entered_at` etc.

3. **Nomes de etapa e funil**:
   - Uma única consulta em `stages` com `.in('id', [stage_id, previous_stage_id])` → `stage_name` e `previous_stage_name`.
   - Uma consulta em `funnels` → `funnel_name`.
   - Se o ID for nulo ou não encontrado, o campo `_name` correspondente vai como `null`, sem quebrar o disparo.

4. **Campos personalizados**: o modelo é relacional — `custom_field_values` (`lead_id`, `field_definition_id`, `value`) + `custom_field_definitions` (`field_label`, `organization_id`). A função busca os valores do negócio com join na definição, filtra pela organização do negócio e monta `custom_fields` com **chave = rótulo legível** (ex.: `"Objeção"`, `"Tipo de negócio"`). Campos do tipo múltipla escolha são entregues como lista quando o valor armazenado for JSON. Sem valores preenchidos → `custom_fields: {}`.

5. **Compatibilidade com o payload do Kanban**: esse caminho envia um formato aninhado (`lead`, `transition`). O enriquecimento detecta a forma do corpo e aplica os mesmos dados no lugar correto, mantendo a estrutura existente intacta.

6. **Tolerância a falhas**: qualquer erro nas consultas de enriquecimento é registrado e ignorado — o webhook segue com o corpo original em vez de falhar.

7. **Assinatura**: a string assinada passa a ser o corpo final já enriquecido, garantindo que a verificação do lado do n8n continue válida.

## Validação

Após implementar, disparo um webhook de teste apontando para um endpoint de inspeção e confirmo no corpo recebido: todas as colunas do negócio, `stage_name` / `previous_stage_name` / `funnel_name` corretos e `custom_fields` com rótulos legíveis.

## Fora do escopo

URL de destino, headers existentes e lógica de disparo/retry permanecem como estão.