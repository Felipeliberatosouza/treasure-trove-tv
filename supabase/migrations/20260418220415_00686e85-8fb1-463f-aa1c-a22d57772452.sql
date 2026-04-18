ALTER TABLE public.email_templates 
  ADD COLUMN IF NOT EXISTS coupon_starts_at timestamp with time zone NULL;