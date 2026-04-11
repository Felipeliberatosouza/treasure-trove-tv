-- Drop and recreate the teacher update policy to allow setting pending_answer_approval
DROP POLICY IF EXISTS "Teachers can answer assigned doubts" ON public.student_doubts;

CREATE POLICY "Teachers can answer assigned doubts"
ON public.student_doubts
FOR UPDATE
TO authenticated
USING (
  (auth.uid() = teacher_id) AND (status IN ('approved', 'pending_answer_approval'))
);