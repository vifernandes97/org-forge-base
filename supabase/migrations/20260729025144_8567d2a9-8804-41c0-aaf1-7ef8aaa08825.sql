CREATE OR REPLACE FUNCTION public.get_dashboard_summary(p_org_id uuid, p_funnel_id uuid, p_date_from timestamp with time zone, p_date_to timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
  v_period_length interval;
  v_prev_from timestamptz;
  v_prev_to timestamptz;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM organization_members WHERE organization_id = p_org_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  v_period_length := p_date_to - p_date_from;
  v_prev_from := p_date_from - v_period_length;
  v_prev_to := p_date_from;

  SELECT jsonb_build_object(
    'total_leads', (SELECT count(*) FROM leads WHERE organization_id = p_org_id AND (p_funnel_id IS NULL OR funnel_id = p_funnel_id) AND created_at >= p_date_from AND created_at <= p_date_to),
    'new_leads', (SELECT count(*) FROM leads WHERE organization_id = p_org_id AND (p_funnel_id IS NULL OR funnel_id = p_funnel_id) AND created_at >= p_date_from AND created_at <= p_date_to),
    'new_leads_previous', (SELECT count(*) FROM leads WHERE organization_id = p_org_id AND (p_funnel_id IS NULL OR funnel_id = p_funnel_id) AND created_at >= v_prev_from AND created_at <= v_prev_to),
    'pipeline_value', COALESCE((SELECT sum(value) FROM leads WHERE organization_id = p_org_id AND (p_funnel_id IS NULL OR funnel_id = p_funnel_id) AND created_at >= p_date_from AND created_at <= p_date_to), 0),
    'conversion_count', (
      SELECT count(*) FROM leads l
      JOIN stages s ON l.stage_id = s.id
      WHERE l.organization_id = p_org_id
        AND (p_funnel_id IS NULL OR l.funnel_id = p_funnel_id)
        AND l.created_at >= p_date_from AND l.created_at <= p_date_to
        AND s.position = (SELECT max(s2.position) FROM stages s2 WHERE s2.funnel_id = l.funnel_id)
    )
  ) INTO v_result;
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_funnel_metrics(p_org_id uuid, p_funnel_id uuid, p_date_from timestamp with time zone DEFAULT NULL, p_date_to timestamp with time zone DEFAULT NULL)
 RETURNS TABLE(stage_id uuid, stage_name text, stage_color text, stage_position integer, lead_count bigint, total_value numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM organization_members WHERE organization_id = p_org_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  RETURN QUERY
    SELECT s.id, s.name, s.color, s.position, count(l.id), COALESCE(sum(l.value), 0)
    FROM stages s
    LEFT JOIN leads l
      ON l.stage_id = s.id
     AND l.organization_id = p_org_id
     AND (p_date_from IS NULL OR l.created_at >= p_date_from)
     AND (p_date_to IS NULL OR l.created_at <= p_date_to)
    WHERE s.funnel_id = p_funnel_id AND s.organization_id = p_org_id
    GROUP BY s.id, s.name, s.color, s.position
    ORDER BY s.position;
END;
$function$;