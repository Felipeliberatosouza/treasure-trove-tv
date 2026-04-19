-- 1) Table for sales post history
CREATE TABLE public.teacher_sales_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL,
  template TEXT NOT NULL DEFAULT 'colorful',
  caption TEXT NOT NULL DEFAULT '',
  thumbnail_url TEXT,
  thumbnail_path TEXT,
  contents JSONB NOT NULL DEFAULT '[]'::jsonb,
  public_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_teacher_sales_posts_teacher_created
  ON public.teacher_sales_posts (teacher_id, created_at DESC);

ALTER TABLE public.teacher_sales_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers view own sales posts"
ON public.teacher_sales_posts
FOR SELECT
TO authenticated
USING (auth.uid() = teacher_id);

CREATE POLICY "Teachers insert own sales posts"
ON public.teacher_sales_posts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Teachers delete own sales posts"
ON public.teacher_sales_posts
FOR DELETE
TO authenticated
USING (auth.uid() = teacher_id);

CREATE POLICY "Admins view all sales posts"
ON public.teacher_sales_posts
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER update_teacher_sales_posts_updated_at
BEFORE UPDATE ON public.teacher_sales_posts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Storage bucket for post thumbnails (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('sales-post-thumbnails', 'sales-post-thumbnails', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Sales post thumbnails are publicly readable"
ON storage.objects
FOR SELECT
USING (bucket_id = 'sales-post-thumbnails');

CREATE POLICY "Teachers upload own sales post thumbnails"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'sales-post-thumbnails'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Teachers update own sales post thumbnails"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'sales-post-thumbnails'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Teachers delete own sales post thumbnails"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'sales-post-thumbnails'
  AND auth.uid()::text = (storage.foldername(name))[1]
);