
-- ============================================================
-- CASHBACK PROGRAM - Database structure
-- ============================================================

-- Generate a unique referral code (8 chars alphanumeric uppercase)
CREATE OR REPLACE FUNCTION public.generate_cashback_referral_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  attempts int := 0;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..8 LOOP
      code := code || substr(chars, (floor(random() * length(chars)) + 1)::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.cashback_accounts WHERE referral_code = code);
    attempts := attempts + 1;
    IF attempts > 20 THEN
      RAISE EXCEPTION 'Could not generate unique referral code';
    END IF;
  END LOOP;
  RETURN code;
END;
$$;

-- ----------------------------------------
-- TABLE: cashback_accounts
-- ----------------------------------------
CREATE TABLE public.cashback_accounts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL UNIQUE,
  referral_code   text UNIQUE,
  balance_available numeric(12,2) NOT NULL DEFAULT 0,
  balance_pending   numeric(12,2) NOT NULL DEFAULT 0,
  total_earned      numeric(12,2) NOT NULL DEFAULT 0,
  total_spent       numeric(12,2) NOT NULL DEFAULT 0,
  total_expired     numeric(12,2) NOT NULL DEFAULT 0,
  current_tier      text NOT NULL DEFAULT 'bronze',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cashback_accounts_balances_nonneg
    CHECK (balance_available >= 0 AND balance_pending >= 0)
);

-- Generate referral code on insert
CREATE OR REPLACE FUNCTION public.set_cashback_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.referral_code IS NULL OR NEW.referral_code = '' THEN
    NEW.referral_code := public.generate_cashback_referral_code();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cashback_accounts_referral_code
BEFORE INSERT ON public.cashback_accounts
FOR EACH ROW EXECUTE FUNCTION public.set_cashback_referral_code();

CREATE TRIGGER trg_cashback_accounts_updated
BEFORE UPDATE ON public.cashback_accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.cashback_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own cashback account"
ON public.cashback_accounts FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins view all cashback accounts"
ON public.cashback_accounts FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages cashback accounts"
ON public.cashback_accounts FOR ALL
TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admins update cashback accounts"
ON public.cashback_accounts FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_cashback_accounts_user_id ON public.cashback_accounts(user_id);
CREATE INDEX idx_cashback_accounts_referral_code ON public.cashback_accounts(referral_code);

-- ----------------------------------------
-- TABLE: cashback_transactions
-- ----------------------------------------
CREATE TABLE public.cashback_transactions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL,
  account_id      uuid NOT NULL REFERENCES public.cashback_accounts(id) ON DELETE CASCADE,
  -- earn_purchase | earn_referral | spend | expire | adjust | reverse
  kind            text NOT NULL,
  -- pending | available | used | expired | reversed
  status          text NOT NULL,
  amount          numeric(12,2) NOT NULL,
  -- Source compra (assinatura ou avulsa)
  source_type     text,                     -- 'subscription' | 'one_off'
  source_purchase_amount numeric(12,2),     -- valor da compra que originou o cashback
  source_reference text,                    -- stripe payment intent / subscription id
  -- Para earn_referral
  referred_user_id uuid,
  -- Datas
  available_at    timestamptz,              -- quando deixa de ser pendente
  expires_at      timestamptz,              -- quando expira
  consumed_at     timestamptz,              -- quando foi usado
  -- Auditoria
  admin_id        uuid,                     -- se foi um ajuste manual
  notes           text,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cashback_transactions_kind_check
    CHECK (kind IN ('earn_purchase','earn_referral','spend','expire','adjust','reverse')),
  CONSTRAINT cashback_transactions_status_check
    CHECK (status IN ('pending','available','used','expired','reversed'))
);

CREATE TRIGGER trg_cashback_tx_updated
BEFORE UPDATE ON public.cashback_transactions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.cashback_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own cashback transactions"
ON public.cashback_transactions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins view all cashback transactions"
ON public.cashback_transactions FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages cashback transactions"
ON public.cashback_transactions FOR ALL
TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admins manage cashback transactions"
ON public.cashback_transactions FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_cashback_tx_user_id ON public.cashback_transactions(user_id);
CREATE INDEX idx_cashback_tx_account_id ON public.cashback_transactions(account_id);
CREATE INDEX idx_cashback_tx_status ON public.cashback_transactions(status);
CREATE INDEX idx_cashback_tx_available_at ON public.cashback_transactions(available_at) WHERE status = 'pending';
CREATE INDEX idx_cashback_tx_expires_at ON public.cashback_transactions(expires_at) WHERE status = 'available';

