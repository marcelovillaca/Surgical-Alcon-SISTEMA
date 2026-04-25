-- ============================================================
-- MIGRATION: Product Auto-Coding & Soft Delete Support
-- Description: Adds SKU automation and ensures data safety
-- ============================================================

SET search_path TO public;

-- 1. PRODUCT AUTO-SKU
CREATE SEQUENCE IF NOT EXISTS product_code_seq START 1;

CREATE OR REPLACE FUNCTION handle_product_automation()
RETURNS trigger AS $$
DECLARE
    v_next_val int;
BEGIN
    IF NEW.sku IS NULL OR NEW.sku = '' THEN
        SELECT nextval('product_code_seq') INTO v_next_val;
        NEW.sku := 'PRD-' || LPAD(v_next_val::text, 5, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_product_automation ON public.products;
CREATE TRIGGER trg_product_automation
BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION handle_product_automation();

-- Initialize existing products
UPDATE public.products SET sku = 'PRD-' || LPAD(nextval('product_code_seq')::text, 5, '0') WHERE sku IS NULL OR sku = '';

-- 2. ADD ACTIVE COLUMN TO CORE TABLES (for Soft Delete)
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;
-- products already has active column (checked in types.ts)
ALTER TABLE public.conofta_surgeons ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;

-- 3. ENSURE CONOFTA WAITLIST HAS CASCADE DELETE for cleanup of drafts if needed
-- Actually, let's keep it restricted but allow soft-delete in UI.
