CREATE TABLE public.beta_bug_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  reporter_name text,
  reporter_email text,
  origin text NOT NULL DEFAULT 'usuario' CHECK (origin IN ('usuario','automatico')),
  page_url text,
  description text,
  error_message text,
  stack_trace text,
  error_kind text,
  browser_info jsonb NOT NULL DEFAULT '{}'::jsonb,
  fingerprint text,
  occurrences integer NOT NULL DEFAULT 1,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','em_analise','resolvido','descartado')),
  admin_notes text,
  reward_credits integer NOT NULL DEFAULT 0,
  reward_granted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (char_length(coalesce(description,'')) <= 4000),
  CHECK (char_length(coalesce(stack_trace,'')) <= 12000),
  CHECK (char_length(coalesce(error_message,'')) <= 2000),
  CHECK (char_length(coalesce(page_url,'')) <= 1000)
);
CREATE INDEX beta_bug_reports_status_idx ON public.beta_bug_reports(status, created_at DESC);
CREATE INDEX beta_bug_reports_fp_idx ON public.beta_bug_reports(fingerprint);

GRANT INSERT ON public.beta_bug_reports TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.beta_bug_reports TO authenticated;
GRANT ALL ON public.beta_bug_reports TO service_role;
ALTER TABLE public.beta_bug_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Visitantes enviam reportes" ON public.beta_bug_reports FOR INSERT TO anon
  WITH CHECK (user_id IS NULL AND status = 'pendente' AND reward_credits = 0 AND reward_granted_at IS NULL);
CREATE POLICY "Usuarios enviam reportes" ON public.beta_bug_reports FOR INSERT TO authenticated
  WITH CHECK ((user_id IS NULL OR user_id = auth.uid()) AND status = 'pendente' AND reward_credits = 0 AND reward_granted_at IS NULL);
CREATE POLICY "Usuario ve seus reportes" ON public.beta_bug_reports FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin atualiza reportes" ON public.beta_bug_reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin exclui reportes" ON public.beta_bug_reports FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER beta_bug_reports_updated BEFORE UPDATE ON public.beta_bug_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Admin concede Créditos de IA por reporte (uma única vez por reporte)
CREATE OR REPLACE FUNCTION public.grant_bug_report_reward(_report_id uuid, _credits integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.beta_bug_reports;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF _credits IS NULL OR _credits <= 0 OR _credits > 1000 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
  SELECT * INTO r FROM public.beta_bug_reports WHERE id = _report_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reporte não encontrado'; END IF;
  IF r.user_id IS NULL THEN RAISE EXCEPTION 'Reporte sem usuário cadastrado'; END IF;
  IF r.reward_granted_at IS NOT NULL THEN RAISE EXCEPTION 'Créditos já concedidos para este reporte'; END IF;
  PERFORM public.add_ai_credits(r.user_id, _credits, 'bug_report');
  UPDATE public.beta_bug_reports SET reward_credits = _credits, reward_granted_at = now() WHERE id = _report_id;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.grant_bug_report_reward(uuid,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grant_bug_report_reward(uuid,integer) TO authenticated;

-- Checkout simulado da Versão Beta (só funciona com a flag ativa)
CREATE OR REPLACE FUNCTION public.beta_simulate_checkout(_mode text, _price_id text, _content_id uuid, _content_type text, _amount numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); enabled boolean; pid uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Faça login para continuar'; END IF;
  SELECT coalesce((value->>'enabled')::boolean,false) INTO enabled FROM public.platform_settings WHERE key = 'beta_mode';
  IF NOT coalesce(enabled,false) THEN RAISE EXCEPTION 'Versão Beta desativada'; END IF;
  IF _mode = 'subscription' THEN
    SELECT id INTO pid FROM public.subscription_plans WHERE stripe_price_id = _price_id LIMIT 1;
    IF pid IS NULL THEN RAISE EXCEPTION 'Plano não encontrado'; END IF;
    UPDATE public.student_subscriptions SET status = 'canceled', updated_at = now() WHERE user_id = uid AND status = 'active';
    INSERT INTO public.student_subscriptions (user_id, plan_id, status, started_at, expires_at, stripe_subscription_id)
      VALUES (uid, pid, 'active', now(), now() + interval '30 days', 'beta_' || gen_random_uuid());
  ELSIF _mode = 'unit' THEN
    IF _content_id IS NULL OR _content_type NOT IN ('lesson','exam_solution') THEN RAISE EXCEPTION 'Conteúdo inválido'; END IF;
    INSERT INTO public.video_purchases (user_id, content_id, content_type, amount, payment_status, stripe_payment_id)
      VALUES (uid, _content_id, _content_type, coalesce(_amount,0), 'completed', 'beta_' || gen_random_uuid());
  ELSE RAISE EXCEPTION 'Modo inválido'; END IF;
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.beta_simulate_checkout(text,text,uuid,text,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.beta_simulate_checkout(text,text,uuid,text,numeric) TO authenticated;