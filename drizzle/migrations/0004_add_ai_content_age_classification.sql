ALTER TABLE public.ai_canonical_contents
  ADD COLUMN IF NOT EXISTS faixa_etaria text NOT NULL DEFAULT 'jovens_18_25'
    CHECK (faixa_etaria IN ('criancas_0_9', 'pre_adolescentes_10_13', 'adolescentes_14_17', 'jovens_18_25', 'adultos_26_45', 'adultos_46_mais')),
  ADD COLUMN IF NOT EXISTS confianca_faixa_etaria numeric(4,3) NOT NULL DEFAULT 0.500
    CHECK (confianca_faixa_etaria >= 0 AND confianca_faixa_etaria <= 1);

ALTER TABLE public.ai_revision_requests
  ADD COLUMN IF NOT EXISTS faixa_etaria text NOT NULL DEFAULT 'jovens_18_25'
    CHECK (faixa_etaria IN ('criancas_0_9', 'pre_adolescentes_10_13', 'adolescentes_14_17', 'jovens_18_25', 'adultos_26_45', 'adultos_46_mais')),
  ADD COLUMN IF NOT EXISTS confianca_faixa_etaria numeric(4,3) NOT NULL DEFAULT 0.500
    CHECK (confianca_faixa_etaria >= 0 AND confianca_faixa_etaria <= 1);

CREATE INDEX IF NOT EXISTS idx_ai_canonical_contents_faixa_etaria
  ON public.ai_canonical_contents (faixa_etaria, status, visibility);