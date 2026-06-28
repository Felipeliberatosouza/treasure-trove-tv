
DROP POLICY IF EXISTS "View material meta of approved lessons or own" ON public.lesson_material_meta;
CREATE POLICY "View material meta of approved lessons or own"
ON public.lesson_material_meta
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.lessons l
    WHERE l.id = lesson_material_meta.lesson_id
      AND (
        (l.published = true AND l.admin_approved = true)
        OR l.teacher_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
      )
      AND (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR l.teacher_id = auth.uid()
        OR NOT public.is_user_blocked(auth.uid())
      )
  )
);

DROP POLICY IF EXISTS "Video access via subscription, purchase, or ownership" ON storage.objects;
CREATE POLICY "Video access via subscription, purchase, or ownership"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'videos'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.lessons l
      WHERE l.video_url LIKE '%' || objects.name || '%'
        AND l.teacher_id = auth.uid()
    )
    OR (
      NOT public.is_user_blocked(auth.uid())
      AND EXISTS (
        SELECT 1
        FROM public.student_subscriptions s
        JOIN public.lessons l ON l.video_url LIKE '%' || objects.name || '%'
        WHERE s.user_id = auth.uid()
          AND s.status = 'active'
          AND (s.expires_at IS NULL OR s.expires_at > now())
          AND COALESCE(l.published, false) = true
          AND COALESCE(l.admin_approved, false) = true
      )
    )
    OR (
      NOT public.is_user_blocked(auth.uid())
      AND EXISTS (
        SELECT 1
        FROM public.video_purchases vp
        JOIN public.lessons l ON l.id = vp.content_id
        WHERE vp.user_id = auth.uid()
          AND vp.payment_status = 'completed'
          AND vp.content_type = 'lesson'
          AND l.video_url LIKE '%' || objects.name || '%'
      )
    )
  )
);
