ALTER TABLE public.email_templates 
  ADD COLUMN IF NOT EXISTS coupon_expires_at timestamp with time zone NULL;