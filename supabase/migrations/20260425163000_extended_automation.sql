-- ============================================================
-- MIGRATION: Extended Auto-Coding (Institutions & Surgeons)
-- Description: Adds automatic code generation for CONOFTA
-- ============================================================

SET search_path TO public;

-- 1. ADD COLUMNS
ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS cod_institucion text;
ALTER TABLE public.conofta_surgeons ADD COLUMN IF NOT EXISTS cod_cirujano text;

-- 2. CREATE SEQUENCES
CREATE SEQUENCE IF NOT EXISTS institution_code_seq START 1;
CREATE SEQUENCE IF NOT EXISTS surgeon_code_seq START 1;

-- 3. TRIGGER FOR INSTITUTIONS
CREATE OR REPLACE FUNCTION handle_institution_automation()
RETURNS trigger AS $$
DECLARE
    v_next_val int;
BEGIN
    IF NEW.cod_institucion IS NULL OR NEW.cod_institucion = '' THEN
        SELECT nextval('institution_code_seq') INTO v_next_val;
        NEW.cod_institucion := 'INS-' || LPAD(v_next_val::text, 5, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_institution_automation ON public.institutions;
CREATE TRIGGER trg_institution_automation
BEFORE INSERT OR UPDATE ON public.institutions
FOR EACH ROW EXECUTE FUNCTION handle_institution_automation();

-- 4. TRIGGER FOR SURGEONS
CREATE OR REPLACE FUNCTION handle_surgeon_automation()
RETURNS trigger AS $$
DECLARE
    v_next_val int;
BEGIN
    IF NEW.cod_cirujano IS NULL OR NEW.cod_cirujano = '' THEN
        SELECT nextval('surgeon_code_seq') INTO v_next_val;
        NEW.cod_cirujano := 'SUR-' || LPAD(v_next_val::text, 5, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_surgeon_automation ON public.conofta_surgeons;
CREATE TRIGGER trg_surgeon_automation
BEFORE INSERT OR UPDATE ON public.conofta_surgeons
FOR EACH ROW EXECUTE FUNCTION handle_surgeon_automation();

-- 5. INITIALIZE CODES FOR EXISTING DATA
UPDATE public.institutions SET cod_institucion = 'INS-' || LPAD(nextval('institution_code_seq')::text, 5, '0') WHERE cod_institucion IS NULL;
UPDATE public.conofta_surgeons SET cod_cirujano = 'SUR-' || LPAD(nextval('surgeon_code_seq')::text, 5, '0') WHERE cod_cirujano IS NULL;
