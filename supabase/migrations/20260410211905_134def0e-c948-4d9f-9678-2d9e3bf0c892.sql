
CREATE POLICY "Anon can view teacher profiles"
ON public.profiles
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = profiles.user_id
      AND user_roles.role = 'teacher'
  )
);
