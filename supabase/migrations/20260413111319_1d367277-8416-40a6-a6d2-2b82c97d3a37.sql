
CREATE TABLE public.mfa_recovery_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code_hash text NOT NULL,
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mfa_recovery_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recovery codes"
  ON public.mfa_recovery_codes FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recovery codes"
  ON public.mfa_recovery_codes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recovery codes"
  ON public.mfa_recovery_codes FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own recovery codes"
  ON public.mfa_recovery_codes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_mfa_recovery_codes_user ON public.mfa_recovery_codes(user_id);
