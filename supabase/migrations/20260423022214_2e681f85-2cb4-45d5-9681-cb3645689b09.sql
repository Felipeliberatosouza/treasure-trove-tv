-- Idempotency: prevent duplicate cashback credits for the same source_reference
-- Partial unique index on (source_reference, kind) for earn_purchase / earn_referral only
CREATE UNIQUE INDEX IF NOT EXISTS cashback_tx_unique_purchase_source
  ON public.cashback_transactions (source_reference)
  WHERE kind = 'earn_purchase' AND source_reference IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS cashback_tx_unique_referral_source
  ON public.cashback_transactions (source_reference)
  WHERE kind = 'earn_referral' AND source_reference IS NOT NULL;

-- Update credit_cashback_purchase to skip if already credited for this source_reference
CREATE OR REPLACE FUNCTION public.credit_cashback_purchase(_user_id uuid, _purchase_amount numeric, _source_type text, _source_reference text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  cfg jsonb := public.get_cashback_config();
  tier_info jsonb;
  pct numeric;
  amt numeric;
  acc_id uuid;
  tx_id uuid;
  existing_id uuid;
  grace int := COALESCE((cfg->>'grace_period_days')::int, 30);
  validity int := COALESCE((cfg->>'validity_days')::int, 365);
  min_amt numeric := COALESCE((cfg->>'min_purchase_amount')::numeric, 0);
BEGIN
  IF NOT COALESCE((cfg->>'enabled')::boolean, true) THEN
    RETURN NULL;
  END IF;
  IF _purchase_amount < min_amt THEN
    RETURN NULL;
  END IF;

  -- Idempotency guard: already credited for this source_reference?
  IF _source_reference IS NOT NULL THEN
    SELECT id INTO existing_id
    FROM public.cashback_transactions
    WHERE kind = 'earn_purchase' AND source_reference = _source_reference
    LIMIT 1;
    IF existing_id IS NOT NULL THEN
      RETURN existing_id;
    END IF;
  END IF;

  tier_info := public.get_user_cashback_tier(_user_id);
  pct := COALESCE((tier_info->'tier'->>'percent')::numeric, 0);
  amt := round((_purchase_amount * pct / 100)::numeric, 2);
  IF amt <= 0 THEN
    RETURN NULL;
  END IF;

  acc_id := public.ensure_cashback_account(_user_id);

  BEGIN
    INSERT INTO public.cashback_transactions (
      user_id, account_id, kind, status, amount,
      source_type, source_purchase_amount, source_reference,
      available_at, expires_at, metadata
    ) VALUES (
      _user_id, acc_id, 'earn_purchase', 'pending', amt,
      _source_type, _purchase_amount, _source_reference,
      now() + (grace || ' days')::interval,
      now() + ((grace + validity) || ' days')::interval,
      jsonb_build_object('tier', tier_info->'tier'->>'id', 'percent', pct)
    ) RETURNING id INTO tx_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO existing_id
    FROM public.cashback_transactions
    WHERE kind = 'earn_purchase' AND source_reference = _source_reference
    LIMIT 1;
    RETURN existing_id;
  END;

  UPDATE public.cashback_accounts
    SET balance_pending = balance_pending + amt,
        total_earned = total_earned + amt,
        current_tier = tier_info->'tier'->>'id',
        updated_at = now()
    WHERE id = acc_id;

  RETURN tx_id;
END;
$function$;

-- Update credit_cashback_referral with the same idempotency guard
CREATE OR REPLACE FUNCTION public.credit_cashback_referral(_referred_user_id uuid, _purchase_amount numeric, _source_reference text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  cfg jsonb := public.get_cashback_config();
  ref_row public.cashback_referrals%rowtype;
  pct numeric;
  amt numeric;
  acc_id uuid;
  tx_id uuid;
  existing_id uuid;
  grace int := COALESCE((cfg->>'grace_period_days')::int, 30);
  validity int := COALESCE((cfg->>'validity_days')::int, 365);
  min_amt numeric := COALESCE((cfg->>'referral_min_purchase')::numeric, 0);
BEGIN
  IF NOT COALESCE((cfg->>'enabled')::boolean, true) THEN
    RETURN NULL;
  END IF;

  -- Idempotency guard: already credited a referral for this source_reference?
  IF _source_reference IS NOT NULL THEN
    SELECT id INTO existing_id
    FROM public.cashback_transactions
    WHERE kind = 'earn_referral' AND source_reference = _source_reference
    LIMIT 1;
    IF existing_id IS NOT NULL THEN
      RETURN existing_id;
    END IF;
  END IF;

  SELECT * INTO ref_row FROM public.cashback_referrals
    WHERE referred_user_id = _referred_user_id AND status = 'pending';
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF _purchase_amount < min_amt THEN
    RETURN NULL;
  END IF;

  pct := COALESCE((cfg->>'referral_percent')::numeric, 0);
  amt := round((_purchase_amount * pct / 100)::numeric, 2);
  IF amt <= 0 THEN
    RETURN NULL;
  END IF;

  acc_id := public.ensure_cashback_account(ref_row.referrer_user_id);

  BEGIN
    INSERT INTO public.cashback_transactions (
      user_id, account_id, kind, status, amount,
      source_type, source_purchase_amount, source_reference,
      referred_user_id,
      available_at, expires_at, metadata
    ) VALUES (
      ref_row.referrer_user_id, acc_id, 'earn_referral', 'pending', amt,
      'referral', _purchase_amount, _source_reference,
      _referred_user_id,
      now() + (grace || ' days')::interval,
      now() + ((grace + validity) || ' days')::interval,
      jsonb_build_object('referral_id', ref_row.id, 'percent', pct)
    ) RETURNING id INTO tx_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO existing_id
    FROM public.cashback_transactions
    WHERE kind = 'earn_referral' AND source_reference = _source_reference
    LIMIT 1;
    RETURN existing_id;
  END;

  UPDATE public.cashback_accounts
    SET balance_pending = balance_pending + amt,
        total_earned = total_earned + amt,
        updated_at = now()
    WHERE id = acc_id;

  UPDATE public.cashback_referrals
    SET status = 'rewarded',
        reward_amount = amt,
        first_purchase_amount = _purchase_amount,
        first_purchase_at = now(),
        rewarded_at = now(),
        updated_at = now()
    WHERE id = ref_row.id;

  RETURN tx_id;
END;
$function$;