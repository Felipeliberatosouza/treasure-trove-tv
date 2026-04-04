
-- Table for individual video purchases
CREATE TABLE public.video_purchases (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('lesson', 'exam_solution')),
  content_id uuid NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
  stripe_payment_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.video_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own purchases" ON public.video_purchases
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can create own purchases" ON public.video_purchases
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_video_purchases_user ON public.video_purchases(user_id);
CREATE INDEX idx_video_purchases_content ON public.video_purchases(content_type, content_id);

-- Table for video ratings
CREATE TABLE public.video_ratings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('lesson', 'exam_solution')),
  content_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, content_type, content_id)
);

ALTER TABLE public.video_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view ratings" ON public.video_ratings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can create own ratings" ON public.video_ratings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ratings" ON public.video_ratings
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own ratings" ON public.video_ratings
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_video_ratings_content ON public.video_ratings(content_type, content_id);

-- Add price column to lessons and exam_solutions
ALTER TABLE public.lessons ADD COLUMN price numeric DEFAULT 0;
ALTER TABLE public.exam_solutions ADD COLUMN price numeric DEFAULT 0;

-- Triggers for updated_at
CREATE TRIGGER update_video_purchases_updated_at
  BEFORE UPDATE ON public.video_purchases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_video_ratings_updated_at
  BEFORE UPDATE ON public.video_ratings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
