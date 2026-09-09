# Importar negócios por planilha

Nova opção "Importar planilha" na tela de Negócios (menu ao lado de "Exportar CSV"), com um assistente em 3 passos.

## Como vai funcionar

1. **Enviar arquivo** — aceita CSV e Excel (.xlsx). Mostra as primeiras linhas para conferência.
2. **Relacionar colunas** — a tela sugere automaticamente a correspondência entre as colunas da planilha e os campos do sistema (Empresa, Nome do contato, E-mail, Telefone, Valor, Prioridade, Qualificação, Fonte, Tags, Observações) e também os campos personalizados da empresa. É possível ajustar ou ignorar qualquer coluna.
3. **Destino e conferência** — escolher o funil e a etapa em que todos os negócios vão entrar, ver quantas linhas serão criadas, quantas já existem e quantas têm erro. Só depois de confirmar é que a importação acontece.

Regras aplicadas:
- Cada linha precisa de pelo menos empresa/nome ou telefone/e-mail.
- Duplicados (mesmo telefone ou e-mail na empresa) são **atualizados**, mantendo a etapa atual e preenchendo dados que estavam vazios.
- Linhas com erro não interrompem a importação: no final aparece o resumo (criados, atualizados, ignorados) com a lista de linhas com problema e a possibilidade de baixar um CSV de erros.
- Cada negócio criado ou atualizado recebe um registro na linha do tempo: "Importado via planilha".
- Um modelo de planilha pode ser baixado com as colunas certas, incluindo os campos personalizados da empresa.
- Somente quem pode criar negócios (owner, admin, member) vê a opção.

## Detalhes técnicos

- Biblioteca de leitura: `papaparse` para CSV e `xlsx` (SheetJS) para .xlsx — leitura toda no navegador, sem função de servidor.
- Novos arquivos: `src/components/leads/import/ImportLeadsDialog.tsx` (assistente), `ColumnMappingStep.tsx`, `ImportSummaryStep.tsx`, `src/lib/spreadsheet.ts` (parse + normalização de telefone/valor/data, reaproveitando as mesmas regras de alias do webhook de entrada).
- Novo serviço `src/services/leadsImport.ts`: `importLeads({ orgId, funnelId, stageId, rows, mapping })`, processando em lotes de 50 com `createLead`/`updateLead` já existentes, `custom_field_values` via upsert e `lead_activities` para o registro de importação. Detecção de duplicado por consulta `ilike` em `phone`/`email` dentro da organização.
- `LeadsPage.tsx`: novo item de menu e estado do diálogo; invalida `['leads-kanban', orgId, funnelId]` e `['leads-list', ...]` ao concluir.
- Sem alterações no banco: usa `leads`, `custom_field_definitions`, `custom_field_values` e `lead_activities` existentes.
