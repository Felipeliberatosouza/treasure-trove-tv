
-- Add video_type column to lessons and exam_solutions
ALTER TABLE public.lessons ADD COLUMN video_type text NOT NULL DEFAULT 'revisao';
ALTER TABLE public.exam_solutions ADD COLUMN video_type text NOT NULL DEFAULT 'revisao';

-- Create prova_votes table for "Caiu na sua Prova?" feature
CREATE TABLE public.prova_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL,
  content_type text NOT NULL,
  user_id uuid NOT NULL,
  vote boolean NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(content_id, user_id)
);

ALTER TABLE public.prova_votes ENABLE ROW LEVEL SECURITY;

-- Anyone can view votes (to calculate %)
CREATE POLICY "Anyone can view prova votes" ON public.prova_votes
  FOR SELECT TO anon, authenticated USING (true);

-- Authenticated users can insert their own vote
CREATE POLICY "Users can insert own vote" ON public.prova_votes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Users can update their own vote
CREATE POLICY "Users can update own vote" ON public.prova_votes
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
