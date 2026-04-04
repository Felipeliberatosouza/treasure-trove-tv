
-- Lessons table
CREATE TABLE public.lessons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  video_url TEXT DEFAULT '',
  thumbnail_url TEXT DEFAULT '',
  carousel_cover_url TEXT DEFAULT '',
  published BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view published lessons"
ON public.lessons FOR SELECT TO authenticated
USING (published = true OR teacher_id = auth.uid());

CREATE POLICY "Teachers can create lessons"
ON public.lessons FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'teacher') AND teacher_id = auth.uid());

CREATE POLICY "Teachers can update own lessons"
ON public.lessons FOR UPDATE TO authenticated
USING (teacher_id = auth.uid() AND has_role(auth.uid(), 'teacher'));

CREATE POLICY "Teachers can delete own lessons"
ON public.lessons FOR DELETE TO authenticated
USING (teacher_id = auth.uid() AND has_role(auth.uid(), 'teacher'));

CREATE TRIGGER update_lessons_updated_at
BEFORE UPDATE ON public.lessons
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Exam solutions table
CREATE TABLE public.exam_solutions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  video_url TEXT DEFAULT '',
  thumbnail_url TEXT DEFAULT '',
  carousel_cover_url TEXT DEFAULT '',
  published BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.exam_solutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view published exam_solutions"
ON public.exam_solutions FOR SELECT TO authenticated
USING (published = true OR teacher_id = auth.uid());

CREATE POLICY "Teachers can create exam_solutions"
ON public.exam_solutions FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'teacher') AND teacher_id = auth.uid());

CREATE POLICY "Teachers can update own exam_solutions"
ON public.exam_solutions FOR UPDATE TO authenticated
USING (teacher_id = auth.uid() AND has_role(auth.uid(), 'teacher'));

CREATE POLICY "Teachers can delete own exam_solutions"
ON public.exam_solutions FOR DELETE TO authenticated
USING (teacher_id = auth.uid() AND has_role(auth.uid(), 'teacher'));

CREATE TRIGGER update_exam_solutions_updated_at
BEFORE UPDATE ON public.exam_solutions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('videos', 'videos', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('thumbnails', 'thumbnails', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('carousel-covers', 'carousel-covers', true);

-- Storage policies for videos
CREATE POLICY "Teachers can upload videos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'videos' AND has_role(auth.uid(), 'teacher'));

CREATE POLICY "Authenticated users can view videos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'videos');

CREATE POLICY "Teachers can delete own videos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for thumbnails
CREATE POLICY "Teachers can upload thumbnails"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'thumbnails' AND has_role(auth.uid(), 'teacher'));

CREATE POLICY "Anyone can view thumbnails"
ON storage.objects FOR SELECT
USING (bucket_id = 'thumbnails');

CREATE POLICY "Teachers can delete own thumbnails"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'thumbnails' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for carousel covers
CREATE POLICY "Teachers can upload carousel covers"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'carousel-covers' AND has_role(auth.uid(), 'teacher'));

CREATE POLICY "Anyone can view carousel covers"
ON storage.objects FOR SELECT
USING (bucket_id = 'carousel-covers');

CREATE POLICY "Teachers can delete own carousel covers"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'carousel-covers' AND auth.uid()::text = (storage.foldername(name))[1]);
