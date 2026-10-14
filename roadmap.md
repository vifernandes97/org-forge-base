# Roadmap — Fase 2 (Empresa, Segmento, Contatos nas telas)

- [ ] Migração: default '' em leads.name; search_leads (SECURITY INVOKER); merge_companies (bloqueia CNPJ diferente, atividade igual merge_leads)
- [ ] Services/hooks: companies, contacts, leadContacts; select de leads com company + lead_contacts; busca via rpc search_leads
- [ ] getLeadDisplay em src/lib
- [ ] LeadFormDialog: empresa (combobox + criar), segmento, CNPJ (máscara/validação/duplicado), contatos
- [ ] LeadDetailSheet: bloco empresa inline, trocar empresa, mesclar empresas, contatos, outros negócios
- [ ] Cards, ListView (ordenação servidor empresa/segmento), TaskItem, MergeLeadsDialog
- [ ] Filtros Segmento/Empresa via relacionamento; filtros salvos antigos
- [ ] Excluir contato com confirmação e troca de principal
- [ ] Exportação CSV via novas tabelas
- [ ] fire-webhook: company + contacts, campos planos deprecated (company=segmento, company_name=nome fantasia)
- [ ] Testes no navegador + payload de webhook de saída
