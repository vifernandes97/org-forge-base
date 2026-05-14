## Renomear "Leads" → "Negócios" + Contatos

Renomeação apenas na camada de UI (rótulos, navegação, títulos). O banco continua com a tabela `leads` para evitar quebras em hooks, edge functions, automações e webhooks. Em paralelo, criamos uma tabela `contacts` 1:1 com `leads` para armazenar dados pessoais (nome, email, telefone) separados do negócio.

---

### 1. Banco de dados (migração)

Nova tabela `contacts`:

```text
contacts
├── id (uuid)
├── organization_id (uuid)
├── lead_id (uuid, UNIQUE)        ← garante 1:1
├── name (text, not null)
├── email (text, nullable)
├── phone (text, nullable)
├── created_at / updated_at
```

- RLS multi-tenant (mesmo padrão das outras tabelas: `get_user_org_ids()` para SELECT, `owner/admin/member` para INSERT/UPDATE).
- Índices em `lead_id` (unique) e `organization_id`.
- Trigger `update_updated_at_column`.

**Migração de dados (backfill):**
- Para cada `lead` existente: `INSERT INTO contacts (organization_id, lead_id, name, email, phone)` copiando os valores atuais.
- Após o backfill, **manter** `leads.name`, `leads.email`, `leads.phone` por enquanto (não dropar) — webhooks de entrada/saída, exports CSV e a função `execute_stage_task_automations` ainda referenciam essas colunas. Ficam como cache sincronizado por trigger.
- Trigger `sync_contact_to_lead`: ao INSERT/UPDATE em `contacts`, copia `name/email/phone` para `leads` correspondente. Mantém compatibilidade total com automações, webhooks, exports e inbound sem precisar tocar em nenhum desses sistemas agora.
- Trigger `sync_lead_to_contact`: ao INSERT em `leads` (sem contato ainda), cria automaticamente um `contacts` com os campos atuais. Garante que todo negócio sempre tenha um contato.

### 2. Renomeação de UI (sem mexer em nomes técnicos)

Todos os textos visíveis em PT-BR passam de "Lead/Leads" para "Negócio/Negócios". Variáveis, props, hooks, rotas e arquivos **continuam** com `lead` no nome.

Arquivos a atualizar (apenas strings):
- `src/components/layout/AppSidebar.tsx` — item "Leads" → "Negócios"
- `src/pages/LeadsPage.tsx` — título, abas, mensagens vazias, botão "Novo lead" → "Novo negócio"
- `src/pages/TasksPage.tsx` — referências a "lead" em copy
- `src/components/leads/LeadFormDialog.tsx` — título "Novo lead/Editar lead" + agrupar campos em duas seções: **Negócio** (company_name, company, value, qualification, etc.) e **Contato** (name, email, phone)
- `src/components/leads/LeadDetailSheet.tsx` — labels, abas, seção "Contato" destacada
- `src/components/leads/list/BulkActionsBar.tsx`, `LeadCard.tsx`, `KanbanCard.tsx` — copy
- `src/components/leads/filters/*` — placeholders e labels
- `src/components/leads/activities/*` — frases tipo "Lead criado" → "Negócio criado"
- `src/components/dashboard/*` — "Total de leads" → "Total de negócios", "Leads por período", etc.
- `src/components/automations/*` — descrições de trigger ("quando o lead entra em…")
- `src/lib/exportCsv.ts` — nome do arquivo `negocios.csv`, cabeçalhos
- `index.html` / título da página
- Mensagens de toast em todos os hooks (`useLeads`, `useTasks`, `useActivities`)

### 3. UI: separar visualmente contato e negócio

- **`LeadFormDialog`**: dois grupos visuais.
  - **Negócio**: título (company_name), empresa (company), valor, qualificação, prioridade, funil/etapa, tags, source, instagram, notas.
  - **Contato**: nome, email, telefone.
  - O submit envia tudo numa única action; internamente o serviço persiste em `leads` + `contacts` (via trigger automático).
- **`LeadDetailSheet`**: nova seção "Contato" no topo da coluna esquerda (ícone de pessoa) com nome/email/telefone editáveis inline. A coluna de "Negócio" fica com os demais campos.
- **`LeadCard` / `KanbanCard`**: continuam mostrando `company_name` como título principal (mantém o padrão atual).
- **Card do contato**: pequeno avatar com inicial do `contact.name` ao lado do título quando útil.

### 4. Camada de serviço

- `src/services/leads.ts`: ao criar/atualizar lead, sincronizar `contacts` na mesma transação. Como o trigger SQL espelha campos, o frontend pode simplesmente continuar enviando `name/email/phone` no payload do lead — a trigger reconcilia. Para edição inline do contato, adicionar `updateContact(leadId, fields)` que escreve direto em `contacts`.
- Novo hook `useContact(leadId)` para ler o contato (na maioria dos casos não é necessário, basta usar os campos sincronizados em `leads`).

### 5. Tipos TypeScript

Em `src/types/index.ts`:
- Nova interface `Contact { id, organization_id, lead_id, name, email, phone, ... }`.
- `LeadWithRelations` ganha `contact?: Contact`.
- Não criar alias `Deal = Lead` — manter um vocabulário só no código (lead) e outro na UI (negócio) evita confusão.

### 6. Memória do projeto

Atualizar `mem://index.md`:
- Trocar entradas relevantes para refletir "Negócios (negócio = lead no código)".
- Nova memória `mem://architecture/deals-vs-contacts` explicando: "UI fala em Negócios e Contatos; banco mantém `leads` + nova `contacts` 1:1; campos do contato são espelhados em `leads` por trigger para compat com automações/webhooks/exports."

---

### Detalhes técnicos importantes

- **Não tocar** em: `useLeads.ts`, `services/leads.ts` queries existentes (apenas adicionar campos novos), edge functions `inbound-webhook` e `fire-webhook`, função `execute_stage_task_automations`, RLS de `leads`. Tudo continua funcionando porque os campos `leads.name/email/phone` permanecem populados via trigger.
- **Webhooks de entrada** continuam mapeando para `leads.name/email/phone`; o trigger `sync_lead_to_contact` cria o contato automaticamente.
- **Export CSV** continua lendo de `leads`, sem alteração funcional.
- **Filtros** que buscam por nome/email/telefone continuam sobre `leads`, sem mudança.

### Fora do escopo (pode virar follow-up depois)

- Múltiplos contatos por negócio.
- Renomear tabelas/colunas no banco (`leads` → `deals`, `lead_id` → `deal_id`).
- Dropar colunas legadas `leads.name/email/phone`.
- Página dedicada de gestão de Contatos cross-deal.
