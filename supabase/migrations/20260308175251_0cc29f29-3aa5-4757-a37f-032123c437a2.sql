
-- Add action_type and webhook fields to stage_task_templates
ALTER TABLE public.stage_task_templates
  ADD COLUMN action_type text NOT NULL DEFAULT 'create_task',
  ADD COLUMN webhook_url text,
  ADD COLUMN webhook_secret text;

-- Validation trigger for action_type
CREATE OR REPLACE FUNCTION public.validate_stage_task_template_action_type()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.action_type NOT IN ('create_task', 'send_webhook') THEN
    RAISE EXCEPTION 'Invalid action_type: %', NEW.action_type;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER validate_stage_task_template_action_type_trigger
  BEFORE INSERT OR UPDATE ON public.stage_task_templates
  FOR EACH ROW EXECUTE FUNCTION public.validate_stage_task_template_action_type();

-- Update the automation trigger to handle webhook via pg_net
CREATE OR REPLACE FUNCTION public.execute_stage_task_automations()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_template RECORD;
  v_assigned_to uuid;
  v_payload jsonb;
  v_supabase_url text;
  v_service_role_key text;
BEGIN
  IF OLD.stage_id IS NOT DISTINCT FROM NEW.stage_id THEN
    RETURN NEW;
  END IF;

  FOR v_template IN
    SELECT * FROM stage_task_templates
    WHERE stage_id = NEW.stage_id
      AND organization_id = NEW.organization_id
      AND is_active = true
  LOOP
    IF v_template.action_type = 'create_task' THEN
      IF v_template.assign_to_lead_owner AND NEW.assigned_to IS NOT NULL THEN
        v_assigned_to := NEW.assigned_to;
      ELSE
        v_assigned_to := COALESCE(NEW.assigned_to, auth.uid());
      END IF;

      INSERT INTO tasks (organization_id, lead_id, assigned_to, title, description, task_type, priority, due_date)
      VALUES (
        NEW.organization_id,
        NEW.id,
        v_assigned_to,
        v_template.title,
        v_template.description,
        v_template.task_type,
        v_template.priority,
        now() + (v_template.due_hours * interval '1 hour')
      );
    ELSIF v_template.action_type = 'send_webhook' AND v_template.webhook_url IS NOT NULL THEN
      v_payload := jsonb_build_object(
        'event', 'lead.stage_changed',
        'lead_id', NEW.id,
        'lead_name', NEW.name,
        'organization_id', NEW.organization_id,
        'stage_id', NEW.stage_id,
        'previous_stage_id', OLD.stage_id,
        'funnel_id', NEW.funnel_id,
        'assigned_to', NEW.assigned_to,
        'value', NEW.value,
        'email', NEW.email,
        'phone', NEW.phone,
        'company', NEW.company,
        'source', NEW.source,
        'tags', to_jsonb(NEW.tags),
        'timestamp', now()
      );

      -- Get supabase URL and key from vault/env for edge function call
      v_supabase_url := current_setting('app.settings.supabase_url', true);
      v_service_role_key := current_setting('app.settings.service_role_key', true);

      -- Insert into webhook_logs as a record, and let the existing fire-webhook infrastructure handle it
      INSERT INTO webhook_logs (organization_id, stage_id, lead_id, webhook_url, payload, success, attempt_number, error_message)
      VALUES (
        NEW.organization_id,
        NEW.stage_id,
        NEW.id,
        v_template.webhook_url,
        v_payload,
        false,
        0,
        'pending_dispatch'
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;
