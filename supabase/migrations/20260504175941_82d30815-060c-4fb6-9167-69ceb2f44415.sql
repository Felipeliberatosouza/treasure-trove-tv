
-- 1) Replace broad teacher profile policy with column-restricted access via view
DROP POLICY IF EXISTS "View teacher profile public fields" ON public.profiles;

-- Ensure the safe view runs as invoker so RLS on profiles still applies; grant select on view
ALTER VIEW IF EXISTS public.teacher_profiles_public SET (security_invoker = true);

-- Add a narrow column-restricted policy so the view (running as invoker) can read teacher rows.
-- Authenticated/anon callers can SELECT teacher rows but only the safe columns are exposed by the view.
-- We still need a SELECT policy that allows reading teacher rows; restrict via REVOKE on sensitive columns.
CREATE POLICY "Public can view teacher profile rows"
  ON public.profiles
  FOR SELECT
  TO anon, authenticated
  USING (is_teacher(user_id));

-- Revoke sensitive columns from anon/authenticated so even direct table SELECTs cannot read them
REVOKE SELECT (cpf, pix_key, address, phone, birth_date, email)
  ON public.profiles FROM anon, authenticated;

-- Re-grant safe columns to authenticated/anon explicitly
GRANT SELECT (
  user_id, name, avatar_url, bio, slug, expertise_area, profile_title,
  areas, experiences, education, content_order, active, created_at, updated_at,
  monthly_content_goal, referral_code, accepts_marketing, email_verified,
  phone_verified, id
) ON public.profiles TO anon, authenticated;

-- 2) Drop anon SELECT on video_ratings
DROP POLICY IF EXISTS "Anon can view ratings" ON public.video_ratings;

-- 3) Normalize legacy public-bucket video URLs in lessons to storage path format
UPDATE public.lessons
SET video_url = regexp_replace(video_url, '^https?://[^/]+/storage/v1/object/public/videos/', '')
WHERE video_url LIKE '%/storage/v1/object/public/videos/%';

UPDATE public.exam_solutions
SET video_url = regexp_replace(video_url, '^https?://[^/]+/storage/v1/object/public/videos/', '')
WHERE video_url LIKE '%/storage/v1/object/public/videos/%';
