DROP POLICY IF EXISTS "Restrict file types on upload" ON storage.objects;
DROP POLICY IF EXISTS "Restrict file types on update" ON storage.objects;
CREATE POLICY "Restrict file types on upload"
ON storage.objects AS RESTRICTIVE FOR INSERT TO anon, authenticated
WITH CHECK (
  CASE bucket_id
    WHEN 'avatars' THEN lower(storage.extension(name)) IN ('jpg','jpeg','png','webp','gif')
    WHEN 'thumbnails' THEN lower(storage.extension(name)) IN ('jpg','jpeg','png','webp','gif','vtt')
    WHEN 'carousel-covers' THEN lower(storage.extension(name)) IN ('jpg','jpeg','png','webp','gif')
    WHEN 'sales-post-thumbnails' THEN lower(storage.extension(name)) IN ('jpg','jpeg','png','webp','gif')
    WHEN 'platform-assets' THEN lower(storage.extension(name)) IN ('jpg','jpeg','png','webp','gif','ico','svg')
    WHEN 'support-attachments' THEN lower(storage.extension(name)) IN ('jpg','jpeg','png','webp','gif','pdf','txt','mp4','webm')
    WHEN 'videos' THEN lower(storage.extension(name)) IN ('mp4','webm','mov','m4v','vtt')
    WHEN 'cancellation-receipts' THEN lower(storage.extension(name)) = 'pdf'
    ELSE true
  END
);
CREATE POLICY "Restrict file types on update"
ON storage.objects AS RESTRICTIVE FOR UPDATE TO anon, authenticated
WITH CHECK (
  CASE bucket_id
    WHEN 'avatars' THEN lower(storage.extension(name)) IN ('jpg','jpeg','png','webp','gif')
    WHEN 'thumbnails' THEN lower(storage.extension(name)) IN ('jpg','jpeg','png','webp','gif','vtt')
    WHEN 'carousel-covers' THEN lower(storage.extension(name)) IN ('jpg','jpeg','png','webp','gif')
    WHEN 'sales-post-thumbnails' THEN lower(storage.extension(name)) IN ('jpg','jpeg','png','webp','gif')
    WHEN 'platform-assets' THEN lower(storage.extension(name)) IN ('jpg','jpeg','png','webp','gif','ico','svg')
    WHEN 'support-attachments' THEN lower(storage.extension(name)) IN ('jpg','jpeg','png','webp','gif','pdf','txt','mp4','webm')
    WHEN 'videos' THEN lower(storage.extension(name)) IN ('mp4','webm','mov','m4v','vtt')
    WHEN 'cancellation-receipts' THEN lower(storage.extension(name)) = 'pdf'
    ELSE true
  END
);