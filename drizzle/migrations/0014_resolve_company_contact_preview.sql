CREATE OR REPLACE FUNCTION public.resolve_company_contact_preview(
  p_org uuid,
  p_trade_name text DEFAULT NULL, p_legal_name text DEFAULT NULL, p_cnpj text DEFAULT NULL,
  p_instagram text DEFAULT NULL, p_segment text DEFAULT NULL, p_segment_hint text DEFAULT NULL,
  p_company_value text DEFAULT NULL,
  p_contact_name text DEFAULT NULL, p_email text DEFAULT NULL, p_phone text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE res jsonb;
BEGIN
  -- Same resolution, run inside a rolled-back subtransaction: nothing is saved.
  BEGIN
    res := public.resolve_company_contact(p_org, p_trade_name, p_legal_name, p_cnpj, p_instagram, p_segment,
      p_segment_hint, p_company_value, p_contact_name, p_email, p_phone);
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = '__preview_rollback__';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> '__preview_rollback__' THEN RAISE; END IF;
  END;
  RETURN res || jsonb_build_object('dry_run', true);
END $$;
REVOKE ALL ON FUNCTION public.resolve_company_contact_preview(uuid, text, text, text, text, text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_company_contact_preview(uuid, text, text, text, text, text, text, text, text, text, text) TO authenticated, service_role;