CREATE TABLE public.email_change_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  old_email text,
  new_email text NOT NULL,
  changed_by uuid,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_change_history_user ON public.email_change_history(user_id);
CREATE INDEX idx_email_change_history_created ON public.email_change_history(created_at DESC);

GRANT SELECT ON public.email_change_history TO authenticated;
GRANT ALL ON public.email_change_history TO service_role;

ALTER TABLE public.email_change_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view all email change history"
  ON public.email_change_history FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Users view own email change history"
  ON public.email_change_history FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.log_profile_email_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND COALESCE(NEW.email,'') IS DISTINCT FROM COALESCE(OLD.email,'') AND COALESCE(NEW.email,'') <> '' THEN
    INSERT INTO public.email_change_history (user_id, old_email, new_email, changed_by)
    VALUES (NEW.user_id, OLD.email, NEW.email, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_profile_email_change ON public.profiles;
CREATE TRIGGER trg_log_profile_email_change
  AFTER UPDATE OF email ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.log_profile_email_change();