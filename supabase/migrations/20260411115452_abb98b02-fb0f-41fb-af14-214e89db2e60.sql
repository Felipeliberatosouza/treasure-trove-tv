ALTER TABLE public.subscription_plans
  ADD COLUMN allow_free_cancel boolean NOT NULL DEFAULT true,
  ADD COLUMN min_commitment_days integer NOT NULL DEFAULT 30;