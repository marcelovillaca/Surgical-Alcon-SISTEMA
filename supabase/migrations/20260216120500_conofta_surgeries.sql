-- Create Conofta Surgeries table for tracking patient-level detail
CREATE TABLE IF NOT EXISTS public.conofta_surgeries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jornada_id text NOT NULL,
  fecha date NOT NULL,
  paciente text,
  producto_sku text,
  producto_nombre text,
  cantidad numeric DEFAULT 1,
  costo_unitario numeric DEFAULT 0,
  tipo_costo text DEFAULT 'directo', -- 'directo' (per patient lens) or 'indirecto' (shared for jornada)
  honorarios numeric DEFAULT 0,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.conofta_surgeries ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON public.conofta_surgeries TO authenticated;
GRANT ALL ON public.conofta_surgeries TO service_role;

-- Policies
CREATE POLICY "Gerente can manage conofta_surgeries"
  ON public.conofta_surgeries FOR ALL
  USING (public.is_gerente());

CREATE POLICY "Authenticated can read conofta_surgeries"
  ON public.conofta_surgeries FOR SELECT
  USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_conofta_surgeries_jornada ON public.conofta_surgeries(jornada_id);
CREATE INDEX IF NOT EXISTS idx_conofta_surgeries_fecha ON public.conofta_surgeries(fecha);
