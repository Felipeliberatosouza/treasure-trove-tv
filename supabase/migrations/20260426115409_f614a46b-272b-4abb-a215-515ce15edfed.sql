-- Add content_order column to profiles (ordered list of content UUIDs as text)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS content_order jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Update approval trigger to also apply content_order changes
CREATE OR REPLACE FUNCTION public.apply_teacher_profile_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    UPDATE public.profiles
       SET name            = COALESCE(NEW.proposed->>'name', name),
           profile_title   = COALESCE(NEW.proposed->>'profile_title', profile_title),
           expertise_area  = COALESCE(NEW.proposed->>'expertise_area', expertise_area),
           bio             = COALESCE(NEW.proposed->>'bio', bio),
           avatar_url      = COALESCE(NEW.proposed->>'avatar_url', avatar_url),
           experiences     = COALESCE(NEW.proposed->'experiences', experiences),
           education       = COALESCE(NEW.proposed->'education', education),
           content_order   = COALESCE(NEW.proposed->'content_order', content_order),
           updated_at      = now()
     WHERE user_id = NEW.teacher_id;
    NEW.reviewed_at = now();
  END IF;
  RETURN NEW;
END;
$$;