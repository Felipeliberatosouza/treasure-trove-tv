
DROP FUNCTION IF EXISTS public.get_video_rating_aggregates(text, uuid[]);

CREATE OR REPLACE FUNCTION public.get_video_rating_aggregates(_ids uuid[])
RETURNS TABLE(content_type text, content_id uuid, average numeric, count int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT vr.content_type,
         vr.content_id,
         AVG(vr.rating)::numeric AS average,
         COUNT(*)::int AS count
  FROM public.video_ratings vr
  WHERE vr.content_id = ANY(_ids)
  GROUP BY vr.content_type, vr.content_id;
$$;

REVOKE ALL ON FUNCTION public.get_video_rating_aggregates(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_video_rating_aggregates(uuid[])
  TO anon, authenticated;
