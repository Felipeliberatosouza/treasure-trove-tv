CREATE OR REPLACE FUNCTION public.get_content_view_counts(_content_type text, _ids uuid[])
RETURNS TABLE(content_id uuid, views_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.content_id, COUNT(*)::int AS views_count
  FROM public.video_views v
  WHERE v.content_type = _content_type
    AND v.content_id = ANY(_ids)
  GROUP BY v.content_id;
$$;

REVOKE ALL ON FUNCTION public.get_content_view_counts(text, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_content_view_counts(text, uuid[]) TO authenticated;