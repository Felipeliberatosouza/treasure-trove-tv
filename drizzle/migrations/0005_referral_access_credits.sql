CREATE TABLE public.referral_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL,
  channel text NOT NULL,
  contact_email text,
  contact_phone text,
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'sent',
  sent_at timestamptz NOT NULL DEFAULT now(),
  visited_at timestamptz,
  rewarded_at timestamptz,
  visitor_user_id uuid,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '60 days',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referral_invites_channel_check CHECK (channel IN ('email','whatsapp','sms','link')),
  CONSTRAINT referral_invites_status_check CHECK (status IN ('sent','visited','rewarded','expired','cancelled'))
);

CREATE INDEX idx_referral_invites_referrer ON public.referral_invites (referrer_user_id, created_at DESC);
CREATE INDEX idx_referral_invites_token ON public.referral_invites (token);

GRANT SELECT, INSERT ON public.referral_invites TO authenticated;
GRANT ALL ON public.referral_invites TO service_role;

ALTER TABLE public.referral_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário vê seus convites" ON public.referral_invites
  FOR SELECT TO authenticated
  USING (referrer_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Usuário cria seus convites" ON public.referral_invites
  FOR INSERT TO authenticated
  WITH CHECK (referrer_user_id = auth.uid());

CREATE POLICY "Service role gerencia convites" ON public.referral_invites
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER trg_referral_invites_updated BEFORE UPDATE ON public.referral_invites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.referral_content_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  resource_type text NOT NULL,
  granted integer NOT NULL DEFAULT 0,
  used integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referral_content_credits_unique UNIQUE (user_id, resource_type),
  CONSTRAINT referral_content_credits_type_check CHECK (resource_type IN ('revisao','resumo','simulado','top_questoes','colinha','duvida','aula_particular'))
);

GRANT SELECT ON public.referral_content_credits TO authenticated;
GRANT ALL ON public.referral_content_credits TO service_role;

ALTER TABLE public.referral_content_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário vê seus créditos de indicação" ON public.referral_content_credits
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Service role gerencia créditos de indicação" ON public.referral_content_credits
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER trg_referral_content_credits_updated BEFORE UPDATE ON public.referral_content_credits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.consume_referral_content_credit(_resource_type text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  row_id uuid;
BEGIN
  IF uid IS NULL OR _resource_type IS NULL THEN
    RETURN false;
  END IF;

  SELECT id INTO row_id
  FROM public.referral_content_credits
  WHERE user_id = uid AND resource_type = _resource_type AND granted > used
  FOR UPDATE;

  IF row_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.referral_content_credits
     SET used = used + 1, updated_at = now()
   WHERE id = row_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_referral_content_credit(text) TO authenticated;