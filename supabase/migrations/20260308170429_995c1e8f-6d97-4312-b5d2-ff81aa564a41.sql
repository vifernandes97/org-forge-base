
-- Add status column to leads
ALTER TABLE public.leads ADD COLUMN status text NOT NULL DEFAULT 'open';

-- Update already archived leads
UPDATE public.leads SET status = 'inactive' WHERE archived_at IS NOT NULL;

-- Create validation trigger
CREATE OR REPLACE FUNCTION public.validate_lead_status()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status NOT IN ('open', 'won', 'inactive') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_validate_lead_status
  BEFORE INSERT OR UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_lead_status();
