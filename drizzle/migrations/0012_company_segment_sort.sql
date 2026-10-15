ALTER TABLE public.companies ADD COLUMN segment_sort integer;
COMMENT ON COLUMN public.companies.segment_sort IS 'Denormalized company_segments.position for server-side sorting; maintained by triggers. NULL = no segment.';
UPDATE public.companies c SET segment_sort = s.position FROM public.company_segments s WHERE s.id = c.segment_id;

CREATE OR REPLACE FUNCTION public.sync_company_segment_sort() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  NEW.segment_sort := (SELECT position FROM public.company_segments WHERE id = NEW.segment_id);
  RETURN NEW;
END $$;
CREATE TRIGGER companies_segment_sort_trg BEFORE INSERT OR UPDATE OF segment_id ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.sync_company_segment_sort();

CREATE OR REPLACE FUNCTION public.propagate_segment_position() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.companies SET segment_sort = NEW.position WHERE segment_id = NEW.id;
  RETURN NEW;
END $$;
CREATE TRIGGER company_segments_position_trg AFTER UPDATE OF position ON public.company_segments
  FOR EACH ROW WHEN (OLD.position IS DISTINCT FROM NEW.position) EXECUTE FUNCTION public.propagate_segment_position();

REVOKE ALL ON FUNCTION public.sync_company_segment_sort() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.propagate_segment_position() FROM PUBLIC, anon, authenticated;