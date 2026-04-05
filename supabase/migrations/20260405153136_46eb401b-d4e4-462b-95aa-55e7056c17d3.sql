
-- Add admin_approved and platform_percentage to lessons
ALTER TABLE public.lessons 
  ADD COLUMN IF NOT EXISTS admin_approved boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS platform_percentage numeric DEFAULT 30;

-- Add admin_approved and platform_percentage to exam_solutions
ALTER TABLE public.exam_solutions 
  ADD COLUMN IF NOT EXISTS admin_approved boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS platform_percentage numeric DEFAULT 30;

-- Update RLS for lessons
DROP POLICY IF EXISTS "Anyone authenticated can view published lessons" ON public.lessons;
CREATE POLICY "Anyone authenticated can view approved published lessons"
  ON public.lessons FOR SELECT TO authenticated
  USING (
    (published = true AND admin_approved = true)
    OR teacher_id = auth.uid()
    OR has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can update any lesson"
  ON public.lessons FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Update RLS for exam_solutions
DROP POLICY IF EXISTS "Anyone authenticated can view published exam_solutions" ON public.exam_solutions;
CREATE POLICY "Anyone authenticated can view approved published exam_solutions"
  ON public.exam_solutions FOR SELECT TO authenticated
  USING (
    (published = true AND admin_approved = true)
    OR teacher_id = auth.uid()
    OR has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can update any exam_solution"
  ON public.exam_solutions FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Admin policies for profiles
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete any profile"
  ON public.profiles FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Admin policies for user_roles
CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
  ON public.user_roles FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Create video_views table
CREATE TABLE public.video_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  content_type text NOT NULL,
  content_id uuid NOT NULL,
  viewed_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.video_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own views"
  ON public.video_views FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all views"
  ON public.video_views FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE INDEX idx_video_views_content ON public.video_views (content_type, content_id);
CREATE INDEX idx_video_views_viewed_at ON public.video_views (viewed_at);

-- Create teacher_payments table
CREATE TABLE public.teacher_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  payment_type text NOT NULL DEFAULT 'subscription',
  total_views integer DEFAULT 0,
  avg_rating numeric DEFAULT 0,
  gross_amount numeric NOT NULL DEFAULT 0,
  platform_fee numeric NOT NULL DEFAULT 0,
  net_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.teacher_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all payments"
  ON public.teacher_payments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Teachers can view own payments"
  ON public.teacher_payments FOR SELECT TO authenticated
  USING (auth.uid() = teacher_id);

CREATE TRIGGER update_teacher_payments_updated_at
  BEFORE UPDATE ON public.teacher_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Admin policies for courses
CREATE POLICY "Admins can update any course"
  ON public.courses FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all courses"
  ON public.courses FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Admin policies for video_purchases
CREATE POLICY "Admins can view all purchases"
  ON public.video_purchases FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));
