

# Fix: Trigger de automação não executa `move_lead`

## Problema raiz
O trigger `execute_stage_task_automations_trigger` está configurado como **AFTER UPDATE**, mas a ação `move_lead` modifica `NEW.funnel_id` e `NEW.stage_id` — o que só funciona em triggers **BEFORE UPDATE**. Em AFTER triggers, modificar `NEW` não tem efeito.

## Solução
Migration SQL para recriar o trigger como BEFORE UPDATE:

```sql
DROP TRIGGER IF EXISTS execute_stage_task_automations_trigger ON leads;

CREATE TRIGGER execute_stage_task_automations_trigger
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION execute_stage_task_automations();
```

## Cuidado com ordem de triggers
Já existe `trg_execute_automations` (BEFORE UPDATE) que executa `execute_automations()`. Ambos os triggers BEFORE UPDATE vão executar em ordem alfabética. Como `execute_stage_task_automations_trigger` vem depois de `trg_execute_automations` alfabeticamente, a ordem está correta.

## Teste
Após a migration, marcar o lead como "won" novamente deve movê-lo automaticamente para o funil destino configurado na automação.

| Ação | Detalhe |
|------|---------|
| Migration SQL | Recriar trigger como BEFORE UPDATE |

