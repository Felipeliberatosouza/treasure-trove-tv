
-- 1. Create SECURITY DEFINER function to check teacher role (bypasses RLS on user_roles)
CREATE OR REPLACE FUNCTION public.is_teacher(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'teacher'
  )
$$;

-- 2. Drop the broken anon policy and recreate using the secure function
DROP POLICY IF EXISTS "Anon can view teacher profiles" ON public.profiles;

CREATE POLICY "Anon can view teacher profiles"
ON public.profiles
FOR SELECT
TO anon
USING (public.is_teacher(user_id));

-- 3. Allow anon to read video_views (for view counts on teacher profiles)
CREATE POLICY "Anon can view video views"
ON public.video_views
FOR SELECT
TO anon
USING (true);
