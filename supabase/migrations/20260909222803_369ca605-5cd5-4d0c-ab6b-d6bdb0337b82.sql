DROP POLICY IF EXISTS "Anyone can view active areas" ON public.course_areas;

CREATE POLICY "Anyone can view active areas"
ON public.course_areas
FOR SELECT
TO public
USING (active = true OR has_role(auth.uid(), 'admin'::app_role));