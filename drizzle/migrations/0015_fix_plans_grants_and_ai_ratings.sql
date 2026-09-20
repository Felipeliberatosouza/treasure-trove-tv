GRANT SELECT ON public.subscription_plans TO anon;
GRANT SELECT ON public.subscription_plans TO authenticated;
GRANT ALL ON public.subscription_plans TO service_role;

ALTER TABLE public.video_ratings DROP CONSTRAINT IF EXISTS video_ratings_content_type_check;
ALTER TABLE public.video_ratings
  ADD CONSTRAINT video_ratings_content_type_check
  CHECK (content_type IN ('lesson', 'exam_solution', 'ai'));