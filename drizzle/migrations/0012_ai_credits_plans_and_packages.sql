ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS ai_credits_mode text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS ai_credits_qty integer NOT NULL DEFAULT 0;

ALTER TABLE public.subscription_plans
  DROP CONSTRAINT IF EXISTS subscription_plans_ai_credits_mode_check;
ALTER TABLE public.subscription_plans
  ADD CONSTRAINT subscription_plans_ai_credits_mode_check
  CHECK (ai_credits_mode IN ('none','included','unlimited'));

CREATE TABLE IF NOT EXISTS public.ai_credit_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  credits integer NOT NULL DEFAULT 0,
  price numeric NOT NULL DEFAULT 0,
  highlighted boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_credit_packages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_credit_packages TO authenticated;
GRANT ALL ON public.ai_credit_packages TO service_role;

ALTER TABLE public.ai_credit_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pacotes ativos visíveis a todos" ON public.ai_credit_packages;
CREATE POLICY "Pacotes ativos visíveis a todos"
  ON public.ai_credit_packages FOR SELECT
  USING (active = true OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins gerenciam pacotes" ON public.ai_credit_packages;
CREATE POLICY "Admins gerenciam pacotes"
  ON public.ai_credit_packages FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_ai_credit_packages_updated
  BEFORE UPDATE ON public.ai_credit_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.ai_credit_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  package_id uuid REFERENCES public.ai_credit_packages(id) ON DELETE SET NULL,
  package_name text NOT NULL DEFAULT '',
  credits integer NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'pending',
  stripe_payment_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_credit_purchases_session_idx
  ON public.ai_credit_purchases (stripe_payment_id)
  WHERE stripe_payment_id IS NOT NULL;

GRANT SELECT ON public.ai_credit_purchases TO authenticated;
GRANT ALL ON public.ai_credit_purchases TO service_role;

ALTER TABLE public.ai_credit_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Aluno vê suas compras de créditos de IA" ON public.ai_credit_purchases;
CREATE POLICY "Aluno vê suas compras de créditos de IA"
  ON public.ai_credit_purchases FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_ai_credit_purchases_updated
  BEFORE UPDATE ON public.ai_credit_purchases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.claim_plan_ai_credits(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  mode text;
  qty integer := 0;
  bal integer := 0;
  granted integer := 0;
BEGIN
  SELECT sp.ai_credits_mode, COALESCE(sp.ai_credits_qty, 0)
    INTO mode, qty
  FROM public.student_subscriptions ss
  JOIN public.subscription_plans sp ON sp.id = ss.plan_id
  WHERE ss.user_id = _user_id
    AND ss.status = 'active'
    AND (ss.expires_at IS NULL OR ss.expires_at > now())
  ORDER BY ss.created_at DESC
  LIMIT 1;

  IF mode = 'unlimited' THEN
    RETURN jsonb_build_object('unlimited', true, 'granted', 0);
  END IF;

  IF mode = 'included' AND qty > 0 THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.ai_revision_credit_ledger
      WHERE user_id = _user_id
        AND reason = 'plan_grant'
        AND created_at > now() - interval '30 days'
    ) THEN
      UPDATE public.ai_revision_credits
        SET balance = balance + qty, updated_at = now()
        WHERE user_id = _user_id
        RETURNING balance INTO bal;
      IF NOT FOUND THEN
        INSERT INTO public.ai_revision_credits (user_id, balance)
        VALUES (_user_id, qty)
        RETURNING balance INTO bal;
      END IF;
      granted := qty;
      INSERT INTO public.ai_revision_credit_ledger (user_id, delta, reason, balance_after)
      VALUES (_user_id, qty, 'plan_grant', bal);
    END IF;
  END IF;

  RETURN jsonb_build_object('unlimited', false, 'granted', granted);
END;
$$;

CREATE OR REPLACE FUNCTION public.add_ai_credits(_user_id uuid, _amount integer, _reason text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  bal integer;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN
    RETURN 0;
  END IF;
  UPDATE public.ai_revision_credits
    SET balance = balance + _amount, updated_at = now()
    WHERE user_id = _user_id
    RETURNING balance INTO bal;
  IF NOT FOUND THEN
    INSERT INTO public.ai_revision_credits (user_id, balance)
    VALUES (_user_id, _amount)
    RETURNING balance INTO bal;
  END IF;
  INSERT INTO public.ai_revision_credit_ledger (user_id, delta, reason, balance_after)
  VALUES (_user_id, _amount, COALESCE(_reason, 'grant'), bal);
  RETURN bal;
END;
$$;