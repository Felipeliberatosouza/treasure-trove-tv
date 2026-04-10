
-- Create student_doubts table
CREATE TABLE public.student_doubts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL,
  teacher_id UUID NOT NULL,
  content_id UUID NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'lesson',
  question TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_approval',
  answer TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  answered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.student_doubts ENABLE ROW LEVEL SECURITY;

-- Students can create their own doubts
CREATE POLICY "Students can create own doubts"
ON public.student_doubts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = student_id);

-- Students can view their own doubts
CREATE POLICY "Students can view own doubts"
ON public.student_doubts
FOR SELECT
TO authenticated
USING (auth.uid() = student_id);

-- Teachers can view approved doubts assigned to them
CREATE POLICY "Teachers can view assigned doubts"
ON public.student_doubts
FOR SELECT
TO authenticated
USING (auth.uid() = teacher_id AND status IN ('approved', 'answered'));

-- Teachers can update doubts assigned to them (to answer)
CREATE POLICY "Teachers can answer assigned doubts"
ON public.student_doubts
FOR UPDATE
TO authenticated
USING (auth.uid() = teacher_id AND status = 'approved');

-- Admins can view all doubts
CREATE POLICY "Admins can view all doubts"
ON public.student_doubts
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update all doubts (approve/reject)
CREATE POLICY "Admins can update all doubts"
ON public.student_doubts
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_student_doubts_updated_at
BEFORE UPDATE ON public.student_doubts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default doubt response deadline setting
INSERT INTO public.platform_settings (key, value)
VALUES ('doubt_response_deadline_days', '3'::jsonb)
ON CONFLICT DO NOTHING;