-- ----------------------------------------
-- TABLE: cashback_referrals
-- ----------------------------------------
CREATE TABLE public.cashback_referrals (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id    uuid NOT NULL,
  referred_user_id    uuid NOT NULL UNIQUE, -- 1 indicador por aluno
  referral_code_used  text NOT NULL,
  -- pending | rewarded | expired | cancelled
  status              text NOT NULL DEFAULT 'pending',
  reward_amount       numeric(12,2) NOT NULL DEFAULT 0,
  first_purchase_amount numeric(12,2),
  first_purchase_at   timestamptz,
  rewarded_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cashback_referrals_status_check
    CHECK (status IN ('pending','rewarded','expired','cancelled')),
  CONSTRAINT cashback_referrals_no_self
    CHECK (referrer_user_id <> referred_user_id)
);

CREATE TRIGGER trg_cashback_referrals_updated
BEFORE UPDATE ON public.cashback_referrals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.cashback_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view referrals they made or received"
ON public.cashback_referrals FOR SELECT
TO authenticated
USING (auth.uid() = referrer_user_id OR auth.uid() = referred_user_id);

CREATE POLICY "Admins view all referrals"
ON public.cashback_referrals FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages referrals"
ON public.cashback_referrals FOR ALL
TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admins manage referrals"
ON public.cashback_referrals FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_cashback_referrals_referrer ON public.cashback_referrals(referrer_user_id);
CREATE INDEX idx_cashback_referrals_status ON public.cashback_referrals(status);

-- ============================================================
-- CORE FUNCTIONS (security definer, called by edge functions)
-- ============================================================

-- Get program config from platform_settings
CREATE OR REPLACE FUNCTION public.get_cashback_config()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg jsonb;
BEGIN
  SELECT value INTO cfg FROM public.platform_settings WHERE key = 'cashback_program';
  RETURN COALESCE(cfg, '{
    "enabled": true,
    "grace_period_days": 30,
    "validity_days": 365,
    "max_checkout_pct": 50,
    "min_purchase_amount": 0,
    "referral_percent": 10,
    "referral_min_purchase": 0,
    "tiers": [
      {"id":"bronze","name":"Bronze","min_spent_12m":0,"percent":2},
      {"id":"silver","name":"Prata","min_spent_12m":300,"percent":4},
      {"id":"gold","name":"Ouro","min_spent_12m":1000,"percent":6},
      {"id":"diamond","name":"Diamante","min_spent_12m":3000,"percent":10}
    ]
  }'::jsonb);
END;
$$;

-- Compute tier for a user based on last 12 months total purchases (proxy: total_earned / config tiers)
CREATE OR REPLACE FUNCTION public.get_user_cashback_tier(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg jsonb := public.get_cashback_config();
  spent_12m numeric := 0;
  best jsonb;
  t jsonb;
BEGIN
  SELECT COALESCE(SUM(source_purchase_amount),0)
  INTO spent_12m
  FROM public.cashback_transactions
  WHERE user_id = _user_id
    AND kind = 'earn_purchase'
    AND created_at > now() - interval '12 months';

  best := (cfg->'tiers')->0;
  FOR t IN SELECT jsonb_array_elements(cfg->'tiers') LOOP
    IF (t->>'min_spent_12m')::numeric <= spent_12m THEN
      best := t;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'tier', best,
    'spent_12m', spent_12m
  );
END;
$$;

