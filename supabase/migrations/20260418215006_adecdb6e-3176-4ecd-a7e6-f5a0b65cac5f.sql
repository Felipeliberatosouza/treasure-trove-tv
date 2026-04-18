ALTER TABLE public.email_templates 
  ADD COLUMN IF NOT EXISTS coupon_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS coupon_code text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS coupon_message text NOT NULL DEFAULT '';