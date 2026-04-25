-- ============================================================
-- MIGRATION: Fix CONOFTA Visibility & Separation
-- Description: Ensures active status and separates institutions
-- ============================================================

SET search_path TO public;

-- 1. FIX NULL ACTIVE VALUES (This is why lists were empty)
UPDATE public.clients SET active = true WHERE active IS NULL;
UPDATE public.conofta_surgeons SET active = true WHERE active IS NULL;
UPDATE public.conofta_products SET active = true WHERE active IS NULL;
UPDATE public.institutions SET active = true WHERE active IS NULL;

-- 2. CREATE SEPARATE TABLE FOR CONOFTA INSTITUTIONS (Sedes)
CREATE TABLE IF NOT EXISTS public.conofta_institutions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    city text,
    address text,
    cod_institucion text,
    active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES auth.users(id)
);

-- 3. MIGRATE DATA (Copy existing institutions to the new CONOFTA table)
-- We assume any institution currently linked to a surgeon is a CONOFTA sede
INSERT INTO public.conofta_institutions (name, city, address, cod_institucion, active, created_by)
SELECT name, city, address, cod_institucion, active, created_by
FROM public.institutions
ON CONFLICT DO NOTHING;

-- 4. UPDATE SURGEONS TO POINT TO NEW TABLE
-- We need to add a new column first
ALTER TABLE public.conofta_surgeons ADD COLUMN IF NOT EXISTS conofta_institution_id uuid REFERENCES public.conofta_institutions(id);

-- Map existing links
UPDATE public.conofta_surgeons s
SET conofta_institution_id = ci.id
FROM public.institutions i, public.conofta_institutions ci
WHERE s.institution_id = i.id AND i.name = ci.name;

-- 5. AUTO-CODE FOR CONOFTA INSTITUTIONS
CREATE SEQUENCE IF NOT EXISTS conofta_inst_code_seq START 1;

CREATE OR REPLACE FUNCTION handle_conofta_inst_automation()
RETURNS trigger AS $$
DECLARE
    v_next_val int;
BEGIN
    IF NEW.cod_institucion IS NULL OR NEW.cod_institucion = '' THEN
        SELECT nextval('conofta_inst_code_seq') INTO v_next_val;
        NEW.cod_institucion := 'CNS-' || LPAD(v_next_val::text, 5, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_conofta_inst_automation ON public.conofta_institutions;
CREATE TRIGGER trg_conofta_inst_automation
BEFORE INSERT OR UPDATE ON public.conofta_institutions
FOR EACH ROW EXECUTE FUNCTION handle_conofta_inst_automation();

UPDATE public.conofta_institutions SET cod_institucion = 'CNS-' || LPAD(nextval('conofta_inst_code_seq')::text, 5, '0') 
WHERE cod_institucion IS NULL OR cod_institucion = '';
