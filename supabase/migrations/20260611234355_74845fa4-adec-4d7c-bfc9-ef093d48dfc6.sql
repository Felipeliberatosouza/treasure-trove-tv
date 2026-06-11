REVOKE ALL ON FUNCTION public.can_access_lesson_material(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_lesson_material(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_access_lesson_material(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_lesson_material(uuid, text) TO service_role;