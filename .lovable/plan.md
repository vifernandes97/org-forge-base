
## Deletar todos os leads da organização

**Total de leads a deletar:** 11 registros
- Vinicius
- Ana Oliveira
- Roberto Santos
- Fernanda Costa
- Marcos Pereira
- Carlos Silva
- Ricardo Almeida
- Patrícia Lima
- Eduardo Nakamura
- Camila Rodrigues
- Juliana Mendes

**Ação:**
Executar uma query SQL DELETE que remove todos os leads com `organization_id = '13a96fcb-faed-42f4-8a88-85c0a7103b98'`.

**Efeitos cascata:**
- Todos os `custom_field_values` vinculados a esses leads serão deletados automaticamente (FK com ON DELETE CASCADE)
- Todos os `lead_activities` vinculados serão deletados automaticamente
- Todos os `tasks` vinculados serão deletados automaticamente
- Nenhuma outra tabela será afetada

**SQL:**
```sql
DELETE FROM leads 
WHERE organization_id = '13a96fcb-faed-42f4-8a88-85c0a7103b98'
```

Esta ação é **irreversível**. Confirme para prosseguir.
