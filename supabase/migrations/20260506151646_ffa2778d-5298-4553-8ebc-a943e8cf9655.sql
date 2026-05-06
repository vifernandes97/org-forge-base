CREATE OR REPLACE FUNCTION public.validate_activity_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.activity_type NOT IN ('note','call','email','meeting','stage_change','field_update','task_created','task_completed','webhook_sent','webhook_failed') THEN
    RAISE EXCEPTION 'Invalid activity_type: %', NEW.activity_type;
  END IF;
  RETURN NEW;
END;
$function$;