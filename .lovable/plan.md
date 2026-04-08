
# Exportar CSV a partir dos filtros atuais na página de Leads

## Resumo
Adicionar um botão "Exportar CSV" na página de leads que busca todos os leads do funil selecionado com os filtros atuais aplicados e gera um arquivo CSV para download no navegador.

## Mudanças

### 1. `src/services/leads.ts` — nova função `exportLeadsCSV`
Criar função que busca todos os leads filtrados (sem paginação) usando `getLeadsByFunnel` e converte para CSV com colunas: Nome, Email, Telefone, Empresa, Valor, Prioridade, Qualificação, Fonte, Tags, Etapa, Responsável, Status, Criado em.

### 2. `src/pages/LeadsPage.tsx` — botão de exportação
Adicionar um botão `Download` ao lado do botão "Novo Lead" que:
- Chama `getLeadsByFunnel(selectedFunnelId, filters)` para obter os dados
- Converte para CSV usando a função utilitária
- Dispara o download no navegador via `Blob` + `URL.createObjectURL`
- Mostra estado de loading durante a busca

### 3. `src/lib/exportCsv.ts` — utilitário de conversão
Criar função genérica `downloadCSV(rows, filename)` que:
- Recebe array de objetos com os campos já formatados
- Gera string CSV com escape correto de aspas/vírgulas
- Dispara download via link temporário

| Arquivo | Ação |
|---------|------|
| `src/lib/exportCsv.ts` | Utilitário genérico de download CSV |
| `src/pages/LeadsPage.tsx` | Botão de exportação + lógica de fetch e download |
