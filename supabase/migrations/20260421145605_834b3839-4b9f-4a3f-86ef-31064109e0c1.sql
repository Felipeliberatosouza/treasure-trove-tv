ALTER PUBLICATION supabase_realtime ADD TABLE public.teacher_availability_exceptions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.teacher_availability_recurring;
ALTER PUBLICATION supabase_realtime ADD TABLE public.scheduled_lessons;

ALTER TABLE public.teacher_availability_exceptions REPLICA IDENTITY FULL;
ALTER TABLE public.teacher_availability_recurring REPLICA IDENTITY FULL;
ALTER TABLE public.scheduled_lessons REPLICA IDENTITY FULL;