
CREATE OR REPLACE FUNCTION public.add_student_role_to_self()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only allow if user doesn't already have student role
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'student') THEN
    RETURN false;
  END IF;
  
  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'student');
  RETURN true;
END;
$$;
