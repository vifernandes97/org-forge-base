ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS merged_into_lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS merged_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_leads_merged_into ON public.leads(merged_into_lead_id);

CREATE OR REPLACE FUNCTION public.merge_leads(p_primary_id uuid, p_duplicate_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_primary public.leads;
  v_dup public.leads;
  v_role text;
  v_reason_id uuid;
  v_tasks_moved int := 0;
  v_acts_moved int := 0;
  v_merged int := 0;
  v_t int;
  v_dup_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_primary FROM public.leads WHERE id = p_primary_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Primary deal not found'; END IF;

  v_role := get_user_org_role(v_primary.organization_id);
  IF v_role IS NULL OR v_role NOT IN ('owner','admin','member') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  -- ensure "Duplicado" archive reason
  SELECT id INTO v_reason_id FROM public.archive_reasons
  WHERE organization_id = v_primary.organization_id AND lower(label) = 'duplicado'
  LIMIT 1;
  IF v_reason_id IS NULL THEN
    INSERT INTO public.archive_reasons (organization_id, label, position)
    VALUES (v_primary.organization_id, 'Duplicado',
            COALESCE((SELECT max(position) + 1 FROM public.archive_reasons WHERE organization_id = v_primary.organization_id), 0))
    RETURNING id INTO v_reason_id;
  END IF;

  FOREACH v_dup_id IN ARRAY p_duplicate_ids LOOP
    IF v_dup_id = p_primary_id THEN CONTINUE; END IF;

    SELECT * INTO v_dup FROM public.leads WHERE id = v_dup_id;
    IF NOT FOUND THEN CONTINUE; END IF;
    IF v_dup.organization_id <> v_primary.organization_id THEN
      RAISE EXCEPTION 'Deals belong to different organizations';
    END IF;

    -- fill blanks on primary from duplicate, union tags
    UPDATE public.leads l SET
      name = CASE WHEN COALESCE(l.name,'') = '' THEN COALESCE(v_dup.name, l.name) ELSE l.name END,
      email = COALESCE(NULLIF(l.email,''), v_dup.email),
      phone = COALESCE(NULLIF(l.phone,''), v_dup.phone),
      company = COALESCE(NULLIF(l.company,''), v_dup.company),
      company_name = COALESCE(NULLIF(l.company_name,''), v_dup.company_name),
      company_instagram = COALESCE(NULLIF(l.company_instagram,''), v_dup.company_instagram),
      source = COALESCE(NULLIF(l.source,''), v_dup.source),
      assigned_to = COALESCE(l.assigned_to, v_dup.assigned_to),
      qualification = COALESCE(l.qualification, v_dup.qualification),
      value = CASE WHEN COALESCE(l.value,0) = 0 THEN COALESCE(v_dup.value, l.value) ELSE l.value END,
      tags = (
        SELECT COALESCE(array_agg(DISTINCT t), '{}'::text[])
        FROM (
          SELECT unnest(COALESCE(l.tags, '{}'::text[])) AS t
          UNION
          SELECT unnest(COALESCE(v_dup.tags, '{}'::text[])) AS t
        ) u
        WHERE t IS NOT NULL AND t <> ''
      ),
      notes = CASE
        WHEN COALESCE(NULLIF(v_dup.notes,''), NULL) IS NULL THEN l.notes
        WHEN COALESCE(NULLIF(l.notes,''), NULL) IS NULL THEN v_dup.notes
        ELSE l.notes || E'\n\n--- Mesclado de: ' || COALESCE(v_dup.name,'') || E' ---\n' || v_dup.notes
      END
    WHERE l.id = p_primary_id;

    -- custom field values: copy only keys missing on primary
    INSERT INTO public.custom_field_values (lead_id, field_definition_id, value)
    SELECT p_primary_id, cfv.field_definition_id, cfv.value
    FROM public.custom_field_values cfv
    WHERE cfv.lead_id = v_dup_id
      AND COALESCE(cfv.value,'') <> ''
      AND NOT EXISTS (
        SELECT 1 FROM public.custom_field_values p
        WHERE p.lead_id = p_primary_id
          AND p.field_definition_id = cfv.field_definition_id
          AND COALESCE(p.value,'') <> ''
      )
    ON CONFLICT (lead_id, field_definition_id) DO UPDATE SET value = EXCLUDED.value;

    UPDATE public.tasks SET lead_id = p_primary_id WHERE lead_id = v_dup_id;
    GET DIAGNOSTICS v_t = ROW_COUNT; v_tasks_moved := v_tasks_moved + v_t;

    UPDATE public.lead_activities SET lead_id = p_primary_id WHERE lead_id = v_dup_id;
    GET DIAGNOSTICS v_t = ROW_COUNT; v_acts_moved := v_acts_moved + v_t;

    -- archive duplicate
    UPDATE public.leads SET
      archived_at = now(),
      archive_reason_id = v_reason_id,
      status = 'inactive',
      merged_into_lead_id = p_primary_id,
      merged_at = now()
    WHERE id = v_dup_id;

    -- audit activities
    INSERT INTO public.lead_activities (organization_id, lead_id, user_id, activity_type, title, description, metadata)
    VALUES (
      v_primary.organization_id, p_primary_id, v_uid, 'note',
      'Negócio mesclado',
      'Dados, tarefas e histórico de "' || COALESCE(v_dup.name,'') || '" foram mesclados neste negócio.',
      jsonb_build_object('merge', true, 'direction', 'absorbed', 'duplicate_lead_id', v_dup_id)
    );

    INSERT INTO public.lead_activities (organization_id, lead_id, user_id, activity_type, title, description, metadata)
    VALUES (
      v_primary.organization_id, v_dup_id, v_uid, 'note',
      'Mesclado em outro negócio',
      'Este negócio foi mesclado em "' || COALESCE(v_primary.name,'') || '" e arquivado como duplicado.',
      jsonb_build_object('merge', true, 'direction', 'merged_into', 'primary_lead_id', p_primary_id)
    );

    v_merged := v_merged + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'primary_lead_id', p_primary_id,
    'merged_count', v_merged,
    'tasks_moved', v_tasks_moved,
    'activities_moved', v_acts_moved
  );
END;
$$;

REVOKE ALL ON FUNCTION public.merge_leads(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_leads(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.merge_leads(uuid, uuid[]) TO service_role;