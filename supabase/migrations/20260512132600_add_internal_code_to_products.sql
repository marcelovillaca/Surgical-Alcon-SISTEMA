-- Migration to add internal_code and handle auto-generation
ALTER TABLE "public"."products" ADD COLUMN IF NOT EXISTS "internal_code" TEXT UNIQUE;

CREATE SEQUENCE IF NOT EXISTS internal_product_code_seq START 1;

CREATE OR REPLACE FUNCTION handle_product_internal_code()
RETURNS trigger AS $$
DECLARE
    v_next_val int;
BEGIN
    IF NEW.internal_code IS NULL OR NEW.internal_code = '' THEN
        SELECT nextval('internal_product_code_seq') INTO v_next_val;
        NEW.internal_code := 'PRD-' || LPAD(v_next_val::text, 5, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_product_internal_code ON public.products;
CREATE TRIGGER trg_product_internal_code
BEFORE INSERT ON public.products
FOR EACH ROW EXECUTE FUNCTION handle_product_internal_code();

-- Initialize existing products that don't have internal_code
UPDATE public.products SET internal_code = 'PRD-' || LPAD(nextval('internal_product_code_seq')::text, 5, '0') 
WHERE internal_code IS NULL OR internal_code = '';
