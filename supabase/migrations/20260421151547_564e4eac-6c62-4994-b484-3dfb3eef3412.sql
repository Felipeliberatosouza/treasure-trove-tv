-- Remove broad public SELECT policies that allow listing of all objects in public buckets.
-- Public URL access continues to work because the buckets remain public (served via the storage CDN endpoint, which does not consult RLS for public buckets).

DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view carousel covers" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view materials" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view platform assets" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Sales post thumbnails are publicly readable" ON storage.objects;

-- Scoped SELECT policies (only used for list/authenticated reads; public URLs bypass RLS for public buckets).

-- avatars: owners can list their own folder; admins can list all
CREATE POLICY "Avatar owners can list own files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can list avatars"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars' AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- carousel-covers: owner teacher or admin can list
CREATE POLICY "Teachers can list own carousel covers"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'carousel-covers'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can list carousel covers"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'carousel-covers' AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- materials: owner or admin can list
CREATE POLICY "Material owners can list own files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'materials'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can list materials"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'materials' AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- platform-assets: only admins can list (public URL still serves files)
CREATE POLICY "Admins can list platform assets"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'platform-assets' AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- thumbnails: teacher owner or admin
CREATE POLICY "Teachers can list own thumbnails"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'thumbnails'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can list thumbnails"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'thumbnails' AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- sales-post-thumbnails: owner teacher or admin
CREATE POLICY "Teachers can list own sales post thumbnails"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'sales-post-thumbnails'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can list sales post thumbnails"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'sales-post-thumbnails' AND public.has_role(auth.uid(), 'admin'::app_role)
);