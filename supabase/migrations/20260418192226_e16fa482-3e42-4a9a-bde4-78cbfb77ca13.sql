
CREATE TABLE public.commitment_penalty_refunds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  admin_id UUID NOT NULL,
  stripe_subscription_id TEXT,
  stripe_charge_id TEXT,
  stripe_refund_id TEXT,
  original_penalty_amount NUMERIC NOT NULL DEFAULT 0,
  refund_amount NUMERIC NOT NULL DEFAULT 0,
  refund_type TEXT NOT NULL DEFAULT 'partial',
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'succeeded',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.commitment_penalty_refunds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage commitment refunds"
ON public.commitment_penalty_refunds
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users view own commitment refunds"
ON public.commitment_penalty_refunds
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER trg_update_commitment_penalty_refunds
BEFORE UPDATE ON public.commitment_penalty_refunds
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_cpr_user ON public.commitment_penalty_refunds(user_id);
CREATE INDEX idx_cpr_subscription ON public.commitment_penalty_refunds(stripe_subscription_id);
CREATE INDEX idx_cpr_created ON public.commitment_penalty_refunds(created_at DESC);
