
-- Table for HR costs (salaries, charges, commissions) uploaded by gerente
CREATE TABLE public.hr_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anio integer NOT NULL DEFAULT EXTRACT(year FROM now()),
  mes integer NOT NULL CHECK (mes >= 1 AND mes <= 12),
  categoria text NOT NULL CHECK (categoria IN ('salarios', 'encargos', 'comisiones', 'alquiler', 'marketing', 'logistica', 'otros')),
  descripcion text,
  monto numeric NOT NULL DEFAULT 0,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(anio, mes, categoria, descripcion)
);

ALTER TABLE public.hr_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gerente can manage hr_costs" ON public.hr_costs FOR ALL USING (is_gerente());
CREATE POLICY "Authenticated can read hr_costs" ON public.hr_costs FOR SELECT USING (true);
