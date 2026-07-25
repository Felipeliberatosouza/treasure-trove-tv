DROP POLICY IF EXISTS "Teachers view messages of assigned doubts" ON public.doubt_messages;
CREATE POLICY "Teachers view messages of assigned doubts"
ON public.doubt_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.student_doubts d
    WHERE d.id = doubt_messages.doubt_id
      AND d.teacher_id = auth.uid()
      AND d.status IN ('approved','answered')
  )
);