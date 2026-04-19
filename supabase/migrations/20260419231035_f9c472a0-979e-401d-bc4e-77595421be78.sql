CREATE TABLE public.recompute_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  triggered_by UUID NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  teacher_id UUID NULL,
  dry_run BOOLEAN NOT NULL DEFAULT false,
  purchases_processed INTEGER NOT NULL DEFAULT 0,
  purchases_skipped INTEGER NOT NULL DEFAULT 0,
  buckets_count INTEGER NOT NULL DEFAULT 0,
  inserted_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  skipped_paid_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'success',
  error_message TEXT NULL,
  results JSONB NOT NULL DEFAULT '[]'::jsonb,
  duration_ms INTEGER NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.recompute_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view recompute runs"
ON public.recompute_runs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can insert recompute runs"
ON public.recompute_runs
FOR INSERT
TO public
WITH CHECK (auth.role() = 'service_role');

CREATE INDEX idx_recompute_runs_created_at ON public.recompute_runs (created_at DESC);
CREATE INDEX idx_recompute_runs_teacher_id ON public.recompute_runs (teacher_id);