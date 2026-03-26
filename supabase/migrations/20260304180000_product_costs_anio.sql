-- Add anio (year) column to conofta_product_costs to support yearly cost versioning
ALTER TABLE public.conofta_product_costs
  ADD COLUMN IF NOT EXISTS anio integer NOT NULL DEFAULT EXTRACT(YEAR FROM now());

-- Drop old unique constraint on (item_name, sucursal) and recreate with anio
ALTER TABLE public.conofta_product_costs
  DROP CONSTRAINT IF EXISTS conofta_product_costs_item_name_sucursal_key;

ALTER TABLE public.conofta_product_costs
  ADD CONSTRAINT conofta_product_costs_item_name_sucursal_anio_key
  UNIQUE (item_name, sucursal, anio);

-- Index for fast year-based lookups
CREATE INDEX IF NOT EXISTS idx_product_costs_anio ON public.conofta_product_costs(anio);
