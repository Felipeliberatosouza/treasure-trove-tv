CREATE OR REPLACE FUNCTION public.count_student_questions(_doubt_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COUNT(*)::int FROM public.doubt_messages
   WHERE doubt_id = _doubt_id
     AND author_role = 'student'
     AND message_kind = 'question'
     AND status NOT IN ('rejected','blocked')
     AND COALESCE(blocked, false) = false
$$;