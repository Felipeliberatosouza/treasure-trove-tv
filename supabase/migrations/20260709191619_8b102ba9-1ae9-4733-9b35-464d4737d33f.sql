update platform_settings
set value = value || jsonb_build_object('favicon_url','https://uzhajthlokwglujtgmgm.supabase.co/storage/v1/object/public/platform-assets/branding/favicon-default.png')
where key='branding';