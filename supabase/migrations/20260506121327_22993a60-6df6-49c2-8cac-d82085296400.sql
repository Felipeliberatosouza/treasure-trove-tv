ALTER TABLE public.student_doubts REPLICA IDENTITY FULL;
ALTER TABLE public.doubt_messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.student_doubts;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.doubt_messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END$$;