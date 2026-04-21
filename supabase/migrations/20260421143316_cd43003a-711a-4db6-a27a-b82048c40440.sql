-- Tabela de disponibilidade recorrente semanal do professor
CREATE TABLE public.teacher_availability_recurring (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL,
  -- 0 = domingo, 1 = segunda, ..., 6 = sábado (compatível com Date.getDay())
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT teacher_availability_recurring_time_check CHECK (start_time < end_time)
);

CREATE INDEX idx_teacher_availability_recurring_teacher
  ON public.teacher_availability_recurring(teacher_id, active, day_of_week);

ALTER TABLE public.teacher_availability_recurring ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view teacher recurring availability"
  ON public.teacher_availability_recurring
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Teachers manage their own recurring availability - insert"
  ON public.teacher_availability_recurring
  FOR INSERT
  TO authenticated
  WITH CHECK (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Teachers manage their own recurring availability - update"
  ON public.teacher_availability_recurring
  FOR UPDATE
  TO authenticated
  USING (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Teachers manage their own recurring availability - delete"
  ON public.teacher_availability_recurring
  FOR DELETE
  TO authenticated
  USING (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_teacher_availability_recurring_updated_at
  BEFORE UPDATE ON public.teacher_availability_recurring
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de exceções pontuais (bloqueios ou janelas extras)
CREATE TABLE public.teacher_availability_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL,
  exception_date DATE NOT NULL,
  -- 'unavailable' bloqueia o intervalo (ou o dia inteiro se start/end são NULL)
  -- 'extra' abre disponibilidade extra fora da agenda recorrente
  exception_type TEXT NOT NULL CHECK (exception_type IN ('unavailable', 'extra')),
  start_time TIME,
  end_time TIME,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT teacher_availability_exceptions_time_check
    CHECK (
      (start_time IS NULL AND end_time IS NULL)
      OR (start_time IS NOT NULL AND end_time IS NOT NULL AND start_time < end_time)
    )
);

CREATE INDEX idx_teacher_availability_exceptions_teacher_date
  ON public.teacher_availability_exceptions(teacher_id, exception_date);

ALTER TABLE public.teacher_availability_exceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view teacher exceptions"
  ON public.teacher_availability_exceptions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Teachers manage their own exceptions - insert"
  ON public.teacher_availability_exceptions
  FOR INSERT
  TO authenticated
  WITH CHECK (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Teachers manage their own exceptions - update"
  ON public.teacher_availability_exceptions
  FOR UPDATE
  TO authenticated
  USING (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Teachers manage their own exceptions - delete"
  ON public.teacher_availability_exceptions
  FOR DELETE
  TO authenticated
  USING (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_teacher_availability_exceptions_updated_at
  BEFORE UPDATE ON public.teacher_availability_exceptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Campos extras em scheduled_lessons para vincular a vídeo e pagamento
ALTER TABLE public.scheduled_lessons
  ADD COLUMN IF NOT EXISTS content_id UUID,
  ADD COLUMN IF NOT EXISTS content_type TEXT
    CHECK (content_type IS NULL OR content_type IN ('lesson', 'exam_solution')),
  ADD COLUMN IF NOT EXISTS payment_type TEXT
    DEFAULT 'one_off'
    CHECK (payment_type IN ('subscription_quota', 'one_off')),
  ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_scheduled_lessons_teacher_status_date
  ON public.scheduled_lessons(teacher_id, status, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_scheduled_lessons_student
  ON public.scheduled_lessons(student_id, scheduled_at);