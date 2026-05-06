
-- 1) Helper columns on existing student_doubts
ALTER TABLE public.student_doubts
  ADD COLUMN IF NOT EXISTS messages_limit integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS questions_used integer NOT NULL DEFAULT 1;

-- Backfill counter for existing rows: each existing doubt has 1 question used
UPDATE public.student_doubts SET questions_used = 1 WHERE questions_used IS NULL OR questions_used = 0;

-- 2) New thread messages table
CREATE TABLE IF NOT EXISTS public.doubt_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doubt_id uuid NOT NULL REFERENCES public.student_doubts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  author_role text NOT NULL CHECK (author_role IN ('student','teacher','admin')),
  message_kind text NOT NULL CHECK (message_kind IN ('question','answer')),
  body text NOT NULL,
  status text NOT NULL DEFAULT 'pending_approval'
    CHECK (status IN ('pending_approval','approved','rejected','answered')),
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doubt_messages_doubt ON public.doubt_messages(doubt_id, created_at);

-- updated_at trigger
DROP TRIGGER IF EXISTS update_doubt_messages_updated_at ON public.doubt_messages;
CREATE TRIGGER update_doubt_messages_updated_at
BEFORE UPDATE ON public.doubt_messages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.doubt_messages ENABLE ROW LEVEL SECURITY;

-- Helper: count approved/pending student questions in a thread
CREATE OR REPLACE FUNCTION public.count_student_questions(_doubt_id uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.doubt_messages
   WHERE doubt_id = _doubt_id
     AND author_role = 'student'
     AND message_kind = 'question'
     AND status <> 'rejected'
$$;

-- Trigger: enforce limit + keep questions_used in sync
CREATE OR REPLACE FUNCTION public.enforce_doubt_messages_limit()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  d public.student_doubts%ROWTYPE;
  used int;
BEGIN
  SELECT * INTO d FROM public.student_doubts WHERE id = NEW.doubt_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dúvida não encontrada.';
  END IF;

  IF NEW.author_role = 'student' AND NEW.message_kind = 'question' THEN
    SELECT public.count_student_questions(NEW.doubt_id) INTO used;
    -- Counter already includes the row being inserted (after row trigger could
    -- be tricky), so we compute prospective count here as a BEFORE trigger.
    IF (used + 1) > COALESCE(d.messages_limit, 1) THEN
      RAISE EXCEPTION 'Você atingiu o limite de % perguntas nesta dúvida.', d.messages_limit;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_doubt_messages_limit ON public.doubt_messages;
CREATE TRIGGER trg_enforce_doubt_messages_limit
BEFORE INSERT ON public.doubt_messages
FOR EACH ROW EXECUTE FUNCTION public.enforce_doubt_messages_limit();

-- After insert: update questions_used counter on parent doubt
CREATE OR REPLACE FUNCTION public.sync_doubt_questions_used()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.student_doubts
     SET questions_used = public.count_student_questions(COALESCE(NEW.doubt_id, OLD.doubt_id)),
         updated_at = now()
   WHERE id = COALESCE(NEW.doubt_id, OLD.doubt_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_doubt_questions_used ON public.doubt_messages;
CREATE TRIGGER trg_sync_doubt_questions_used
AFTER INSERT OR UPDATE OR DELETE ON public.doubt_messages
FOR EACH ROW EXECUTE FUNCTION public.sync_doubt_questions_used();

-- RLS policies
CREATE POLICY "Students view messages of own doubts"
ON public.doubt_messages FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.student_doubts d
  WHERE d.id = doubt_messages.doubt_id AND d.student_id = auth.uid()
));

CREATE POLICY "Students create question messages on own doubts"
ON public.doubt_messages FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND author_role = 'student'
  AND message_kind = 'question'
  AND EXISTS (
    SELECT 1 FROM public.student_doubts d
    WHERE d.id = doubt_messages.doubt_id AND d.student_id = auth.uid()
  )
);

CREATE POLICY "Teachers view messages of assigned doubts"
ON public.doubt_messages FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.student_doubts d
  WHERE d.id = doubt_messages.doubt_id AND d.teacher_id = auth.uid()
));

CREATE POLICY "Teachers post answer messages on assigned doubts"
ON public.doubt_messages FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND author_role = 'teacher'
  AND message_kind = 'answer'
  AND EXISTS (
    SELECT 1 FROM public.student_doubts d
    WHERE d.id = doubt_messages.doubt_id AND d.teacher_id = auth.uid()
  )
);

CREATE POLICY "Admins view all doubt messages"
ON public.doubt_messages FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update all doubt messages"
ON public.doubt_messages FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins insert any doubt messages"
ON public.doubt_messages FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3) Default platform setting for limits (per plan + per individual purchase)
INSERT INTO public.platform_settings (key, value)
VALUES (
  'doubt_messages_limits',
  jsonb_build_object(
    'individual_purchase', 1,
    'plans', jsonb_build_object('Básico', 1, 'Premium', 3, 'Institucional', 5)
  )
)
ON CONFLICT (key) DO NOTHING;
