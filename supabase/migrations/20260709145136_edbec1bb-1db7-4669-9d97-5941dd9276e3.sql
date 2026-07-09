
-- 1) Tighten teacher availability visibility: only expose rows for users who actually have the teacher role.
DROP POLICY IF EXISTS "Anyone authenticated can view teacher recurring availability" ON public.teacher_availability_recurring;
CREATE POLICY "Authenticated can view availability of active teachers"
ON public.teacher_availability_recurring
FOR SELECT
TO authenticated
USING (
  teacher_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(teacher_id, 'teacher'::public.app_role)
);

DROP POLICY IF EXISTS "Anyone authenticated can view teacher exceptions" ON public.teacher_availability_exceptions;
CREATE POLICY "Authenticated can view exceptions of active teachers"
ON public.teacher_availability_exceptions
FOR SELECT
TO authenticated
USING (
  teacher_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(teacher_id, 'teacher'::public.app_role)
);

-- 2) Hide stripe_payment_id from end users; only service_role (edge functions) needs it.
REVOKE SELECT (stripe_payment_id) ON public.video_purchases FROM authenticated;
REVOKE SELECT (stripe_payment_id) ON public.video_purchases FROM anon;
