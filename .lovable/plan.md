# Fase 3 — Webhook de entrada e importação com Empresa, Segmento e Contatos

## 0. Webhooks de entrada ativos hoje (somente leitura)

| Organização | Webhook | Funil de destino | Etapa | Duplicado | Mapeamento salvo | Recebimentos 30 dias |
|---|---|---|---|---|---|---|
| DDATA | Novo Webhook de Entrada | Inbound | primeira | update | nenhum | 3 |
| ICS Logistics | Form LP Intermodal | funil padrão | primeira | update | nenhum | 0 |
| ICS Logistics | Form Site | funil padrão | primeira | update | campo personalizado tipo_de_negocio ← campo "service" do formulário | 10 |
| Oniplataforma | Novo Webhook de Entrada | funil padrão | primeira | update | campo personalizado media_de_festas ← media_de_festas | 103 |
| Oniplataforma | Formulario Demo -> Novo lead | funil padrão | primeira | update | campo personalizado media_de_festas ← media_de_festas | 0 |

Chaves recebidas nos últimos 60 dias (todas as organizações): company 249, email 242, name 242, phone 241, tipo_de_negocio 239, cidade 239, utm_* ~170, your-name / your-email / your-phone / your-message / service 10 (ICS), notes 2 e outras raras.
Nenhum webhook mapeia hoje name/email/phone/company explicitamente; tudo chega pelos apelidos automáticos. Esses apelidos continuam valendo.

Pontos de atenção:
- No "Form Site" da ICS, o campo personalizado "Tipo de negócio" é preenchido pelo mapeamento explícito do campo "service", não pelo vínculo automático. Mapeamento explícito não muda, então a ICS continua igual.
- "companyname" hoje é apelido tanto de company quanto de company_name. Mantenho a prioridade atual (company) para não mudar o comportamento.

## 1. Função única de resolução (banco)
`resolve_company_contact(org, trade_name, legal_name, cnpj, instagram, segment, contact_name, email, phone, company_value)`:
- Interpretação igual à do backfill: valor de empresa que é segmento conhecido vai para o segmento. Valor genérico ou com "@" é tratado como vazio. Razão social sem sufixo formal vira nome fantasia; com sufixo formal, vai para razão social.
- Segmentos conhecidos vêm da lista de segmentos do workspace (Fase 2.5), com os apelidos já existentes, e não mais do texto antigo.
- Ordem: CNPJ → contato existente (e-mail, ou telefone + mesmo nome) → chave do nome fantasia/razão social (nunca quando o nome veio do contato) → empresa nova (nome fantasia, Instagram sem "@", nome do contato, e-mail, "Sem nome").
- Na empresa encontrada, preenche só os campos vazios. Contato pela regra de dedupe aprovada.
- Retorna company_id, contact_id e se cada um foi criado ou reaproveitado. Execução permitida só para o servidor e usuários logados.
- **Segmento informado que não existe na lista:** não cria segmento novo; a empresa fica sem segmento e o log registra o valor recebido.

## 2. Webhook de entrada
- Novos campos: company_trade_name, company_legal_name, company_cnpj, company_instagram, company_segment, contact_name, contact_email, contact_phone. Novos apelidos: nomefantasia, fantasia, cnpj, documento, segmento, ramo, tipodeempresa.
- Chaves antigas mantêm o significado real: company é o "valor de empresa" e passa pelas regras; company_name é a razão social; name, email e phone são o contato; company_instagram é o Instagram.
- O negócio é criado só com a empresa e o contato principal; os campos antigos do negócio deixam de ser gravados.
- Duplicado = negócio ativo (não arquivado e não mesclado) da mesma empresa no mesmo funil. "update" atualiza o negócio, vincula o contato se faltar e mantém a reentrada na etapa inicial; "ignore" não faz nada; "create_new" cria outro negócio na mesma empresa.
- O log registra company_id, contact_id e se cada um foi criado ou reaproveitado.
- Vínculo automático: tipo_de_negocio / tipodenegocio / segmento / ramo / "tipo de negócio" alimentam o segmento da empresa, não mais o campo personalizado. Os demais vínculos automáticos não mudam. Mapeamentos explícitos (ex.: ICS "service") também não mudam.
- Tela de edição do webhook: campos do CRM agrupados em Empresa e Contato. Mapeamentos salvos com chaves antigas abrem mostrando o campo novo correspondente.
- Depois de publicar: preencher de novo o segmento na Oniplataforma a partir do "Tipo de negócio", para empresas ainda sem segmento, com as mesmas regras e a lista de conflitos. Desativar o campo só com a sua confirmação.

## 3. Importação de planilha
- Colunas: Nome fantasia, Razão social, CNPJ, Instagram, Segmento, Nome do contato, E-mail, Telefone, mais os campos de negócio atuais.
- Mesma função de resolução e mesma regra de duplicado. Os campos antigos do negócio deixam de ser gravados.
- Resumo: empresas e contatos criados ou reaproveitados; negócios criados, atualizados ou ignorados. A prévia é calculada antes de gravar, por uma consulta que não altera nada.

## 4. Testes (sem produção)
Na DDATA: funil "TESTE - não usar" com 2 etapas, webhook de saída para o webhook.site, nenhuma automação e um webhook de entrada de teste. Casos:
1. Formato real dos formulários (company "Buffet Infantil", company_name "Casa Teste Festas"): cria "Casa Teste Festas" com segmento Buffet Infantil.
2. Repetir o mesmo envio: não cria empresa nem negócio.
3. Contato existente: cai na empresa dele.
4. CNPJ existente com outro nome: usa a empresa do CNPJ.
5. company "n/a": empresa nova com o nome do contato, sem segmento.
6. Planilha com 3 linhas, pela tela: resumo e resultado.

Para cada caso mostro o log (ação, empresa, contato, criado ou reaproveitado). No fim apago todos os dados de teste.

## Detalhes técnicos
- Migração: função SQL SECURITY DEFINER, search_path=public. EXECUTE revogado de PUBLIC/anon e concedido a service_role e authenticated. Reaproveita normalize_company_key, company_segment_id_from_value, is_blank_company_value e find_company_contact. Parâmetro `p_dry_run` para a prévia da importação.
- inbound_webhook_logs ganha a coluna `resolution jsonb` (nullable).
- A ponte de negócios (bridge_lead_company/contact) continua ativa para gravações antigas e fica sem efeito quando company_id já vem preenchido e os campos antigos não são enviados.
- Arquivos: supabase/functions/inbound-webhook/index.ts, src/pages/InboundWebhookEditPage.tsx, src/services/leadsImport.ts, ColumnMappingStep.tsx, ImportSummaryStep.tsx, ImportLeadsDialog.tsx, src/lib/spreadsheet.ts (modelo).
