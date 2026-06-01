DROP FUNCTION IF EXISTS public.get_archive_reasons_summary(uuid, uuid, timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION public.get_archive_reasons_summary(
  p_org_id uuid,
  p_funnel_id uuid,
  p_date_from timestamptz,
  p_date_to timestamptz,
  p_assigned_to uuid[] DEFAULT NULL
)
RETURNS TABLE(archive_reason_id uuid, label text, count bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM organization_members WHERE organization_id = p_org_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    l.archive_reason_id,
    COALESCE(ar.label, 'Sem motivo informado') AS label,
    count(*)::bigint AS count
  FROM leads l
  LEFT JOIN archive_reasons ar ON ar.id = l.archive_reason_id
  WHERE l.organization_id = p_org_id
    AND l.archived_at IS NOT NULL
    AND (p_funnel_id IS NULL OR l.funnel_id = p_funnel_id)
    AND (p_date_from IS NULL OR l.created_at >= p_date_from)
    AND (p_date_to   IS NULL OR l.created_at <= p_date_to)
    AND (p_assigned_to IS NULL OR l.assigned_to = ANY(p_assigned_to))
  GROUP BY l.archive_reason_id, ar.label
  ORDER BY count(*) DESC;
END;
$$;