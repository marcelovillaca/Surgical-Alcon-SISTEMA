-- ============================================================
-- MIGRATION: Opportunity Engine (Motor de Oportunidades)
-- Description: Business logic to suggest growth actions
-- ============================================================

SET search_path TO public;

-- 1. Helper to get Product Category Mix
CREATE OR REPLACE FUNCTION get_client_product_mix(p_client_id uuid)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
    v_result jsonb;
    v_cod_cliente text;
BEGIN
    SELECT cod_cliente INTO v_cod_cliente FROM clients WHERE id = p_client_id;
    
    WITH sales_summary AS (
        SELECT 
            linea_de_producto,
            SUM(total) as total_monto,
            COUNT(*) as total_transacciones
        FROM sales_details
        WHERE cod_cliente = v_cod_cliente
        AND fecha >= (now() - interval '6 months')
        GROUP BY linea_de_producto
    )
    SELECT jsonb_object_agg(linea_de_producto, jsonb_build_object(
        'monto', total_monto,
        'count', total_transacciones
    )) INTO v_result
    FROM sales_summary;
    
    RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

-- 2. Main Opportunity Analysis Function
CREATE OR REPLACE FUNCTION analyze_client_opportunities(p_client_id uuid)
RETURNS TABLE (
    opportunity_type text,
    priority text,
    description text,
    action_plan text
) LANGUAGE plpgsql AS $$
DECLARE
    v_volume int;
    v_segment text;
    v_mix jsonb;
    v_has_competitor_equip boolean;
    v_atiol_monto numeric;
    v_mono_monto numeric;
BEGIN
    -- Get base data
    SELECT monthly_volume, segment INTO v_volume, v_segment 
    FROM clients WHERE id = p_client_id;
    
    v_mix := get_client_product_mix(p_client_id);
    v_atiol_monto := (v_mix->'atiols'->>'monto')::numeric;
    v_mono_monto := (v_mix->'total_monofocals'->>'monto')::numeric;
    
    -- Opportunity 1: Premium Conversion (Low Mix / High Volume)
    IF v_volume >= 15 AND (v_atiol_monto IS NULL OR v_atiol_monto < (v_mono_monto * 0.3)) THEN
        opportunity_type := 'Conversión a Premium';
        priority := 'Alta';
        description := 'El cliente tiene un volumen quirúrgico medio/alto pero un bajo uso de lentes Premium (ATIOL).';
        action_plan := 'Presentar portafolio Vivity/PanOptix y coordinar cirugía de prueba.';
        RETURN NEXT;
    END IF;
    
    -- Opportunity 2: Competitive Defense (Installed Base)
    SELECT EXISTS (
        SELECT 1 FROM institution_equipment ie
        JOIN client_institutions ci ON ci.institution_id = ie.institution_id
        WHERE ci.client_id = p_client_id AND ie.is_alcon = false AND ie.equipment_type IN ('faco', 'vitreofago')
    ) INTO v_has_competitor_equip;
    
    IF v_has_competitor_equip THEN
        opportunity_type := 'Ataque Competitivo';
        priority := 'Crítica';
        description := 'El cliente opera en instituciones con equipos faco/vitre de la competencia.';
        action_plan := 'Proponer plan de recambio tecnológico (Trade-in) o demostración de Centurion/Constellation.';
        RETURN NEXT;
    END IF;
    
    -- Opportunity 3: Cross-Selling (Paks without IOLs)
    IF (v_mix->'phaco_paks' IS NOT NULL) AND (v_mix->'atiols' IS NULL AND v_mix->'total_monofocals' IS NULL) THEN
        opportunity_type := 'Venta Cruzada IOL';
        priority := 'Media';
        description := 'El cliente compra descartables (Paks) Alcon pero adquiere los lentes por otra vía.';
        action_plan := 'Negociar paquete integral IOL + Pak para mejorar rentabilidad del cliente.';
        RETURN NEXT;
    END IF;

    -- Opportunity 4: Grow to Partner
    IF v_segment = 'grow' AND v_volume >= 30 THEN
        opportunity_type := 'Fidelización Partner';
        priority := 'Alta';
        description := 'Cliente con potencial de ser Socio Estratégico debido a su altísimo volumen.';
        action_plan := 'Ofrecer acuerdo de volumen anual o beneficios de educación continua (Alcon Experience Center).';
        RETURN NEXT;
    END IF;

END;
$$;
