-- ============================================================
-- MIGRATION: Volume Drop Alerts Trigger
-- Description: Automatically detects volume drops > 20%
-- ============================================================

SET search_path TO public;

-- 1. Function to detect volume drops and log alerts
CREATE OR REPLACE FUNCTION detect_volume_drop_alert()
RETURNS trigger AS $$
DECLARE
    v_drop_pct numeric;
    v_client_name text;
    v_inst_name text;
BEGIN
    -- Only act if volume decreased significantly
    IF (OLD.monthly_volume IS NOT NULL AND NEW.monthly_volume < OLD.monthly_volume) THEN
        
        -- Calculate percentage drop: (old - new) / old
        v_drop_pct := ((OLD.monthly_volume - NEW.monthly_volume)::numeric / OLD.monthly_volume::numeric) * 100;
        
        -- Threshold: 20% drop
        IF v_drop_pct >= 20 THEN
            
            SELECT name INTO v_client_name FROM clients WHERE id = NEW.client_id;
            SELECT name INTO v_inst_name FROM institutions WHERE id = NEW.institution_id;
            
            INSERT INTO public.client_volume_alerts (
                client_id,
                institution_id,
                old_volume,
                new_volume,
                drop_pct,
                alert_type,
                status
            ) VALUES (
                NEW.client_id,
                NEW.institution_id,
                OLD.monthly_volume,
                NEW.monthly_volume,
                v_drop_pct,
                'critical_drop',
                'pending'
            );
            
            -- We could also update the client intelligence suggest action here
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Create the Trigger
DROP TRIGGER IF EXISTS trg_volume_drop_alert ON public.client_institutions;
CREATE TRIGGER trg_volume_drop_alert
AFTER UPDATE OF monthly_volume ON public.client_institutions
FOR EACH ROW
EXECUTE FUNCTION detect_volume_drop_alert();
