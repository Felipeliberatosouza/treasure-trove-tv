
-- =====================================================
-- 1) subscription_plans: hide stripe_price_id from anon
-- =====================================================
-- Remove blanket grants and replace anon with column-level grants
REVOKE SELECT ON public.subscription_plans FROM anon;
REVOKE SELECT ON public.subscription_plans FROM authenticated;

GRANT SELECT (
  id, name, price, highlighted, features,
  service_revisoes, service_revisoes_qty,
  service_resumos, service_resumos_qty,
  service_simulados, service_simulados_qty,
  service_top_questoes, service_top_questoes_qty,
  service_colinhas, service_colinhas_qty,
  service_duvidas, service_duvidas_qty,
  service_aula_particular, service_aula_particular_qty,
  active, sort_order, created_at, updated_at,
  cancel_text, allow_free_cancel,
  min_commitment_days, min_usage_charge_pct
) ON public.subscription_plans TO anon;

-- Authenticated users keep full SELECT (needed by checkout / admin flows)
GRANT SELECT ON public.subscription_plans TO authenticated;

-- =====================================================
-- 2) video_ratings: restrict per-row visibility
-- =====================================================
DROP POLICY IF EXISTS "Anyone authenticated can view ratings" ON public.video_ratings;

CREATE POLICY "Users can view their own ratings"
ON public.video_ratings
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all ratings"
ON public.video_ratings
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Public aggregate view (no per-user data)
CREATE OR REPLACE VIEW public.video_rating_aggregates
WITH (security_invoker = true) AS
SELECT
  content_type,
  content_id,
  AVG(rating)::numeric AS average,
  COUNT(*)::int AS count
FROM public.video_ratings
GROUP BY content_type, content_id;

-- The view runs with the caller's privileges (security_invoker), so callers
-- still need direct SELECT on the underlying table to read it. Allow a
-- minimal, aggregate-only path by granting SELECT on a security-definer
-- function instead.
REVOKE ALL ON public.video_rating_aggregates FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_video_rating_aggregates(
  _content_type text,
  _ids uuid[]
)
RETURNS TABLE(content_id uuid, average numeric, count int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT vr.content_id,
         AVG(vr.rating)::numeric AS average,
         COUNT(*)::int AS count
  FROM public.video_ratings vr
  WHERE vr.content_type = _content_type
    AND vr.content_id = ANY(_ids)
  GROUP BY vr.content_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_video_rating_aggregates(text, uuid[])
  TO anon, authenticated;