-- Ensure account exists for a user, returning the account row id
CREATE OR REPLACE FUNCTION public.ensure_cashback_account(_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acc_id uuid;
BEGIN
  SELECT id INTO acc_id FROM public.cashback_accounts WHERE user_id = _user_id;
  IF acc_id IS NULL THEN
    INSERT INTO public.cashback_accounts (user_id) VALUES (_user_id) RETURNING id INTO acc_id;
  END IF;
  RETURN acc_id;
END;
$$;

-- Credit cashback (pending) for a purchase
CREATE OR REPLACE FUNCTION public.credit_cashback_purchase(
  _user_id uuid,
  _purchase_amount numeric,
  _source_type text,
  _source_reference text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg jsonb := public.get_cashback_config();
  tier_info jsonb;
  pct numeric;
  amt numeric;
  acc_id uuid;
  tx_id uuid;
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

  tier_info := public.get_user_cashback_tier(_user_id);
  pct := COALESCE((tier_info->'tier'->>'percent')::numeric, 0);
  amt := round((_purchase_amount * pct / 100)::numeric, 2);
  IF amt <= 0 THEN
    RETURN NULL;
  END IF;

  acc_id := public.ensure_cashback_account(_user_id);

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

  UPDATE public.cashback_accounts
    SET balance_pending = balance_pending + amt,
        total_earned = total_earned + amt,
        current_tier = tier_info->'tier'->>'id',
        updated_at = now()
    WHERE id = acc_id;

  RETURN tx_id;
END;
$$;

-- Credit referral reward for the referrer when the referred user makes their first qualifying purchase
CREATE OR REPLACE FUNCTION public.credit_cashback_referral(
  _referred_user_id uuid,
  _purchase_amount numeric,
  _source_reference text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg jsonb := public.get_cashback_config();
  ref_row public.cashback_referrals%rowtype;
  pct numeric;
  amt numeric;
  acc_id uuid;
  tx_id uuid;
  grace int := COALESCE((cfg->>'grace_period_days')::int, 30);
  validity int := COALESCE((cfg->>'validity_days')::int, 365);
  min_amt numeric := COALESCE((cfg->>'referral_min_purchase')::numeric, 0);
BEGIN
  IF NOT COALESCE((cfg->>'enabled')::boolean, true) THEN
    RETURN NULL;
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
$$;

-- Move pending cashback to available after grace period (cron)
CREATE OR REPLACE FUNCTION public.release_pending_cashback()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  released_count int := 0;
  rec record;
BEGIN
  FOR rec IN
    SELECT id, account_id, amount FROM public.cashback_transactions
    WHERE status = 'pending'
      AND available_at IS NOT NULL
      AND available_at <= now()
  LOOP
    UPDATE public.cashback_transactions
      SET status = 'available', updated_at = now()
      WHERE id = rec.id;
    UPDATE public.cashback_accounts
      SET balance_pending = greatest(balance_pending - rec.amount, 0),
          balance_available = balance_available + rec.amount,
          updated_at = now()
      WHERE id = rec.account_id;
    released_count := released_count + 1;
  END LOOP;
  RETURN released_count;
END;
$$;

-- Expire available cashback past expires_at (cron)
CREATE OR REPLACE FUNCTION public.expire_old_cashback()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_count int := 0;
  rec record;
BEGIN
  FOR rec IN
    SELECT id, account_id, amount FROM public.cashback_transactions
    WHERE status = 'available'
      AND expires_at IS NOT NULL
      AND expires_at <= now()
  LOOP
    UPDATE public.cashback_transactions
      SET status = 'expired', updated_at = now()
      WHERE id = rec.id;
    UPDATE public.cashback_accounts
      SET balance_available = greatest(balance_available - rec.amount, 0),
          total_expired = total_expired + rec.amount,
          updated_at = now()
      WHERE id = rec.account_id;
    expired_count := expired_count + 1;
  END LOOP;
  RETURN expired_count;
END;
$$;

-- Consume cashback for a checkout (returns actual amount consumed)
CREATE OR REPLACE FUNCTION public.consume_cashback(
  _user_id uuid,
  _requested_amount numeric,
  _source_reference text
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acc public.cashback_accounts%rowtype;
  to_use numeric;
  acc_id uuid;
BEGIN
  acc_id := public.ensure_cashback_account(_user_id);
  SELECT * INTO acc FROM public.cashback_accounts WHERE id = acc_id FOR UPDATE;

  to_use := least(acc.balance_available, GREATEST(_requested_amount, 0));
  IF to_use <= 0 THEN
    RETURN 0;
  END IF;

  INSERT INTO public.cashback_transactions (
    user_id, account_id, kind, status, amount,
    source_type, source_reference, consumed_at
  ) VALUES (
    _user_id, acc_id, 'spend', 'used', to_use,
    'checkout', _source_reference, now()
  );

  UPDATE public.cashback_accounts
    SET balance_available = balance_available - to_use,
        total_spent = total_spent + to_use,
        updated_at = now()
    WHERE id = acc_id;

  RETURN to_use;
END;
$$;

-- Register a referral (called when a new user signs up with a referral code)
CREATE OR REPLACE FUNCTION public.register_cashback_referral(
  _referred_user_id uuid,
  _referral_code text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ref_user uuid;
  new_id uuid;
BEGIN
  IF _referral_code IS NULL OR length(trim(_referral_code)) = 0 THEN
    RETURN NULL;
  END IF;

  SELECT user_id INTO ref_user FROM public.cashback_accounts
    WHERE referral_code = upper(trim(_referral_code));
  IF ref_user IS NULL OR ref_user = _referred_user_id THEN
    RETURN NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM public.cashback_referrals WHERE referred_user_id = _referred_user_id) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.cashback_referrals (
    referrer_user_id, referred_user_id, referral_code_used
  ) VALUES (
    ref_user, _referred_user_id, upper(trim(_referral_code))
  ) RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;
