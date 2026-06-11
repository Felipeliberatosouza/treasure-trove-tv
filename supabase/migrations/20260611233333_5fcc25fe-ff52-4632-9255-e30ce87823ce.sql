-- Public buckets serve files via the unauthenticated /object/public/<bucket>/<path>
-- endpoint, which does NOT consult storage.objects RLS. The broad SELECT policies
-- below only enabled the SDK's `.list()` API to enumerate every file, which is
-- the issue flagged by the linter. Owner/admin list policies remain in place.
DROP POLICY IF EXISTS "Public can read carousel covers" ON storage.objects;
DROP POLICY IF EXISTS "Public can read thumbnails" ON storage.objects;