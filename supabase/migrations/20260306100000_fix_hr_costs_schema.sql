
-- 1. Ensure uploaded_by exists in hr_costs
ALTER TABLE public.hr_costs 
  ADD COLUMN IF NOT EXISTS uploaded_by uuid;

-- 2. Add recurrence support columns to hr_costs
ALTER TABLE public.hr_costs
  ADD COLUMN IF NOT EXISTS tipo text DEFAULT 'extraordinario',
  ADD COLUMN IF NOT EXISTS frecuencia text,
  ADD COLUMN IF NOT EXISTS mes_inicio integer,
  ADD COLUMN IF NOT EXISTS mes_fin integer,
  ADD COLUMN IF NOT EXISTS categoria_ext text;

-- 3. Ensure no NULL descriptions exist before applying unique index logic
UPDATE public.hr_costs SET descripcion = '' WHERE descripcion IS NULL;

-- 4. De-duplicate: Keep only the latest entry for each (anio, mes, categoria, descripcion)
DELETE FROM public.hr_costs h1
USING public.hr_costs h2
WHERE h1.id < h2.id
  AND h1.anio = h2.anio
  AND h1.mes = h2.mes
  AND h1.categoria = h2.categoria
  AND COALESCE(h1.descripcion, '') = COALESCE(h2.descripcion, '');

-- 5. Enable RLS and set policies just in case they were missing
ALTER TABLE public.hr_costs ENABLE ROW LEVEL SECURITY;
