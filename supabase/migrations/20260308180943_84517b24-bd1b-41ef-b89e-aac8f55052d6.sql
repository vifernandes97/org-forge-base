
-- Add trigger_type column
ALTER TABLE public.stage_task_templates
  ADD COLUMN trigger_type text NOT NULL DEFAULT 'stage_enter';

-- Update execute_stage_task_automations to use trigger_type for routing
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
  v_target_stage uuid;
BEGIN
  -- Handle stage_enter trigger type
  IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
    FOR v_template IN
      SELECT * FROM stage_task_templates
      WHERE trigger_type = 'stage_enter'
        AND stage_id = NEW.stage_id
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
          NEW.organization_id, NEW.id, v_assigned_to,
          v_template.title, v_template.description, v_template.task_type,
          v_template.priority, now() + (v_template.due_hours * interval '1 hour')
        );

      ELSIF v_template.action_type = 'send_webhook' AND v_template.webhook_url IS NOT NULL THEN
        v_payload := jsonb_build_object(
          'event', 'lead.stage_changed',
          'lead_id', NEW.id, 'lead_name', NEW.name,
          'organization_id', NEW.organization_id,
          'stage_id', NEW.stage_id, 'previous_stage_id', OLD.stage_id,
          'funnel_id', NEW.funnel_id, 'assigned_to', NEW.assigned_to,
          'value', NEW.value, 'email', NEW.email, 'phone', NEW.phone,
          'company', NEW.company, 'source', NEW.source,
          'tags', to_jsonb(NEW.tags), 'timestamp', now()
        );

        INSERT INTO webhook_logs (organization_id, stage_id, lead_id, webhook_url, payload, success, attempt_number, error_message)
        VALUES (NEW.organization_id, NEW.stage_id, NEW.id, v_template.webhook_url, v_payload, false, 0, 'pending_dispatch');

      ELSIF v_template.action_type = 'move_lead' AND v_template.target_funnel_id IS NOT NULL THEN
        v_target_stage := v_template.target_stage_id;
        IF v_target_stage IS NULL THEN
          SELECT id INTO v_target_stage FROM stages
          WHERE funnel_id = v_template.target_funnel_id ORDER BY position ASC LIMIT 1;
        END IF;
        IF v_target_stage IS NOT NULL THEN
          NEW.funnel_id := v_template.target_funnel_id;
          NEW.stage_id := v_target_stage;
          NEW.stage_entered_at := now();
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- Handle status_change trigger type
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    FOR v_template IN
      SELECT * FROM stage_task_templates
      WHERE trigger_type = 'status_change'
        AND trigger_status = NEW.status
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
          NEW.organization_id, NEW.id, v_assigned_to,
          v_template.title, v_template.description, v_template.task_type,
          v_template.priority, now() + (v_template.due_hours * interval '1 hour')
        );

      ELSIF v_template.action_type = 'send_webhook' AND v_template.webhook_url IS NOT NULL THEN
        v_payload := jsonb_build_object(
          'event', 'lead.status_changed',
          'lead_id', NEW.id, 'lead_name', NEW.name,
          'organization_id', NEW.organization_id,
          'status', NEW.status, 'previous_status', OLD.status,
          'funnel_id', NEW.funnel_id, 'stage_id', NEW.stage_id,
          'assigned_to', NEW.assigned_to, 'value', NEW.value,
          'email', NEW.email, 'phone', NEW.phone,
          'company', NEW.company, 'source', NEW.source,
          'tags', to_jsonb(NEW.tags), 'timestamp', now()
        );

        INSERT INTO webhook_logs (organization_id, stage_id, lead_id, webhook_url, payload, success, attempt_number, error_message)
        VALUES (NEW.organization_id, NEW.stage_id, NEW.id, v_template.webhook_url, v_payload, false, 0, 'pending_dispatch');

      ELSIF v_template.action_type = 'move_lead' AND v_template.target_funnel_id IS NOT NULL THEN
        v_target_stage := v_template.target_stage_id;
        IF v_target_stage IS NULL THEN
          SELECT id INTO v_target_stage FROM stages
          WHERE funnel_id = v_template.target_funnel_id ORDER BY position ASC LIMIT 1;
        END IF;
        IF v_target_stage IS NOT NULL THEN
          NEW.funnel_id := v_template.target_funnel_id;
          NEW.stage_id := v_target_stage;
          NEW.stage_entered_at := now();
        END IF;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;
