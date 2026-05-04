
DROP POLICY IF EXISTS "Anon can view teacher profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated can view teacher profiles" ON public.profiles;

CREATE OR REPLACE VIEW public.teacher_profiles_public
WITH (security_invoker = true) AS
SELECT user_id, name, avatar_url, bio, slug, expertise_area,
       profile_title, areas, experiences, education, content_order
FROM public.profiles
WHERE public.is_teacher(user_id);

GRANT SELECT ON public.teacher_profiles_public TO anon, authenticated;

CREATE POLICY "View teacher profile public fields"
  ON public.profiles FOR SELECT
  TO anon, authenticated
  USING (public.is_teacher(user_id));

REVOKE SELECT (cpf, pix_key, address, phone, birth_date) ON public.profiles FROM anon;

-- Videos bucket
DROP POLICY IF EXISTS "Authenticated users can view videos" ON storage.objects;
CREATE POLICY "Video access via subscription, purchase, or ownership"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'videos' AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.lessons l
        WHERE l.video_url LIKE '%' || storage.objects.name || '%'
          AND l.teacher_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.student_subscriptions s
        WHERE s.user_id = auth.uid()
          AND s.status = 'active'
          AND (s.expires_at IS NULL OR s.expires_at > now())
      )
      OR EXISTS (
        SELECT 1 FROM public.video_purchases vp
        JOIN public.lessons l ON l.id = vp.content_id
        WHERE vp.user_id = auth.uid()
          AND vp.payment_status = 'completed'
          AND vp.content_type = 'lesson'
          AND l.video_url LIKE '%' || storage.objects.name || '%'
      )
    )
  );

-- Materials uploads
DROP POLICY IF EXISTS "Authenticated users can upload materials" ON storage.objects;
CREATE POLICY "Teachers and admins upload materials"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'materials'
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND (
      public.has_role(auth.uid(), 'teacher'::app_role)
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

-- Scheduled lessons
DROP POLICY IF EXISTS "Teachers manage own scheduled lessons" ON public.scheduled_lessons;
CREATE POLICY "Teachers read own scheduled lessons"
  ON public.scheduled_lessons FOR SELECT TO authenticated
  USING (teacher_id = auth.uid());
CREATE POLICY "Teachers update own scheduled lessons"
  ON public.scheduled_lessons FOR UPDATE TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());
CREATE POLICY "Teachers insert own scheduled lessons"
  ON public.scheduled_lessons FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid());
CREATE POLICY "Admins delete scheduled lessons"
  ON public.scheduled_lessons FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Realtime
DROP POLICY IF EXISTS "Authenticated can subscribe to own topics" ON realtime.messages;
CREATE POLICY "Authenticated can subscribe to own topics"
  ON realtime.messages FOR SELECT TO authenticated
  USING (
    realtime.topic() LIKE 'user:' || auth.uid()::text || ':%'
    OR realtime.topic() = 'public'
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- OTP brute-force fields
ALTER TABLE public.phone_verifications
  ADD COLUMN IF NOT EXISTS failed_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invalidated boolean NOT NULL DEFAULT false;
