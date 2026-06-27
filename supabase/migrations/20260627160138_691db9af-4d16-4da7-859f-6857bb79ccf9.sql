-- Normalize empty CPFs to NULL to avoid unique constraint collisions
UPDATE public.profiles SET cpf = NULL WHERE cpf = '';

-- Remove the empty-string default so new profiles have NULL by default
ALTER TABLE public.profiles ALTER COLUMN cpf DROP DEFAULT;

-- Ensure handle_new_user trigger also coerces empty CPF (if any path sets it later) by enforcing a check
-- Optional safeguard trigger: convert empty cpf to NULL on insert/update
CREATE OR REPLACE FUNCTION public.normalize_profile_cpf()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.cpf IS NOT NULL AND length(btrim(NEW.cpf)) = 0 THEN
    NEW.cpf := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_profile_cpf_trg ON public.profiles;
CREATE TRIGGER normalize_profile_cpf_trg
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.normalize_profile_cpf();