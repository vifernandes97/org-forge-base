-- Ranking do Dashboard quebrado desde o Lovable (a produção de lá tinha a
-- mesma função, conferido no export de 2026-10-26): RETURNS TABLE declara
-- user_id, e o "user_id = auth.uid()" sem prefixo na checagem de acesso fica
-- ambíguo — o PL/pgSQL recusa ("column reference user_id is ambiguous") e o
-- card do ranking nunca carregava. Só essa linha muda: organization_members
-- ganha o apelido om. O resto é a função de antes, igual.

CREATE OR REPLACE FUNCTION public.get_team_ranking(p_org_id uuid, p_date_from timestamp with time zone, p_date_to timestamp with time zone, p_funnel_id uuid)
 RETURNS TABLE(user_id uuid, full_name text, avatar_url text, leads_count bigint, converted_count bigint, total_value numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = p_org_id AND om.user_id = auth.uid()) THEN
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
$function$;
