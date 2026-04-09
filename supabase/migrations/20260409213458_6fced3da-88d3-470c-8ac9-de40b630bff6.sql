
-- Table for course areas
CREATE TABLE public.course_areas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  icon TEXT DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT true,
  show_on_homepage BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.course_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active areas" ON public.course_areas FOR SELECT USING (true);
CREATE POLICY "Admins can insert areas" ON public.course_areas FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update areas" ON public.course_areas FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete areas" ON public.course_areas FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_course_areas_updated_at BEFORE UPDATE ON public.course_areas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add areas column to profiles (student interests, up to 3)
ALTER TABLE public.profiles ADD COLUMN areas TEXT[] DEFAULT '{}';

-- Add areas column to lessons (teacher classification, up to 3)
ALTER TABLE public.lessons ADD COLUMN areas TEXT[] DEFAULT '{}';

-- Add areas column to exam_solutions (teacher classification, up to 3)
ALTER TABLE public.exam_solutions ADD COLUMN areas TEXT[] DEFAULT '{}';
