
-- 1) Strengthen normalize: keep only digits
CREATE OR REPLACE FUNCTION public.normalize_profile_cpf()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  digits text;
BEGIN
  IF NEW.cpf IS NULL THEN
    RETURN NEW;
  END IF;
  digits := regexp_replace(NEW.cpf, '\D', '', 'g');
  IF length(digits) = 0 THEN
    NEW.cpf := NULL;
    RETURN NEW;
  END IF;
  IF length(digits) <> 11 THEN
    RAISE EXCEPTION 'CPF inválido' USING ERRCODE = '23514';
  END IF;
  NEW.cpf := digits;
  RETURN NEW;
END;
$$;

-- Ensure normalize trigger exists (BEFORE INSERT/UPDATE)
DROP TRIGGER IF EXISTS normalize_profile_cpf_trg ON public.profiles;
CREATE TRIGGER normalize_profile_cpf_trg
BEFORE INSERT OR UPDATE OF cpf ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.normalize_profile_cpf();

-- 2) Backend duplicate check trigger (friendly Portuguese message)
CREATE OR REPLACE FUNCTION public.prevent_duplicate_cpf()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.cpf IS NULL THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE cpf = NEW.cpf
      AND user_id <> NEW.user_id
  ) THEN
    RAISE EXCEPTION 'CPF já cadastrado na plataforma.' USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_duplicate_cpf_trg ON public.profiles;
CREATE TRIGGER prevent_duplicate_cpf_trg
BEFORE INSERT OR UPDATE OF cpf ON public.profiles
FOR EACH ROW
WHEN (NEW.cpf IS NOT NULL)
EXECUTE FUNCTION public.prevent_duplicate_cpf();

-- 3) Hard guarantee: unique index on normalized cpf
CREATE UNIQUE INDEX IF NOT EXISTS profiles_cpf_unique_idx
ON public.profiles (cpf)
WHERE cpf IS NOT NULL;
