-- Núcleo do Kit de Revisão com IA: créditos, ledger, cache canônico, pedidos e feedback.

CREATE TABLE public.ai_revision_credits (
  user_id uuid PRIMARY KEY,
  balance integer NOT NULL DEFAULT 0,
  signup_granted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_revision_credits TO authenticated;
GRANT ALL ON public.ai_revision_credits TO service_role;
ALTER TABLE public.ai_revision_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuário vê seus créditos de IA"
  ON public.ai_revision_credits FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE public.ai_revision_credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  delta integer NOT NULL,
  reason text NOT NULL,
  request_id uuid,
  balance_after integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_credit_ledger_user ON public.ai_revision_credit_ledger (user_id, created_at DESC);
GRANT SELECT ON public.ai_revision_credit_ledger TO authenticated;
GRANT ALL ON public.ai_revision_credit_ledger TO service_role;
ALTER TABLE public.ai_revision_credit_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuário vê seu extrato de créditos de IA"
  ON public.ai_revision_credit_ledger FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE public.ai_canonical_contents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL UNIQUE,
  disciplina text,
  assunto text NOT NULL,
  subtopicos text[],
  idioma text NOT NULL DEFAULT 'pt-br',
  nivel text NOT NULL DEFAULT 'rapido',
  template_version text NOT NULL DEFAULT 'v1',
  prompt_version text NOT NULL DEFAULT 'v1',
  model text,
  visibility text NOT NULL DEFAULT 'public_canonical',
  status text NOT NULL DEFAULT 'ready',
  kit jsonb NOT NULL DEFAULT '{}'::jsonb,
  hits integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_canonical_contents TO authenticated, anon;
GRANT ALL ON public.ai_canonical_contents TO service_role;
ALTER TABLE public.ai_canonical_contents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Kits públicos prontos são legíveis"
  ON public.ai_canonical_contents FOR SELECT TO authenticated, anon
  USING (visibility = 'public_canonical' AND status = 'ready');
CREATE POLICY "Admin gerencia kits canônicos"
  ON public.ai_canonical_contents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE public.ai_revision_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  anon_id text,
  ip_hash text,
  prompt text NOT NULL,
  disciplina text,
  curso text,
  instituicao text,
  exam_date date,
  nivel text NOT NULL DEFAULT 'rapido',
  cache_key text,
  canonical_id uuid REFERENCES public.ai_canonical_contents(id) ON DELETE SET NULL,
  source text,
  status text NOT NULL DEFAULT 'pending',
  credit_reserved boolean NOT NULL DEFAULT false,
  idempotency_key text,
  error_message text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_ai_requests_idempotency ON public.ai_revision_requests (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_ai_requests_user ON public.ai_revision_requests (user_id, created_at DESC);
CREATE INDEX idx_ai_requests_anon ON public.ai_revision_requests (anon_id, created_at DESC);
GRANT SELECT ON public.ai_revision_requests TO authenticated;
GRANT ALL ON public.ai_revision_requests TO service_role;
ALTER TABLE public.ai_revision_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuário vê seus pedidos de IA"
  ON public.ai_revision_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE public.ai_content_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_id uuid REFERENCES public.ai_canonical_contents(id) ON DELETE CASCADE,
  request_id uuid,
  user_id uuid,
  helpful boolean,
  report_reason text,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ai_content_feedback TO authenticated;
GRANT ALL ON public.ai_content_feedback TO service_role;
ALTER TABLE public.ai_content_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuário registra feedback de IA"
  ON public.ai_content_feedback FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Usuário e admin veem feedback de IA"
  ON public.ai_content_feedback FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_ai_credits_updated BEFORE UPDATE ON public.ai_revision_credits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ai_canonical_updated BEFORE UPDATE ON public.ai_canonical_contents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ai_requests_updated BEFORE UPDATE ON public.ai_revision_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();