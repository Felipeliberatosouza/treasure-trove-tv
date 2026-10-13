-- Server-only financial/credit functions
REVOKE EXECUTE ON FUNCTION public.add_ai_credits(uuid, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.credit_cashback_purchase(uuid, numeric, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.credit_cashback_referral(uuid, numeric, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_cashback(uuid, numeric, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_plan_ai_credits(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.preview_cashback_usage(uuid, numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.register_cashback_referral(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_pending_cashback() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_old_cashback() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_cashback_account(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_content_duration(text, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_ai_credits(uuid, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.credit_cashback_purchase(uuid, numeric, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.credit_cashback_referral(uuid, numeric, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_cashback(uuid, numeric, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_plan_ai_credits(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.preview_cashback_usage(uuid, numeric) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.register_cashback_referral(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_pending_cashback() TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_old_cashback() TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_cashback_account(uuid) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.set_content_duration(text, uuid, integer) TO service_role, authenticated;

-- Trigger functions never need direct API execution
REVOKE EXECUTE ON FUNCTION public.handle_beta_mode_toggle() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_teacher_profile_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_triage_bug_report() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_referral_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- View must respect caller RLS... keep public teacher listing working via security_barrier only
ALTER VIEW public.teacher_profiles_public SET (security_barrier = true);

-- Remove open insert on email security queue (edge function uses service role)
DROP POLICY IF EXISTS "Anyone can create security notifications" ON public.security_notifications;