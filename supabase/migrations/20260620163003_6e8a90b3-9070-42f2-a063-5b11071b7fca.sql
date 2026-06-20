
-- 1) Prevent anon from reading stripe_price_id on subscription_plans
REVOKE SELECT (stripe_price_id) ON public.subscription_plans FROM anon;

-- 2) Set fixed search_path on internal pgmq wrapper functions
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
