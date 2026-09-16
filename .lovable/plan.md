# Arquivamento: criar motivo na hora e campo de detalhes

Ao arquivar um negócio, a janela passa a permitir digitar um motivo novo (salvo na lista da empresa na hora) e escrever detalhes opcionais sobre o arquivamento.

## Como vai funcionar

- No lugar da lista fixa de motivos, aparece um campo de busca com os motivos cadastrados.
- Ao digitar um motivo que ainda não existe, aparece "Criar «texto digitado»"; ao confirmar, ele é salvo na lista da empresa e já fica selecionado.
- Qualquer membro da empresa pode criar motivos (hoje só proprietário/administrador conseguia, na tela de configurações).
- Motivo repetido (diferindo só por maiúsculas/espaços) não duplica: reaproveita o existente.
- Novo campo "Detalhes (opcional)": área de texto livre para explicar o arquivamento. Não é obrigatório.
- Os detalhes ficam guardados no negócio, aparecem no histórico junto com o motivo ("Negócio arquivado — Motivo: X / Detalhes: …") e são exibidos no negócio arquivado.
- Ao desarquivar, motivo e detalhes são limpos, como já acontece hoje com o motivo.
- Os detalhes entram na exportação CSV dos negócios, junto do motivo.
- O arquivamento em massa (seleção na lista) continua como está: escolha de um motivo existente, sem detalhes.

## Detalhes técnicos

- Migração 1: coluna `leads.archive_details text` (nullable, aditiva).
- Migração 2: `add_archive_reason(p_org_id uuid, p_label text)` em `SECURITY DEFINER`, `EXECUTE` só para `authenticated`. Valida `p_org_id IN (SELECT get_user_org_ids())`, faz match case-insensitive por `lower(btrim(label))` na organização (reativando `is_active` se estava desativado), senão insere com `position = max+1`, e retorna a linha de `archive_reasons`. Evita afrouxar as policies de INSERT/UPDATE de `archive_reasons`, que seguem owner/admin.
- `src/services/archiveReasons.ts`: `addArchiveReason(orgId, label)` via RPC; `src/hooks/useArchiveReasons.ts`: `useAddArchiveReason` invalidando `['archive-reasons']` e `['archive-reasons-active']`.
- `src/services/leads.ts`: `archiveLead(id, archiveReasonId, details?)` grava `archive_details`; `unarchiveLead` limpa `archive_details`; `getLeadById` já traz `*`. `src/hooks/useLeads.ts`: `useArchiveLead` aceita `details`.
- `src/components/leads/LeadDetailSheet.tsx`: no diálogo de arquivar, trocar o `Select` por um combobox (`Popover` + `Command`) com item "Criar …", e adicionar `Textarea` de detalhes; `handleArchive` envia os detalhes e inclui-os na atividade (`description` e `metadata.details`); ao fechar, limpar motivo e detalhes. Exibir os detalhes na seção do negócio quando arquivado.
- `src/lib/leadsExport.ts`: nova coluna "Detalhes do arquivamento".
- Verificação: `bunx tsgo --noEmit -p tsconfig.app.json` e teste no navegador arquivando um negócio com motivo novo + detalhes.
