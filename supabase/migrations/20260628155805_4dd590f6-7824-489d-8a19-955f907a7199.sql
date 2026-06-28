REVOKE SELECT ON public.subscription_plans FROM anon;
REVOKE SELECT (stripe_price_id) ON public.subscription_plans FROM anon;

DROP POLICY IF EXISTS "Anyone can view active plans" ON public.subscription_plans;

CREATE POLICY "Authenticated users can view active plans"
ON public.subscription_plans
FOR SELECT
TO authenticated
USING (active = true);

CREATE POLICY "Visitors can view active plan catalog"
ON public.subscription_plans
FOR SELECT
TO anon
USING (active = true);