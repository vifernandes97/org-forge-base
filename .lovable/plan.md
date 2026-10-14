# Fase 1 — Empresas e Contatos (somente banco)

Objetivo: separar Empresa e Contatos dos Negócios sem mudar nenhuma tela. O app continua funcionando igual.

## Ajustes ao documento (para não quebrar o app)

1. **Coluna `contacts.lead_id` não será removida nesta fase.** A exportação de CSV hoje lê o contato do negócio através dela (`contacts(*)` em `src/services/leads.ts`). Removê-la ou remover a FK quebra a exportação, contrariando "app funcionando igual". Além disso, remover coluna é bloqueado por segurança no banco publicado.
   - Fica: a coluna passa a ser opcional (sem UNIQUE), recebe comentário `DEPRECATED: substituída por lead_contacts — remover na fase 4`, e a FK é mantida até a fase 2 trocar a exportação para `lead_contacts`.
   - A ponte (item 6) continua preenchendo `contacts.lead_id` no contato principal, para a exportação seguir correta.
2. Os gatilhos/funções `sync_contact_to_lead` e `sync_lead_to_contact` são removidos e substituídos pela ponte nova.

## Migração (uma só, idempotente)

1. `companies`: colunas, CHECK de CNPJ (14 dígitos), índice por organização, índice único parcial (organização, cnpj), trigger de `updated_at`.
2. `contacts`: + `company_id` (cascade), índices em `company_id` e `(organization_id, lower(email))`; remove UNIQUE de `lead_id`; `lead_id` vira nullable e deprecated.
3. `lead_contacts`: unique (lead, contato), único principal por negócio, trigger de validação (mesma empresa e mesma organização do negócio).
4. `leads`: + `company_id` (restrict) com índice, ainda nullable; campos antigos mantidos.
5. Backfill:
   - Agrupa por organização + `lower(trim(coalesce(nullif(company_name,''), nullif(company,''))))`; uma empresa por grupo (trade_name = company ou company_name; legal_name = company_name; instagram = primeiro não vazio).
   - Negócio sem empresa: uma empresa por negócio com nome do negócio ou "Sem nome".
   - Preenche `leads.company_id`.
   - Reaproveita os contatos existentes (já 1:1 com o negócio): atribui `company_id`, deduplica dentro da empresa por e-mail (minúsculo) ou dígitos do telefone, cria `lead_contacts` com principal = true. Negócios sem nome/e-mail/telefone ficam sem contato.
6. Ponte TEMPORÁRIA (comentada "remover na fase 4"):
   - BEFORE INSERT/UPDATE em leads: resolve/cria empresa pela chave normalizada se `company_id` nulo; se existir e os campos antigos mudarem, atualiza a empresa.
   - AFTER INSERT/UPDATE em leads: cria/atualiza contato principal a partir de name/email/phone.
7. RLS no padrão de `contacts`: leitura para membros, inserir/editar para owner/admin/member, excluir para owner/admin; GRANTs para authenticated e service_role; funções SECURITY DEFINER com `search_path = public` e EXECUTE revogado de PUBLIC e anon.
8. `merge_leads`: move vínculos de `lead_contacts` do duplicado para o principal sem duplicar, mantendo só o principal do negócio primário; empresa do primário prevalece.

## Após aplicar

- Consultas de conferência mostradas a você: negócios sem empresa (esperado 0), negócios sem contato principal, total de empresas e contatos, top 10 empresas por número de negócios.
- Tipos do banco regenerados; `Company`, `Contact`, `LeadContact` adicionados em `src/types/index.ts`. Nenhum componente alterado.
- Teste rápido: criar e editar um negócio pelo app e conferir que empresa e contato principal foram criados/atualizados, e que a exportação continua trazendo o contato.
