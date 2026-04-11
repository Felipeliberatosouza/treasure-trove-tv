
-- 1. Subscription plans table
CREATE TABLE public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  highlighted boolean NOT NULL DEFAULT false,
  features text[] NOT NULL DEFAULT '{}',
  service_revisoes boolean NOT NULL DEFAULT false,
  service_revisoes_qty integer NOT NULL DEFAULT 0,
  service_resumos boolean NOT NULL DEFAULT false,
  service_resumos_qty integer NOT NULL DEFAULT 0,
  service_simulados boolean NOT NULL DEFAULT false,
  service_simulados_qty integer NOT NULL DEFAULT 0,
  service_top_questoes boolean NOT NULL DEFAULT false,
  service_top_questoes_qty integer NOT NULL DEFAULT 0,
  service_colinhas boolean NOT NULL DEFAULT false,
  service_colinhas_qty integer NOT NULL DEFAULT 0,
  service_duvidas boolean NOT NULL DEFAULT false,
  service_duvidas_qty integer NOT NULL DEFAULT 0,
  service_aula_particular boolean NOT NULL DEFAULT false,
  service_aula_particular_qty integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active plans" ON public.subscription_plans
FOR SELECT TO anon, authenticated USING (active = true);

CREATE POLICY "Admins can manage plans" ON public.subscription_plans
FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 2. Student subscriptions
CREATE TABLE public.student_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id),
  status text NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  stripe_subscription_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.student_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions" ON public.student_subscriptions
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all subscriptions" ON public.student_subscriptions
FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own subscription" ON public.student_subscriptions
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- 3. Resource usage tracking
CREATE TABLE public.resource_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  resource_type text NOT NULL,
  content_id uuid,
  content_type text,
  subscription_id uuid REFERENCES public.student_subscriptions(id),
  accessed_at timestamptz NOT NULL DEFAULT now(),
  duration_seconds integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.resource_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage" ON public.resource_usage
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage" ON public.resource_usage
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all usage" ON public.resource_usage
FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_resource_usage_user ON public.resource_usage(user_id);
CREATE INDEX idx_resource_usage_type ON public.resource_usage(resource_type);
CREATE INDEX idx_resource_usage_sub ON public.resource_usage(subscription_id);

-- 4. Resource prices (individual purchase prices)
CREATE TABLE public.resource_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type text NOT NULL UNIQUE,
  price numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.resource_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view resource prices" ON public.resource_prices
FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Admins can manage resource prices" ON public.resource_prices
FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed default resource prices
INSERT INTO public.resource_prices (resource_type, price) VALUES
  ('revisoes', 9.90),
  ('resumos', 4.90),
  ('simulados', 7.90),
  ('top_questoes', 5.90),
  ('colinhas', 3.90),
  ('duvidas', 12.90),
  ('aula_particular', 49.90);

-- Triggers for updated_at
CREATE TRIGGER update_subscription_plans_updated_at
BEFORE UPDATE ON public.subscription_plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_student_subscriptions_updated_at
BEFORE UPDATE ON public.student_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_resource_prices_updated_at
BEFORE UPDATE ON public.resource_prices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
