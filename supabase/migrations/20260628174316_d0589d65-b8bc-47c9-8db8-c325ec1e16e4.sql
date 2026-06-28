CREATE OR REPLACE FUNCTION public.get_content_view_counts(_content_type text, _ids uuid[])
RETURNS TABLE(content_id uuid, views_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT v.content_id, COUNT(*)::int AS views_count
  FROM public.video_views v
  WHERE v.content_type = _content_type
    AND v.content_id = ANY(_ids)
    AND COALESCE(v.watch_percentage, 0) >= COALESCE(
      (SELECT (value ->> 'min_view_percent')::numeric
         FROM public.platform_settings
        WHERE key = 'free_trial'
        LIMIT 1),
      70
    )
  GROUP BY v.content_id;
$$;