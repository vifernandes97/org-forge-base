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
