-- 1) Tabela de bloqueios por risco
CREATE TABLE IF NOT EXISTS public.user_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reason text NOT NULL,
  context text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  blocked_at timestamptz NOT NULL DEFAULT now(),
  blocked_until timestamptz NOT NULL,
  unblocked_at timestamptz,
  unblocked_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_blocks_user_active
  ON public.user_blocks (user_id, blocked_until DESC)
  WHERE unblocked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked_until
  ON public.user_blocks (blocked_until DESC);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

-- Service role: total
CREATE POLICY "Service role manages user_blocks"
  ON public.user_blocks
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Admins: leitura total e atualização (para desbloquear manualmente)
CREATE POLICY "Admins view all user_blocks"
  ON public.user_blocks
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update user_blocks"
  ON public.user_blocks
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Usuário consulta só o próprio bloqueio (cliente precisa para deslogar com aviso)
CREATE POLICY "Users view own active blocks"
  ON public.user_blocks
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 2) Função auxiliar (security definer) para checar bloqueio ativo
CREATE OR REPLACE FUNCTION public.is_user_blocked(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_blocks
    WHERE user_id = _user_id
      AND unblocked_at IS NULL
      AND blocked_until > now()
  )
$$;

-- 3) Configuração padrão da política em platform_settings
INSERT INTO public.platform_settings (key, value)
VALUES (
  'security_block_policy',
  jsonb_build_object(
    'enabled', true,
    'window_minutes', 1440,
    'threshold_count', 10,
    'block_duration_minutes', 1440,
    'tracked_actions', jsonb_build_array(
      'content_protection.devtools_opened',
      'content_protection.print_attempt',
      'content_protection.shortcut_blocked'
    )
  )
)
ON CONFLICT (key) DO NOTHING;