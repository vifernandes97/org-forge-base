
-- RPC: get_dashboard_summary
CREATE OR REPLACE FUNCTION public.get_dashboard_summary(
  p_org_id uuid, p_funnel_id uuid, p_date_from timestamptz, p_date_to timestamptz
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
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
    'total_leads', (SELECT count(*) FROM leads WHERE organization_id = p_org_id AND (p_funnel_id IS NULL OR funnel_id = p_funnel_id)),
    'new_leads', (SELECT count(*) FROM leads WHERE organization_id = p_org_id AND (p_funnel_id IS NULL OR funnel_id = p_funnel_id) AND created_at >= p_date_from AND created_at <= p_date_to),
    'new_leads_previous', (SELECT count(*) FROM leads WHERE organization_id = p_org_id AND (p_funnel_id IS NULL OR funnel_id = p_funnel_id) AND created_at >= v_prev_from AND created_at <= v_prev_to),
    'pipeline_value', COALESCE((SELECT sum(value) FROM leads WHERE organization_id = p_org_id AND (p_funnel_id IS NULL OR funnel_id = p_funnel_id)), 0),
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
$$;

-- RPC: get_leads_by_period
CREATE OR REPLACE FUNCTION public.get_leads_by_period(
  p_org_id uuid, p_funnel_id uuid, p_date_from timestamptz, p_date_to timestamptz, p_interval text
) RETURNS TABLE(period_start timestamptz, lead_count bigint) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM organization_members WHERE organization_id = p_org_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  RETURN QUERY
    SELECT date_trunc(p_interval, l.created_at) as period_start, count(*) as lead_count
    FROM leads l
    WHERE l.organization_id = p_org_id
      AND (p_funnel_id IS NULL OR l.funnel_id = p_funnel_id)
      AND l.created_at >= p_date_from AND l.created_at <= p_date_to
    GROUP BY 1 ORDER BY 1;
END;
$$;

-- RPC: get_funnel_metrics
CREATE OR REPLACE FUNCTION public.get_funnel_metrics(p_org_id uuid, p_funnel_id uuid)
RETURNS TABLE(stage_id uuid, stage_name text, stage_color text, stage_position int, lead_count bigint, total_value numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM organization_members WHERE organization_id = p_org_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  RETURN QUERY
    SELECT s.id, s.name, s.color, s.position, count(l.id), COALESCE(sum(l.value), 0)
    FROM stages s
    LEFT JOIN leads l ON l.stage_id = s.id AND l.organization_id = p_org_id
    WHERE s.funnel_id = p_funnel_id AND s.organization_id = p_org_id
    GROUP BY s.id, s.name, s.color, s.position
    ORDER BY s.position;
END;
$$;

-- RPC: get_team_ranking
CREATE OR REPLACE FUNCTION public.get_team_ranking(
  p_org_id uuid, p_date_from timestamptz, p_date_to timestamptz, p_funnel_id uuid
) RETURNS TABLE(user_id uuid, full_name text, avatar_url text, leads_count bigint, converted_count bigint, total_value numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM organization_members WHERE organization_id = p_org_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  RETURN QUERY
    SELECT l.assigned_to, p.full_name, p.avatar_url,
      count(*),
      count(*) FILTER (WHERE s.position = (SELECT max(s2.position) FROM stages s2 WHERE s2.funnel_id = l.funnel_id)),
      COALESCE(sum(l.value), 0)
    FROM leads l
    JOIN profiles p ON p.id = l.assigned_to
    JOIN stages s ON s.id = l.stage_id
    WHERE l.organization_id = p_org_id
      AND (p_funnel_id IS NULL OR l.funnel_id = p_funnel_id)
      AND l.created_at >= p_date_from AND l.created_at <= p_date_to
    GROUP BY l.assigned_to, p.full_name, p.avatar_url
    ORDER BY sum(l.value) DESC
    LIMIT 10;
END;
$$;
