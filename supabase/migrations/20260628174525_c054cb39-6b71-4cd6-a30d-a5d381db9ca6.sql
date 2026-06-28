REVOKE SELECT ON public.subscription_plans FROM anon;
GRANT SELECT (
  id, name, price, highlighted, features,
  service_revisoes, service_revisoes_qty,
  service_resumos, service_resumos_qty,
  service_simulados, service_simulados_qty,
  service_top_questoes, service_top_questoes_qty,
  service_colinhas, service_colinhas_qty,
  service_duvidas, service_duvidas_qty,
  service_aula_particular, service_aula_particular_qty,
  active, sort_order, created_at, updated_at,
  cancel_text, allow_free_cancel, min_commitment_days,
  min_usage_charge_pct
) ON public.subscription_plans TO anon;