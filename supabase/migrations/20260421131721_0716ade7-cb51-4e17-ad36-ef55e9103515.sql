-- 1) AULAS AGENDADAS
CREATE TABLE public.scheduled_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL,
  student_id UUID,
  student_name TEXT,
  student_email TEXT,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  modality TEXT NOT NULL DEFAULT 'online',
  meeting_url TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'scheduled',
  notes TEXT DEFAULT '',
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scheduled_lessons_teacher ON public.scheduled_lessons(teacher_id, scheduled_at);
CREATE INDEX idx_scheduled_lessons_student ON public.scheduled_lessons(student_id, scheduled_at);
CREATE INDEX idx_scheduled_lessons_status ON public.scheduled_lessons(status);

ALTER TABLE public.scheduled_lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage own scheduled lessons"
  ON public.scheduled_lessons FOR ALL TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Students view own scheduled lessons"
  ON public.scheduled_lessons FOR SELECT TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Admins manage all scheduled lessons"
  ON public.scheduled_lessons FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_scheduled_lessons_updated_at
  BEFORE UPDATE ON public.scheduled_lessons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) DECLARAÇÕES SEMANAIS DO PROFESSOR
CREATE TABLE public.teacher_weekly_declarations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL,
  week_start DATE NOT NULL,
  agenda_updated BOOLEAN NOT NULL DEFAULT false,
  notes TEXT DEFAULT '',
  declared_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(teacher_id, week_start)
);

CREATE INDEX idx_weekly_decl_teacher_week ON public.teacher_weekly_declarations(teacher_id, week_start);

ALTER TABLE public.teacher_weekly_declarations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage own declarations"
  ON public.teacher_weekly_declarations FOR ALL TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Admins view all declarations"
  ON public.teacher_weekly_declarations FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_weekly_decl_updated_at
  BEFORE UPDATE ON public.teacher_weekly_declarations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) SNAPSHOTS MENSAIS DE METAS
CREATE TABLE public.teacher_monthly_goal_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  goals JSONB NOT NULL DEFAULT '{}'::jsonb,
  met_all_goals BOOLEAN NOT NULL DEFAULT false,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(teacher_id, period_start)
);

CREATE INDEX idx_monthly_snap_teacher ON public.teacher_monthly_goal_snapshots(teacher_id, period_start);

ALTER TABLE public.teacher_monthly_goal_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers view own snapshots"
  ON public.teacher_monthly_goal_snapshots FOR SELECT TO authenticated
  USING (teacher_id = auth.uid());

CREATE POLICY "Admins view all snapshots"
  ON public.teacher_monthly_goal_snapshots FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages snapshots"
  ON public.teacher_monthly_goal_snapshots FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 4) ATUALIZAR PLATFORM_SETTINGS COM NOVO FORMATO DE METAS
INSERT INTO public.platform_settings (key, value)
VALUES (
  'teacher_content_goal',
  jsonb_build_object(
    'monthly_goal', 8,
    'content_goals', jsonb_build_object(
      'revisoes', 4,
      'resolucoes', 4,
      'resumos', 2,
      'colinhas', 2,
      'simulados', 2,
      'top_questoes', 2
    ),
    'relationship_goals', jsonb_build_object(
      'agenda_weekly_updates', 4,
      'completed_lessons', 4,
      'doubts_answered_in_time', 5
    ),
    'sales_posts_goal', 2,
    'doubt_response_hours', 48,
    'email_alerts_enabled', true
  )
)
ON CONFLICT (key) DO UPDATE
SET value = public.platform_settings.value
  || jsonb_build_object(
    'content_goals', COALESCE(public.platform_settings.value->'content_goals', jsonb_build_object(
      'revisoes', 4, 'resolucoes', 4, 'resumos', 2,
      'colinhas', 2, 'simulados', 2, 'top_questoes', 2
    )),
    'relationship_goals', COALESCE(public.platform_settings.value->'relationship_goals', jsonb_build_object(
      'agenda_weekly_updates', 4, 'completed_lessons', 4, 'doubts_answered_in_time', 5
    )),
    'sales_posts_goal', COALESCE(public.platform_settings.value->'sales_posts_goal', '2'::jsonb),
    'doubt_response_hours', COALESCE(public.platform_settings.value->'doubt_response_hours', '48'::jsonb),
    'email_alerts_enabled', COALESCE(public.platform_settings.value->'email_alerts_enabled', 'true'::jsonb)
  );