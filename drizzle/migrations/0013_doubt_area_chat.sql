-- 1. student_doubts: audience by area + interaction accounting
ALTER TABLE public.student_doubts
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'teacher',
  ADD COLUMN IF NOT EXISTS area_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS interactions_limit integer,
  ADD COLUMN IF NOT EXISTS interactions_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credits_spent integer NOT NULL DEFAULT 0;

ALTER TABLE public.student_doubts
  ADD CONSTRAINT student_doubts_audience_check CHECK (audience IN ('teacher','area')) NOT VALID;

-- 2. doubt_messages: moderation + payment metadata
ALTER TABLE public.doubt_messages
  ADD COLUMN IF NOT EXISTS blocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS block_reason text,
  ADD COLUMN IF NOT EXISTS block_matches text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS paid_with_credits boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bonus_amount numeric NOT NULL DEFAULT 0;

ALTER TABLE public.doubt_messages DROP CONSTRAINT IF EXISTS doubt_messages_status_check;
ALTER TABLE public.doubt_messages
  ADD CONSTRAINT doubt_messages_status_check
  CHECK (status IN ('pending_approval','approved','rejected','answered','blocked'));

-- 3. teacher preference: receive doubt emails
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS receives_doubt_emails boolean NOT NULL DEFAULT true;

-- 4. invites (which teachers were called for an area doubt)
CREATE TABLE IF NOT EXISTS public.doubt_area_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doubt_id uuid NOT NULL REFERENCES public.student_doubts(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL,
  notified_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (doubt_id, teacher_id)
);
GRANT SELECT ON public.doubt_area_invites TO authenticated;
GRANT ALL ON public.doubt_area_invites TO service_role;
ALTER TABLE public.doubt_area_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage doubt invites" ON public.doubt_area_invites
  TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY "Teachers read own doubt invites" ON public.doubt_area_invites
  FOR SELECT TO authenticated USING (teacher_id = auth.uid());

-- 5. optional bonus paid per answered doubt
CREATE TABLE IF NOT EXISTS public.doubt_teacher_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doubt_id uuid NOT NULL REFERENCES public.student_doubts(id) ON DELETE CASCADE,
  message_id uuid,
  teacher_id uuid NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id)
);
GRANT SELECT ON public.doubt_teacher_rewards TO authenticated;
GRANT ALL ON public.doubt_teacher_rewards TO service_role;
ALTER TABLE public.doubt_teacher_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage doubt rewards" ON public.doubt_teacher_rewards
  TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY "Teachers read own doubt rewards" ON public.doubt_teacher_rewards
  FOR SELECT TO authenticated USING (teacher_id = auth.uid());
CREATE TRIGGER trg_doubt_rewards_updated BEFORE UPDATE ON public.doubt_teacher_rewards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. access helper: teacher of the area can join the chat
CREATE OR REPLACE FUNCTION public.can_teacher_access_doubt(_doubt_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.student_doubts d
    JOIN public.profiles p ON p.user_id = auth.uid()
    WHERE d.id = _doubt_id
      AND d.audience = 'area'
      AND public.is_teacher(auth.uid())
      AND (
        cardinality(d.area_ids) = 0
        OR EXISTS (
          SELECT 1 FROM public.course_areas ca
          WHERE ca.id = ANY (d.area_ids)
            AND ca.name = ANY (COALESCE(p.areas, '{}'::text[]))
        )
      )
  );
$$;

CREATE POLICY "Area teachers view area doubts" ON public.student_doubts
  FOR SELECT TO authenticated USING (public.can_teacher_access_doubt(id));

CREATE POLICY "Area teachers view area doubt messages" ON public.doubt_messages
  FOR SELECT TO authenticated
  USING (public.can_teacher_access_doubt(doubt_id) AND blocked = false);

CREATE POLICY "Area teachers answer area doubts" ON public.doubt_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND author_role = 'teacher'
    AND message_kind = 'answer'
    AND public.can_teacher_access_doubt(doubt_id)
  );

-- 7. limit enforcement honouring unlimited plans
CREATE OR REPLACE FUNCTION public.enforce_doubt_messages_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  d public.student_doubts%ROWTYPE;
  used int;
  lim int;
BEGIN
  SELECT * INTO d FROM public.student_doubts WHERE id = NEW.doubt_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dúvida não encontrada.';
  END IF;

  IF NEW.author_role = 'student' AND NEW.message_kind = 'question' AND COALESCE(NEW.blocked,false) = false THEN
    -- interactions_limit NULL on an area doubt means unlimited
    IF d.audience = 'area' THEN
      lim := d.interactions_limit;
    ELSE
      lim := COALESCE(d.interactions_limit, d.messages_limit, 1);
    END IF;

    IF lim IS NOT NULL THEN
      SELECT public.count_student_questions(NEW.doubt_id) INTO used;
      IF (used + 1) > lim THEN
        RAISE EXCEPTION 'Você atingiu o limite de % perguntas nesta dúvida.', lim;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;