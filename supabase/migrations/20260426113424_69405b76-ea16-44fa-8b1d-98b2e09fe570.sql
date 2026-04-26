-- 1. Add new profile columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS experiences jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS education jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2. Create change-requests table
CREATE TABLE IF NOT EXISTS public.teacher_profile_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  proposed jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  rejection_reason text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tpc_status_chk CHECK (status IN ('pending','approved','rejected'))
);

CREATE INDEX IF NOT EXISTS tpc_teacher_idx ON public.teacher_profile_change_requests (teacher_id);
CREATE INDEX IF NOT EXISTS tpc_status_idx ON public.teacher_profile_change_requests (status);

ALTER TABLE public.teacher_profile_change_requests ENABLE ROW LEVEL SECURITY;

-- Teachers manage their own pending requests
CREATE POLICY "Teachers create own profile change requests"
  ON public.teacher_profile_change_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = teacher_id AND has_role(auth.uid(), 'teacher'::app_role));

CREATE POLICY "Teachers view own profile change requests"
  ON public.teacher_profile_change_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = teacher_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Teachers cancel own pending requests"
  ON public.teacher_profile_change_requests
  FOR DELETE TO authenticated
  USING (auth.uid() = teacher_id AND status = 'pending');

CREATE POLICY "Admins update profile change requests"
  ON public.teacher_profile_change_requests
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_tpc_updated_at ON public.teacher_profile_change_requests;
CREATE TRIGGER trg_tpc_updated_at
  BEFORE UPDATE ON public.teacher_profile_change_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Apply approved request to profile
CREATE OR REPLACE FUNCTION public.apply_teacher_profile_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p jsonb := NEW.proposed;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    UPDATE public.profiles
       SET
         name             = COALESCE(p->>'name', name),
         profile_title    = COALESCE(p->>'profile_title', profile_title),
         expertise_area   = COALESCE(p->>'expertise_area', expertise_area),
         bio              = COALESCE(p->>'bio', bio),
         avatar_url       = COALESCE(p->>'avatar_url', avatar_url),
         experiences      = COALESCE(p->'experiences', experiences),
         education        = COALESCE(p->'education', education),
         updated_at       = now()
     WHERE user_id = NEW.teacher_id;

    NEW.reviewed_at := now();
  ELSIF NEW.status = 'rejected' AND (OLD.status IS DISTINCT FROM 'rejected') THEN
    NEW.reviewed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_teacher_profile_change ON public.teacher_profile_change_requests;
CREATE TRIGGER trg_apply_teacher_profile_change
  BEFORE UPDATE ON public.teacher_profile_change_requests
  FOR EACH ROW EXECUTE FUNCTION public.apply_teacher_profile_change();