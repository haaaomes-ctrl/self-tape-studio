CREATE OR REPLACE FUNCTION public.seed_reconciler_vault_secret(p_value text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_id uuid;
  v_existing uuid;
BEGIN
  SELECT id INTO v_existing FROM vault.secrets WHERE name = 'reconciler_secret';
  IF v_existing IS NOT NULL THEN
    PERFORM vault.update_secret(v_existing, p_value, 'reconciler_secret');
    RETURN 'updated';
  ELSE
    SELECT vault.create_secret(p_value, 'reconciler_secret') INTO v_id;
    RETURN 'created';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_reconciler_vault_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_reconciler_vault_secret(text) TO service_role;