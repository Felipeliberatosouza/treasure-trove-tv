
-- Add active column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- Table to reserve referral codes of deleted users so they're never reused
CREATE TABLE public.reserved_referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code integer NOT NULL UNIQUE,
  original_user_email text,
  reason text NOT NULL DEFAULT 'deleted',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.reserved_referral_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage reserved codes"
ON public.reserved_referral_codes FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
