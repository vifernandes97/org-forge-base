DROP TRIGGER IF EXISTS execute_stage_task_automations_trigger ON leads;

CREATE TRIGGER execute_stage_task_automations_trigger
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION execute_stage_task_automations();