-- ============================================================
-- MIGRATION: Client Automation (Auto-Code & Auto-Frequency)
-- Description: Generates client codes and sets visit frequency
-- ============================================================

SET search_path TO public;

-- 1. Create a sequence for Client Codes
CREATE SEQUENCE IF NOT EXISTS client_code_seq START 1;

-- 2. Function to handle client automation
CREATE OR REPLACE FUNCTION handle_client_automation()
RETURNS trigger AS $$
DECLARE
    v_next_val int;
    v_user_role text;
BEGIN
    -- A. AUTO-GENERATE CODE if not provided
    IF NEW.cod_cliente IS NULL OR NEW.cod_cliente = '' THEN
        SELECT nextval('client_code_seq') INTO v_next_val;
        NEW.cod_cliente := 'ALC-' || LPAD(v_next_val::text, 5, '0');
    END IF;

    -- B. AUTO-SET VISIT FREQUENCY based on segment
    -- Logic: partner/grow -> semanal, protect -> quincenal, check_in -> mensual
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.segment IS DISTINCT FROM NEW.segment) THEN
        NEW.visit_frequency := CASE
            WHEN NEW.segment = 'partner' THEN 'semanal'
            WHEN NEW.segment = 'grow'    THEN 'semanal'
            WHEN NEW.segment = 'protect' THEN 'quincenal'
            WHEN NEW.segment = 'check_in' THEN 'mensual'
            ELSE NEW.visit_frequency -- Keep current if unknown
        END;
    END IF;

    -- C. RESTRICT FREQUENCY OVERRIDE to Gerente only (on update)
    -- This is a soft check here, but we can enforce it strictly if needed.
    -- For now, if the segment hasn't changed but frequency has, we could revert if not manager.
    -- However, it's better to handle the "only manager can edit" in the UI for UX.

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create the Trigger
DROP TRIGGER IF EXISTS trg_client_automation ON public.clients;
CREATE TRIGGER trg_client_automation
BEFORE INSERT OR UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION handle_client_automation();
