INSERT INTO public.platform_settings (key, value)
VALUES (
  'aula_particular_config',
  jsonb_build_object(
    'lesson_duration_minutes', 50,
    'free_cancel_window_hours', 3,
    'late_cancel_fee_type', 'percentage',
    'late_cancel_fee_value', 50,
    'fee_split_platform_pct', 30,
    'fee_split_teacher_pct', 70
  )
)
ON CONFLICT (key) DO NOTHING;