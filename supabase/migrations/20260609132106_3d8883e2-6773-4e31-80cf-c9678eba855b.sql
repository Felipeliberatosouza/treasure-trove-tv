
-- 1. platform_settings: replace blanket public policy with explicit allowlist
DROP POLICY IF EXISTS "Public can view non-internal platform settings" ON public.platform_settings;
CREATE POLICY "Public can view allowlisted platform settings"
ON public.platform_settings
FOR SELECT
TO anon, authenticated
USING (key = ANY (ARRAY[
  'branding','contact','footer','about_us','privacy_policy',
  'terms_of_use','terms_of_use_students','terms_of_use_teachers',
  'hero_banner','hero_banner_student','hero_banner_teacher',
  'secondary_banner','secondary_banner_student','secondary_banner_teacher',
  'teacher_banner','featured_videos','subscription_plans','video_pricing',
  'free_trial','retention_coupon','aula_particular_config','product_config',
  'doubt_messages_limits','doubt_response_deadline_days',
  'teacher_contract_template','teacher_content_goal'
]));

-- 2. profiles: drop public teacher policy; expose public teacher info via SECURITY DEFINER view
DROP POLICY IF EXISTS "Public can view teacher profile rows" ON public.profiles;

DROP VIEW IF EXISTS public.teacher_profiles_public;
CREATE VIEW public.teacher_profiles_public
WITH (security_invoker = false) AS
SELECT
  user_id, name, avatar_url, bio, slug,
  expertise_area, profile_title, areas,
  experiences, education, content_order
FROM public.profiles
WHERE public.is_teacher(user_id);

GRANT SELECT ON public.teacher_profiles_public TO anon, authenticated;

-- 3. prova_votes: restrict to own + admin, expose aggregate via RPC
DROP POLICY IF EXISTS "Authenticated can view prova votes" ON public.prova_votes;
CREATE POLICY "Users can view own prova votes"
ON public.prova_votes
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all prova votes"
ON public.prova_votes
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.get_prova_vote_stats(_content_id uuid)
RETURNS TABLE(yes_count integer, total_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*) FILTER (WHERE vote = true)::int,
    COUNT(*)::int
  FROM public.prova_votes
  WHERE content_id = _content_id;
$$;
GRANT EXECUTE ON FUNCTION public.get_prova_vote_stats(uuid) TO anon, authenticated;

-- 4. scheduled_lesson_reminders: let recipients read their own
CREATE POLICY "Recipients can view own lesson reminders"
ON public.scheduled_lesson_reminders
FOR SELECT
TO authenticated
USING (recipient_user_id = auth.uid());

-- 5. storage: explicit anon SELECT for public buckets
CREATE POLICY "Public can read thumbnails"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'thumbnails');

CREATE POLICY "Public can read carousel covers"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'carousel-covers');
