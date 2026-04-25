-- ============================================================
-- MIGRATION: CONOFTA Product Traceability
-- Description: Adds auto-coding for CONOFTA products
-- ============================================================

SET search_path TO public;

-- 1. ADD COLUMN
ALTER TABLE public.conofta_products ADD COLUMN IF NOT EXISTS cod_producto text;

-- 2. CREATE SEQUENCE
CREATE SEQUENCE IF NOT EXISTS conofta_product_code_seq START 1;

-- 3. TRIGGER
CREATE OR REPLACE FUNCTION handle_conofta_product_automation()
RETURNS trigger AS $$
DECLARE
    v_next_val int;
BEGIN
    IF NEW.cod_producto IS NULL OR NEW.cod_producto = '' THEN
        SELECT nextval('conofta_product_code_seq') INTO v_next_val;
        NEW.cod_producto := 'CPD-' || LPAD(v_next_val::text, 5, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_conofta_product_automation ON public.conofta_products;
CREATE TRIGGER trg_conofta_product_automation
BEFORE INSERT OR UPDATE ON public.conofta_products
FOR EACH ROW EXECUTE FUNCTION handle_conofta_product_automation();

-- Initialize
UPDATE public.conofta_products SET cod_producto = 'CPD-' || LPAD(nextval('conofta_product_code_seq')::text, 5, '0') WHERE cod_producto IS NULL OR cod_producto = '';
