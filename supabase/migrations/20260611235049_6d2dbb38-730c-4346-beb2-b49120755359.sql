
-- 1) Videos bucket: scope INSERT to own folder, add UPDATE policy
DROP POLICY IF EXISTS "Teachers can upload videos" ON storage.objects;
CREATE POLICY "Teachers can upload videos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'videos'
    AND public.has_role(auth.uid(), 'teacher'::public.app_role)
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Teachers can update own videos" ON storage.objects;
CREATE POLICY "Teachers can update own videos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'videos'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'videos'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

-- 2) Videos SELECT: require lesson published + approved for subscription/purchase paths
DROP POLICY IF EXISTS "Video access via subscription, purchase, or ownership" ON storage.objects;
CREATE POLICY "Video access via subscription, purchase, or ownership"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'videos'
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR EXISTS (
        SELECT 1 FROM public.lessons l
        WHERE l.video_url LIKE ('%' || objects.name || '%')
          AND l.teacher_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.student_subscriptions s
        JOIN public.lessons l ON l.video_url LIKE ('%' || objects.name || '%')
        WHERE s.user_id = auth.uid()
          AND s.status = 'active'
          AND (s.expires_at IS NULL OR s.expires_at > now())
          AND COALESCE(l.published, false) = true
          AND COALESCE(l.admin_approved, false) = true
      )
      OR EXISTS (
        SELECT 1
        FROM public.video_purchases vp
        JOIN public.lessons l ON l.id = vp.content_id
        WHERE vp.user_id = auth.uid()
          AND vp.payment_status = 'completed'
          AND vp.content_type = 'lesson'
          AND l.video_url LIKE ('%' || objects.name || '%')
      )
    )
  );

-- 3) Thumbnails bucket: scope INSERT/UPDATE to own folder
DROP POLICY IF EXISTS "Teachers can upload thumbnails" ON storage.objects;
CREATE POLICY "Teachers can upload thumbnails"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'thumbnails'
    AND public.has_role(auth.uid(), 'teacher'::public.app_role)
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Teachers can update own thumbnails" ON storage.objects;
CREATE POLICY "Teachers can update own thumbnails"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'thumbnails'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'thumbnails'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

-- 4) Carousel covers bucket: scope INSERT/UPDATE to own folder
DROP POLICY IF EXISTS "Teachers can upload carousel covers" ON storage.objects;
CREATE POLICY "Teachers can upload carousel covers"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'carousel-covers'
    AND public.has_role(auth.uid(), 'teacher'::public.app_role)
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Teachers can update own carousel covers" ON storage.objects;
CREATE POLICY "Teachers can update own carousel covers"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'carousel-covers'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'carousel-covers'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

-- 5) Remove teacher availability tables from realtime publication
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'teacher_availability_recurring'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.teacher_availability_recurring';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'teacher_availability_exceptions'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.teacher_availability_exceptions';
  END IF;
END $$;
