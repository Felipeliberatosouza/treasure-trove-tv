INSERT INTO public.platform_settings (key, value)
VALUES (
  'alert_box',
  jsonb_build_object(
    'bg_color', '#CA8A04',
    'border_color', '#CA8A04',
    'title_color', '#FFFFFF',
    'item_color', '#F87171'
  )
)
ON CONFLICT (key) DO NOTHING;