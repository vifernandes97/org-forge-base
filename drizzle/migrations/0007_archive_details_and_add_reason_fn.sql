ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS archive_details text;

CREATE OR REPLACE FUNCTION public.add_archive_reason(p_org_id uuid, p_label text)
RETURNS public.archive_reasons
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_label text;
  v_row public.archive_reasons;
BEGIN
  v_label := btrim(coalesce(p_label, ''));
  IF v_label = '' THEN
    RAISE EXCEPTION 'Motivo inválido';
  END IF;

  IF p_org_id NOT IN (SELECT public.get_user_org_ids()) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  SELECT * INTO v_row
  FROM public.archive_reasons
  WHERE organization_id = p_org_id
    AND lower(btrim(label)) = lower(v_label)
  LIMIT 1;

  IF v_row.id IS NOT NULL THEN
    IF NOT v_row.is_active THEN
      UPDATE public.archive_reasons SET is_active = true WHERE id = v_row.id RETURNING * INTO v_row;
    END IF;
    RETURN v_row;
  END IF;

  INSERT INTO public.archive_reasons (organization_id, label, position)
  VALUES (
    p_org_id,
    v_label,
    coalesce((SELECT max(position) + 1 FROM public.archive_reasons WHERE organization_id = p_org_id), 0)
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.add_archive_reason(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_archive_reason(uuid, text) TO authenticated;