# Roadmap — Fase 2 (Empresa, Segmento, Contatos nas telas)

- [x] Migração: default '' em leads.name; search_leads (SECURITY INVOKER); merge_companies (bloqueia CNPJ diferente, atividade igual merge_leads)
- [x] Services/hooks: companies, contacts, leadContacts; select de leads com company + lead_contacts; busca via rpc search_leads
- [x] getLeadDisplay em src/lib
- [x] LeadFormDialog: empresa (combobox + criar), segmento, CNPJ (máscara/validação/duplicado), contatos
- [x] LeadDetailSheet: bloco empresa inline, trocar empresa, mesclar empresas, contatos, outros negócios
- [x] Cards, ListView (ordenação servidor empresa/segmento), TaskItem, MergeLeadsDialog
- [x] Filtros Segmento/Empresa via relacionamento; filtros salvos antigos
- [x] Excluir contato com confirmação e troca de principal
- [x] Exportação CSV via novas tabelas
- [x] fire-webhook: company + contacts, campos planos deprecated (company=segmento, company_name=nome fantasia)
- [x] Testes no navegador + payload de webhook de saída

## Pendente
- [ ] Teste ao vivo: criar negócio novo, disparar webhook de saída e mostrar o payload

# Fase 2.5 — Segmentos por workspace
- [x] Tabela de segmentos, segment_id em empresas, migração, funções, permissões
- [x] Aba Segmentos em Configurações; seletor só com ativos; criar na hora só owner/admin
- [x] Filtro por segment_id + conversão de filtros antigos; exportação e webhook pela nova tabela
- [x] Testes (DDATA, webhook.site) e limpeza
- [x] Oniplataforma: segmento preenchido a partir de "Tipo de negócio" (191 empresas)
- [ ] Desativar campo "Tipo de negócio" na Oniplataforma — só depois da Fase 3 (pedido do usuário)
- [ ] Fase 3: vínculo automático tipo_de_negocio dos webhooks de entrada → company_segment
- [x] Ordenação por segmento: posição configurada, depois nome fantasia, sem segmento por último

# Fase 3 — Webhook de entrada e importação
- [x] Função resolve_company_contact (com dry run) + coluna resolution no log
- [x] inbound-webhook: novos campos/aliases, regras de segmento (prioridade, desconhecido → campo personalizado + log), duplicado por empresa+funil
- [x] InboundWebhookEditPage agrupado Empresa/Contato
- [x] Importação: novas colunas, resolução, resumo
- [x] Testes 1-9 sem produção + limpeza
- [x] Re-preencher segmento Oniplataforma pelo Tipo de negócio
- [ ] Desativar campo Tipo de negócio na Oniplataforma — aguardando confirmação
- [ ] Resumo dos 10 primeiros leads reais da Oniplataforma após publicar — aguardando recebimentos

# Fase 2.6 — Telas de Empresas e Contatos
- [x] Menu, rotas, visões e consultas no servidor, mesclar contatos
- [x] Empresas (lista, filtros, massa, CSV), detalhe com abas, Contatos (lista, filtros, massa, painel ?contact=)
- [x] Testes DDATA e limpeza

# Orquestrador WhatsApp (docs/WHATSAPP.md)
- [x] Fase 1 — fundação: tabelas de canais, fila pg-boss, ROLE api/worker, adapter Evolution, webhook, vínculo por telefone/nome, tela de conexão (testado no dev)
- [x] Fase 1 em produção: aplicar db/60_canais.sql, segredos, deploy, ligar a instância do dono
- [x] Fase 2 — mídia e transcrição (credenciais de IA no front, Groq/OpenAI/compatível, reserva, retenção)
- [ ] Fase 2 em produção: chave da Groq na tela; Volume + MEDIA_DIR (opcional)
- [x] Fase 3 — inteligência: análise com debounce, LLM/modelo no front (Anthropic, OpenAI, Google, Groq, compatível), política, teste a seco
- [ ] Fase 3 em produção: chave do provedor de análise, modelo, instruções da empresa
- [ ] Fase 4 — telas (aba WhatsApp no negócio, painel de operação)
- [ ] Fase 5 — escala (storage externo, segunda Evolution, cotas, teste de carga)
