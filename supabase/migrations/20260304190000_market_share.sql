-- Market share reference data: total market surgeries/lenses per period
CREATE TABLE IF NOT EXISTS public.market_share_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anio integer NOT NULL,
  mes integer NOT NULL, -- 1-12, or 0 = annual total
  total_cirurgias_pais integer DEFAULT 0,       -- Total surgeries in the country
  total_monofocals_mercado integer DEFAULT 0,   -- Total monofocal lenses market
  total_atiols_mercado integer DEFAULT 0,       -- Total ATIOL lenses market
  target_share_monofocal numeric DEFAULT 0,     -- Target market share % monofocal
  target_share_atiol numeric DEFAULT 0,         -- Target market share % ATIOL
  fuente text,                                  -- Data source (SUCEV, IMS, etc.)
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add unique constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'market_share_data_anio_mes_key'
      AND conrelid = 'public.market_share_data'::regclass
  ) THEN
    ALTER TABLE public.market_share_data ADD CONSTRAINT market_share_data_anio_mes_key UNIQUE (anio, mes);
  END IF;
END $$;

ALTER TABLE public.market_share_data ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.market_share_data TO authenticated;
GRANT ALL ON public.market_share_data TO service_role;

-- Drop existing policies before recreating (idempotent)
DROP POLICY IF EXISTS "Gerente can manage market_share_data" ON public.market_share_data;
DROP POLICY IF EXISTS "Authenticated can read market_share_data" ON public.market_share_data;

CREATE POLICY "Gerente can manage market_share_data"
  ON public.market_share_data FOR ALL USING (public.is_gerente());

CREATE POLICY "Authenticated can read market_share_data"
  ON public.market_share_data FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_market_share_anio ON public.market_share_data(anio);
