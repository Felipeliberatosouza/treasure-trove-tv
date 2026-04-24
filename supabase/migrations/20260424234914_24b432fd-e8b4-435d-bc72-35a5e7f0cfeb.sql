
-- 1. Configurações padrão
INSERT INTO public.platform_settings (key, value)
VALUES (
  'teacher_compensation',
  '{
    "package_fee_brl": 50.00,
    "pool_net_revenue_pct": 50,
    "pool_min_per_access_brl": 0.30,
    "pool_max_share_pct": 15,
    "material_access_minutes_equivalent": 3,
    "quality_bonus_min_rating": 4.5,
    "quality_bonus_pct": 10,
    "rf_score_bonus_min": 9.5,
    "rf_score_bonus_pct": 10,
    "default_monthly_package_target": 4,
    "rf_weights": {
      "content_insertion": 30,
      "lessons_delivered": 25,
      "doubts_answered": 25,
      "agenda_updated": 20
    }
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- 2. Logs de consumo
CREATE TABLE IF NOT EXISTS public.material_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  teacher_id UUID NOT NULL,
  lesson_id UUID NOT NULL,
  material_type TEXT NOT NULL CHECK (material_type IN ('resumo','colinhas','simulado','top_questoes')),
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  access_day DATE NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  via_subscription BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_mal_teacher_date ON public.material_access_log(teacher_id, accessed_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_mal_unique_day
  ON public.material_access_log(user_id, lesson_id, material_type, access_day);

ALTER TABLE public.material_access_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert their own access" ON public.material_access_log
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Teachers read their content access" ON public.material_access_log
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.video_watch_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  teacher_id UUID NOT NULL,
  lesson_id UUID NOT NULL,
  seconds_watched INTEGER NOT NULL DEFAULT 0 CHECK (seconds_watched >= 0),
  watched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  via_subscription BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_vwl_teacher_date ON public.video_watch_log(teacher_id, watched_at);
CREATE INDEX IF NOT EXISTS idx_vwl_user_lesson ON public.video_watch_log(user_id, lesson_id);

ALTER TABLE public.video_watch_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert their own watch" ON public.video_watch_log
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Teachers read their watch logs" ON public.video_watch_log
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- 3. Metas por professor
CREATE TABLE IF NOT EXISTS public.teacher_monthly_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL UNIQUE,
  monthly_package_target INTEGER NOT NULL DEFAULT 4 CHECK (monthly_package_target >= 0),
  notes TEXT,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.teacher_monthly_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage targets" ON public.teacher_monthly_targets
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Teachers read own target" ON public.teacher_monthly_targets
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_targets_updated BEFORE UPDATE ON public.teacher_monthly_targets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Pool runs
CREATE TABLE IF NOT EXISTS public.pool_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  subscription_gross_revenue NUMERIC(14,2) NOT NULL DEFAULT 0,
  taxes_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_revenue NUMERIC(14,2) NOT NULL DEFAULT 0,
  pool_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_distributed NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_minutes NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_unique_accesses INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  config_snapshot JSONB,
  notes TEXT,
  ran_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (period_start, period_end)
);
ALTER TABLE public.pool_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage pool runs" ON public.pool_runs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Teachers read pool runs" ON public.pool_runs
  FOR SELECT TO authenticated USING (true);
CREATE TRIGGER trg_pool_runs_updated BEFORE UPDATE ON public.pool_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Stats mensais por professor
CREATE TABLE IF NOT EXISTS public.teacher_monthly_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  pool_run_id UUID REFERENCES public.pool_runs(id) ON DELETE SET NULL,
  packages_completed INTEGER NOT NULL DEFAULT 0,
  package_fee_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  unit_sales_count INTEGER NOT NULL DEFAULT 0,
  unit_sales_gross NUMERIC(14,2) NOT NULL DEFAULT 0,
  commission_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  video_minutes NUMERIC(14,2) NOT NULL DEFAULT 0,
  material_unique_accesses INTEGER NOT NULL DEFAULT 0,
  material_minutes_equivalent NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_consumption_minutes NUMERIC(14,2) NOT NULL DEFAULT 0,
  pool_share_pct NUMERIC(7,4) NOT NULL DEFAULT 0,
  pool_base_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  pool_floor_applied BOOLEAN NOT NULL DEFAULT false,
  pool_cap_applied BOOLEAN NOT NULL DEFAULT false,
  avg_rating NUMERIC(4,2),
  ratings_count INTEGER NOT NULL DEFAULT 0,
  rf_score NUMERIC(4,2),
  quality_bonus_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  rf_score_bonus_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  bonus_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  pool_final_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_gross NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, period_start, period_end)
);
CREATE INDEX IF NOT EXISTS idx_tms_period ON public.teacher_monthly_stats(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_tms_pool_run ON public.teacher_monthly_stats(pool_run_id);
ALTER TABLE public.teacher_monthly_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage stats" ON public.teacher_monthly_stats
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Teachers read own stats" ON public.teacher_monthly_stats
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_tms_updated BEFORE UPDATE ON public.teacher_monthly_stats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. RF Score - componentes
CREATE TABLE IF NOT EXISTS public.teacher_rf_score_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  insertion_score NUMERIC(4,2) NOT NULL DEFAULT 0,
  insertion_target INTEGER NOT NULL DEFAULT 0,
  insertion_actual INTEGER NOT NULL DEFAULT 0,
  lessons_score NUMERIC(4,2) NOT NULL DEFAULT 0,
  lessons_scheduled INTEGER NOT NULL DEFAULT 0,
  lessons_delivered INTEGER NOT NULL DEFAULT 0,
  doubts_score NUMERIC(4,2) NOT NULL DEFAULT 0,
  doubts_received INTEGER NOT NULL DEFAULT 0,
  doubts_answered_in_time INTEGER NOT NULL DEFAULT 0,
  agenda_score NUMERIC(4,2) NOT NULL DEFAULT 0,
  agenda_days_updated INTEGER NOT NULL DEFAULT 0,
  final_score NUMERIC(4,2) NOT NULL DEFAULT 0,
  weights_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, period_start, period_end)
);
ALTER TABLE public.teacher_rf_score_components ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage rf score" ON public.teacher_rf_score_components
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Teachers read own rf score" ON public.teacher_rf_score_components
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_rf_updated BEFORE UPDATE ON public.teacher_rf_score_components
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Aditivos em teacher_payments
ALTER TABLE public.teacher_payments
  ADD COLUMN IF NOT EXISTS pool_run_id UUID REFERENCES public.pool_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS package_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pool_minutes NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pool_share_pct NUMERIC(7,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quality_bonus_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rf_score_bonus_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rf_score NUMERIC(4,2),
  ADD COLUMN IF NOT EXISTS commission_amount NUMERIC(14,2) NOT NULL DEFAULT 0;

-- 8. Helpers
CREATE OR REPLACE FUNCTION public.get_teacher_monthly_target(_teacher_id UUID)
RETURNS INTEGER LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE override_val INTEGER; default_val INTEGER;
BEGIN
  SELECT monthly_package_target INTO override_val
    FROM public.teacher_monthly_targets WHERE teacher_id = _teacher_id;
  IF override_val IS NOT NULL THEN RETURN override_val; END IF;
  SELECT COALESCE((value->>'default_monthly_package_target')::int, 4) INTO default_val
    FROM public.platform_settings WHERE key = 'teacher_compensation';
  RETURN COALESCE(default_val, 4);
END;
$$;

CREATE OR REPLACE FUNCTION public.count_completed_packages(_teacher_id UUID, _start TIMESTAMPTZ, _end TIMESTAMPTZ)
RETURNS INTEGER LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COUNT(DISTINCT l.id)::int
  FROM public.lessons l
  WHERE l.teacher_id = _teacher_id
    AND l.admin_approved = true
    AND l.published = true
    AND l.video_url IS NOT NULL
    AND l.updated_at >= _start AND l.updated_at < _end
    AND (
      SELECT COUNT(*) FROM public.lesson_material_meta m
      WHERE m.lesson_id = l.id
        AND m.material_type IN ('resumo','colinhas','simulado','top_questoes')
        AND m.admin_approved = true
        AND m.offered = true
    ) >= 4;
$$;
