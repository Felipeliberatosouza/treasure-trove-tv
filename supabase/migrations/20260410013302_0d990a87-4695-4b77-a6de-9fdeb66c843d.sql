CREATE POLICY "Anon can view published approved lessons"
ON public.lessons
FOR SELECT
TO anon
USING (published = true AND admin_approved = true);

CREATE POLICY "Anon can view published approved exam_solutions"
ON public.exam_solutions
FOR SELECT
TO anon
USING (published = true AND admin_approved = true);

CREATE POLICY "Anon can view ratings"
ON public.video_ratings
FOR SELECT
TO anon
USING (true);