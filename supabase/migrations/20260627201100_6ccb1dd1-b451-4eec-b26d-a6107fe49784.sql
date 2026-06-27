DROP POLICY IF EXISTS "Public can view allowlisted platform settings" ON public.platform_settings;

CREATE POLICY "Public can view allowlisted platform settings"
ON public.platform_settings
FOR SELECT
TO anon, authenticated
USING (
  key = ANY (ARRAY[
    'branding',
    'contact',
    'footer',
    'about_us',
    'privacy_policy',
    'terms_of_use',
    'terms_of_use_students',
    'terms_of_use_teachers',
    'hero_banner',
    'hero_banner_student',
    'hero_banner_teacher',
    'secondary_banner',
    'secondary_banner_student',
    'secondary_banner_teacher',
    'teacher_banner',
    'featured_videos',
    'subscription_plans',
    'video_pricing',
    'free_trial',
    'retention_coupon',
    'aula_particular_config',
    'product_config',
    'doubt_messages_limits',
    'doubt_response_deadline_days',
    'teacher_contract_template',
    'teacher_content_goal',
    'alert_box'
  ])
);