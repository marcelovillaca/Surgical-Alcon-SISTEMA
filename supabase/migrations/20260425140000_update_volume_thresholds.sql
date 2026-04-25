-- ============================================================
-- MIGRATION: Update Volume Band Thresholds
-- Date: 2026-04-25
-- Description: Adjusts the monthly surgery volume thresholds
--   to match validated Paraguay market data:
--     Low    : < 15 cir/mês
--     Medium : 15 – 29 cir/mês
--     High   : ≥ 30 cir/mês  (previously > 30)
-- ============================================================

SET search_path TO public;

-- ============================================================
-- 1. Update get_volume_band() with new thresholds
-- ============================================================
CREATE OR REPLACE FUNCTION get_volume_band(monthly_volume int)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN monthly_volume >= 30 THEN 'high'    -- Alto:  ≥ 30 cir/mês
    WHEN monthly_volume >= 15 THEN 'medium'  -- Médio: 15–29 cir/mês
    ELSE                           'low'     -- Baixo: < 15 cir/mês
  END;
$$;

COMMENT ON FUNCTION get_volume_band IS
  'Classifies a doctor monthly surgical volume into a band.
   Thresholds (Paraguay market):
     high   : >= 30 cir/mês
     medium : 15–29 cir/mês
     low    : < 15 cir/mês';

-- ============================================================
-- 2. Update classify_client_segment() documentation comment
--    (logic unchanged — only volume threshold doc updated)
-- ============================================================
COMMENT ON FUNCTION classify_client_segment IS
  'Matrix 2×2: volume band × penetration band → segment.
   Volume  : high (>=30/mo) | medium (15-29/mo) | low (<15/mo)
   Penetr. : high (>=60%)   | low (<60%)
   Matrix  :
     low  vol + low  pen → check_in
     low  vol + high pen → protect
     med/high vol + low  pen → grow
     med/high vol + high pen → partner';

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
-- Changes:
--   UPDATED: get_volume_band()  — thresholds: high>=30, medium=15-29, low<15
--   UPDATED: classify_client_segment() — documentation comment only
-- No data was deleted or modified.
-- ============================================================
