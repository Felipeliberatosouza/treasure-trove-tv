
-- Create sequence starting at 1000
CREATE SEQUENCE IF NOT EXISTS public.referral_code_seq START WITH 1000;

-- Add referral_code column
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code integer UNIQUE;

-- Assign codes to existing users that don't have one
UPDATE public.profiles 
SET referral_code = nextval('public.referral_code_seq')
WHERE referral_code IS NULL;

-- Create trigger function to auto-assign referral code on insert
CREATE OR REPLACE FUNCTION public.assign_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := nextval('public.referral_code_seq');
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER trg_assign_referral_code
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.assign_referral_code();
