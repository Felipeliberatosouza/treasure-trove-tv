-- Helper: preview max cashback usable for a given cart amount
CREATE OR REPLACE FUNCTION public.preview_cashback_usage(_user_id uuid, _cart_amount numeric)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg jsonb := public.get_cashback_config();
  acc public.cashback_accounts%rowtype;
  available numeric := 0;
  max_pct numeric;
  cap_by_pct numeric;
  max_usable numeric;
BEGIN
  IF NOT COALESCE((cfg->>'enabled')::boolean, true) THEN
    RETURN jsonb_build_object('enabled', false, 'available', 0, 'max_usable', 0, 'max_checkout_pct', 0);
  END IF;

  SELECT * INTO acc FROM public.cashback_accounts WHERE user_id = _user_id;
  IF FOUND THEN
    available := COALESCE(acc.balance_available, 0);
  END IF;

  max_pct := COALESCE((cfg->>'max_checkout_pct')::numeric, 50);
  cap_by_pct := round((COALESCE(_cart_amount, 0) * max_pct / 100)::numeric, 2);
  max_usable := least(available, cap_by_pct);
  IF max_usable < 0 THEN max_usable := 0; END IF;

  RETURN jsonb_build_object(
    'enabled', true,
    'available', available,
    'max_checkout_pct', max_pct,
    'cart_amount', COALESCE(_cart_amount, 0),
    'max_usable', max_usable
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.preview_cashback_usage(uuid, numeric) TO authenticated;