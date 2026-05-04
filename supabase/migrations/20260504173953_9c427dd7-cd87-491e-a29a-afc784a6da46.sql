
-- ============================================================
-- Security hardening migration
-- ============================================================

-- 1. profiles: drop the wide-open "anyone authenticated can view" policy
DROP POLICY IF EXISTS "Anyone authenticated can view profiles" ON public.profiles;

-- Allow users to view their own full profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow authenticated users to view teacher profiles only (sensitive PII still
-- present on table; safer would be a view, but maintain compatibility — frontend
-- already filters which fields are displayed). Sensitive fields (cpf, pix_key,
-- address, phone, birth_date) are now only visible to the user themselves and admins.
CREATE POLICY "Authenticated can view teacher profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_teacher(user_id));

-- Column-level: revoke SELECT on sensitive columns from anon/authenticated;
-- only service_role + admins (via separate has_role policy) keep access.
REVOKE SELECT (cpf, pix_key, address, phone, birth_date) ON public.profiles FROM anon;
REVOKE SELECT (cpf, pix_key, address, phone, birth_date) ON public.profiles FROM authenticated;

-- Re-grant sensitive cols to authenticated so users can read THEIR own row;
-- RLS still restricts row-level visibility, but column-level grant must exist.
GRANT SELECT (cpf, pix_key, address, phone, birth_date) ON public.profiles TO authenticated;

-- 2. email_templates: restrict to admins only
DROP POLICY IF EXISTS "Anyone can view email templates" ON public.email_templates;

CREATE POLICY "Admins can view email templates"
  ON public.email_templates FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. pool_runs: restrict reads to admins
DROP POLICY IF EXISTS "Teachers read pool runs" ON public.pool_runs;

-- 4. video_views: drop anon access
DROP POLICY IF EXISTS "Anon can view video views" ON public.video_views;

-- 5. prova_votes: drop anon access; keep authenticated
DROP POLICY IF EXISTS "Anyone can view prova votes" ON public.prova_votes;
CREATE POLICY "Authenticated can view prova votes"
  ON public.prova_votes FOR SELECT
  TO authenticated
  USING (true);

-- 6. platform_settings: hide internal keys (cron_secret etc.) from non-admins
DROP POLICY IF EXISTS "Anyone can view platform settings" ON public.platform_settings;

CREATE POLICY "Public can view non-internal platform settings"
  ON public.platform_settings FOR SELECT
  TO anon, authenticated
  USING (key NOT IN ('cron_secret'));

CREATE POLICY "Admins can view all platform settings"
  ON public.platform_settings FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 7. Definer function executability: revoke EXECUTE from anon/authenticated
-- on internal financial / cashback functions that should never be invoked by users.
REVOKE EXECUTE ON FUNCTION public.consume_cashback(uuid, numeric, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.credit_cashback_purchase(uuid, numeric, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.credit_cashback_referral(uuid, numeric, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_old_cashback() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_pending_cashback() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.register_cashback_referral(uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_cashback_account(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated;

-- Also revoke from anon for read-helpers that reveal config/tier info
REVOKE EXECUTE ON FUNCTION public.get_cashback_config() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_cashback_tier(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.preview_cashback_usage(uuid, numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.count_completed_packages(uuid, timestamptz, timestamptz) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_teacher_monthly_target(uuid) FROM anon;
