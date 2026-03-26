
-- Add mercado column to sales_details
ALTER TABLE public.sales_details ADD COLUMN IF NOT EXISTS mercado text DEFAULT 'Privado';

-- Create Conofta Targets table
CREATE TABLE IF NOT EXISTS public.conofta_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anio integer NOT NULL DEFAULT EXTRACT(YEAR FROM now()),
  enero numeric NOT NULL DEFAULT 0,
  febrero numeric NOT NULL DEFAULT 0,
  marzo numeric NOT NULL DEFAULT 0,
  abril numeric NOT NULL DEFAULT 0,
  mayo numeric NOT NULL DEFAULT 0,
  junio numeric NOT NULL DEFAULT 0,
  julio numeric NOT NULL DEFAULT 0,
  agosto numeric NOT NULL DEFAULT 0,
  septiembre numeric NOT NULL DEFAULT 0,
  octubre numeric NOT NULL DEFAULT 0,
  noviembre numeric NOT NULL DEFAULT 0,
  diciembre numeric NOT NULL DEFAULT 0,
  revenue_per_surgery numeric NOT NULL DEFAULT 0, -- Fix amount per surgery
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.conofta_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gerente can manage conofta_targets"
  ON public.conofta_targets FOR ALL
  USING (public.is_gerente());

CREATE POLICY "Authenticated can read conofta_targets"
  ON public.conofta_targets FOR SELECT
  USING (true);

-- Create Conofta Expenses table (for specific costs like honorarios, etc)
CREATE TABLE IF NOT EXISTS public.conofta_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anio integer NOT NULL,
  mes integer NOT NULL, -- 1-12
  categoria text NOT NULL, -- 'Honorarios', 'RH', 'Insumos Extra', 'Otros'
  monto numeric NOT NULL DEFAULT 0,
  descripcion text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.conofta_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gerente can manage conofta_expenses"
  ON public.conofta_expenses FOR ALL
  USING (public.is_gerente());

CREATE POLICY "Authenticated can read conofta_expenses"
  ON public.conofta_expenses FOR SELECT
  USING (true);
