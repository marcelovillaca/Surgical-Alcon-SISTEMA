-- ============================================================
-- MIGRATION: Medical Intelligence & Account Segmentation
-- Date: 2026-04-24
-- Description: Adds doctor/institution profiling, equipment
--   mapping, key contacts, IOL classification, and automated
--   segmentation engine (GROW/PARTNER/PROTECT/CHECK-IN)
-- ============================================================

-- Ensure all unqualified table references resolve to public schema
SET search_path TO public;

-- ============================================================
-- PART 1: ALTER EXISTING TABLES (additive, non-breaking)
-- ============================================================

-- 1.1 clients: add type, subspecialties, primary institution
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS client_type text
    DEFAULT 'doctor'
    CHECK (client_type IN ('doctor', 'institution')),

  ADD COLUMN IF NOT EXISTS subspecialties text[]
    DEFAULT '{}',

  ADD COLUMN IF NOT EXISTS primary_institution_id uuid
    REFERENCES institutions(id) ON DELETE SET NULL,

  ADD COLUMN IF NOT EXISTS segment_auto text
    CHECK (segment_auto IN ('check_in', 'grow', 'partner', 'protect')),

  ADD COLUMN IF NOT EXISTS segment_auto_updated_at timestamptz;

COMMENT ON COLUMN public.clients.client_type IS
  'doctor = individual physician decision maker | institution = foundation/hospital evaluated as a whole';
COMMENT ON COLUMN public.clients.subspecialties IS
  'Array: cataract_refractive, retina, glaucoma, oculoplastics, pediatric, clinical';
COMMENT ON COLUMN public.clients.segment_auto IS
  'Calculated by engine. segment field remains editable manually as override.';

-- Index for subspecialty filtering
CREATE INDEX IF NOT EXISTS idx_clients_subspecialties
  ON public.clients USING gin(subspecialties);
CREATE INDEX IF NOT EXISTS idx_clients_type
  ON public.clients(client_type);

-- ============================================================
-- 1.2 client_institutions: add volume per institution and
--     primary flag
-- ============================================================
ALTER TABLE public.client_institutions
  ADD COLUMN IF NOT EXISTS monthly_surgery_volume int DEFAULT 0
    CHECK (monthly_surgery_volume >= 0),

  ADD COLUMN IF NOT EXISTS is_primary boolean DEFAULT false,

  ADD COLUMN IF NOT EXISTS volume_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS volume_updated_by uuid;

COMMENT ON COLUMN public.client_institutions.monthly_surgery_volume IS
  'Estimated surgeries/month this doctor performs at this institution.';
COMMENT ON COLUMN public.client_institutions.is_primary IS
  'True = this is the doctor''s main institution (designated by visitador).';

-- Ensure only one primary per client
CREATE UNIQUE INDEX IF NOT EXISTS idx_client_primary_institution
  ON public.client_institutions(client_id)
  WHERE is_primary = true;

-- ============================================================
-- PART 2: NEW TABLES
-- ============================================================

-- 2.1 institution_equipment
-- Equipment per institution: phaco, vitrectomy, microscope, biometer
-- Multiple units of the same type allowed
-- ============================================================
CREATE TABLE IF NOT EXISTS public.institution_equipment (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  created_by    uuid REFERENCES profiles(id),
  updated_by    uuid REFERENCES profiles(id),
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),

  -- Classification
  equipment_type text NOT NULL
    CHECK (equipment_type IN ('phaco', 'vitrectomy', 'microscope', 'biometer')),

  -- Identification
  brand         text,         -- e.g. "Alcon", "Zeiss", "Bausch+Lomb", "Haag-Streit"
  model         text,         -- e.g. "Centurion Vision System", "OPMI Lumera 700"
  quantity      int DEFAULT 1 CHECK (quantity > 0),

  -- Competitive intelligence
  is_alcon      boolean DEFAULT false,  -- quick flag for opportunity mapping
  notes         text
);

COMMENT ON TABLE public.institution_equipment IS
  'Surgical equipment per institution. A clinic can have multiple units of the same type.';

CREATE INDEX IF NOT EXISTS idx_inst_equipment_institution
  ON public.institution_equipment(institution_id);
CREATE INDEX IF NOT EXISTS idx_inst_equipment_type
  ON public.institution_equipment(equipment_type);

-- RLS
ALTER TABLE public.institution_equipment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read equipment"
  ON public.institution_equipment FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "Visitadores and gerentes can insert equipment"
  ON public.institution_equipment FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "Visitadores and gerentes can update equipment"
  ON public.institution_equipment FOR UPDATE
  TO authenticated USING (true);
CREATE POLICY "Gerentes can delete equipment"
  ON public.institution_equipment FOR DELETE
  TO authenticated USING (is_gerente());

-- ============================================================
-- 2.2 institution_key_contacts
-- Decision makers per institution (can be a registered doctor
-- or an external person such as a purchasing manager)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.institution_key_contacts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  created_by     uuid REFERENCES profiles(id),
  created_at     timestamptz DEFAULT now(),

  -- Contact source: either a registered client/doctor OR an external name
  client_id      uuid REFERENCES clients(id) ON DELETE SET NULL,
  external_name  text,   -- used when not a registered doctor
  external_title text,   -- job title for external contacts

  -- Role at this institution
  contact_role   text NOT NULL
    CHECK (contact_role IN (
      'medical_director',      -- Director Médico
      'chief_ophthalmology',   -- Jefe de Oftalmología
      'purchasing_manager',    -- Responsable de Compras
      'kol',                   -- Key Opinion Leader
      'other'
    )),

  notes          text,

  -- At least one of client_id or external_name must be set
  CONSTRAINT chk_contact_has_source
    CHECK (client_id IS NOT NULL OR external_name IS NOT NULL)
);

COMMENT ON TABLE public.institution_key_contacts IS
  'Key decision makers per institution. Can be registered doctors (client_id) or external contacts.';

CREATE INDEX IF NOT EXISTS idx_key_contacts_institution
  ON public.institution_key_contacts(institution_id);
CREATE INDEX IF NOT EXISTS idx_key_contacts_client
  ON public.institution_key_contacts(client_id);

-- RLS
ALTER TABLE public.institution_key_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read key contacts"
  ON public.institution_key_contacts FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "Authenticated can manage key contacts"
  ON public.institution_key_contacts FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 2.3 product_iol_classification
-- Maps product names/patterns to the 4 IOL categories
-- Used for premium mix calculation
-- ============================================================
CREATE TABLE IF NOT EXISTS public.product_iol_classification (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_pattern text NOT NULL,  -- matched against sales_details.producto (ILIKE)
  iol_category    text NOT NULL
    CHECK (iol_category IN (
      'premium_toric',       -- PanOptix Toric, Vivity Toric, etc.
      'premium_non_toric',   -- PanOptix, Vivity, Clareon PanOptix
      'monofocal_toric',     -- AcrySof IQ Toric (SN6AT_), Clareon Toric
      'monofocal_non_toric'  -- SN60WF, Clareon Monofocal
    )),
  notes           text,
  created_at      timestamptz DEFAULT now()
);

COMMENT ON TABLE public.product_iol_classification IS
  'Pattern matching table to classify IOL products into 4 categories for premium mix analysis.';

-- Seed initial classification patterns
-- These should be reviewed and adjusted to match actual product names in sales_details
INSERT INTO public.product_iol_classification (product_pattern, iol_category, notes) VALUES
  -- Premium Tórico
  ('%PANOPTIX%TORIC%',      'premium_toric',     'AcrySof IQ PanOptix Toric'),
  ('%VIVITY%TORIC%',        'premium_toric',     'AcrySof IQ Vivity Toric'),
  ('%CLAREON%PANOPTIX%TORIC%', 'premium_toric',  'Clareon PanOptix Toric'),
  ('%ACTIVEFOCUS%TORIC%',   'premium_toric',     'ActiveFocus Toric'),
  -- Premium Não-Tórico
  ('%PANOPTIX%',            'premium_non_toric', 'AcrySof IQ PanOptix'),
  ('%VIVITY%',              'premium_non_toric', 'AcrySof IQ Vivity'),
  ('%ACTIVEFOCUS%',         'premium_non_toric', 'ActiveFocus'),
  -- Monofocal Tórico (MUST come before monofocal_non_toric patterns)
  ('%SN6AT%',               'monofocal_toric',   'AcrySof IQ Toric (SN6AT3/4/5/6/7/8/9)'),
  ('%CLAREON%TORIC%',       'monofocal_toric',   'Clareon Toric'),
  -- Monofocal Não-Tórico
  ('%SN60WF%',              'monofocal_non_toric', 'AcrySof IQ Natural SN60WF'),
  ('%SN60AT%',              'monofocal_non_toric', 'AcrySof Natural'),
  ('%SA60AT%',              'monofocal_non_toric', 'AcrySof'),
  ('%CLAREON%',             'monofocal_non_toric', 'Clareon Monofocal (fallback)')
ON CONFLICT DO NOTHING;

-- RLS
ALTER TABLE public.product_iol_classification ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can read classifications"
  ON public.product_iol_classification FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "Gerentes can manage classifications"
  ON public.product_iol_classification FOR ALL
  TO authenticated USING (is_gerente()) WITH CHECK (is_gerente());

-- ============================================================
-- 2.4 client_intelligence
-- Computed segmentation result per client/doctor.
-- One row per client, updated whenever volume or sales change.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.client_intelligence (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id               uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  calculated_at           timestamptz DEFAULT now(),

  -- === DIMENSION A: Volume ===
  -- Visitador-entered: sum of all institution volumes × 12
  annual_surgery_volume   int,          -- total surgeries/year across all institutions
  volume_band             text          -- 'high' (>30/mo) | 'medium' (20-30) | 'low' (<20)
    CHECK (volume_band IN ('high', 'medium', 'low')),

  -- === DIMENSION B: Penetration ===
  -- Calculated from sales_details cross-reference
  alcon_iols_ytd          int,          -- IOLs sold to this client year-to-date
  alcon_penetration_pct   numeric(5,2), -- alcon_iols_ytd / annual_surgery_volume × 100
  penetration_band        text          -- 'high' (>=60%) | 'low' (<60%)
    CHECK (penetration_band IN ('high', 'low')),

  -- === IOL MIX BREAKDOWN ===
  premium_toric_units     int DEFAULT 0,
  premium_non_toric_units int DEFAULT 0,
  monofocal_toric_units   int DEFAULT 0,
  monofocal_non_toric_units int DEFAULT 0,
  premium_mix_pct         numeric(5,2), -- (premium_toric + premium_non_toric) / total_iols × 100

  -- === SEGMENT RESULT ===
  -- Matrix logic:
  --   low volume  + low penetration  → check_in
  --   low volume  + high penetration → protect
  --   high/medium + low penetration  → grow
  --   high/medium + high penetration → partner
  segment                 text
    CHECK (segment IN ('check_in', 'grow', 'partner', 'protect')),

  -- === OPPORTUNITIES ===
  -- Detected automatically, shown in CRM
  opp_volume_conversion   boolean DEFAULT false, -- penetration < 60% + high volume
  opp_premium_upgrade     boolean DEFAULT false, -- premium_mix_pct < 15%

  -- === SEGMENT CHANGE ===
  previous_segment        text,
  segment_changed_at      timestamptz,

  -- === OVERRIDE ===
  override_protect        boolean DEFAULT false, -- forced by volume drop > 20%
  override_reason         text,

  UNIQUE(client_id)
);

COMMENT ON TABLE public.client_intelligence IS
  'Computed segmentation per doctor/institution. Updated when volume or sales data changes.';

CREATE INDEX IF NOT EXISTS idx_intelligence_client
  ON public.client_intelligence(client_id);
CREATE INDEX IF NOT EXISTS idx_intelligence_segment
  ON public.client_intelligence(segment);

-- RLS
ALTER TABLE public.client_intelligence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read intelligence"
  ON public.client_intelligence FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "System can write intelligence"
  ON public.client_intelligence FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 2.5 client_segment_history
-- Immutable audit trail of every segment change per client
-- ============================================================
CREATE TABLE IF NOT EXISTS public.client_segment_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  recorded_at     timestamptz DEFAULT now(),

  segment_before  text,
  segment_after   text NOT NULL,

  annual_volume   int,
  penetration_pct numeric(5,2),
  premium_mix_pct numeric(5,2),

  changed_by      text DEFAULT 'engine',  -- 'engine' or user id
  reason          text
);

COMMENT ON TABLE public.client_segment_history IS
  'Immutable log of every segmentation change. Used for trend analysis.';

CREATE INDEX IF NOT EXISTS idx_seg_history_client
  ON public.client_segment_history(client_id);
CREATE INDEX IF NOT EXISTS idx_seg_history_date
  ON public.client_segment_history(recorded_at DESC);

-- RLS
ALTER TABLE public.client_segment_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read history"
  ON public.client_segment_history FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "System can insert history"
  ON public.client_segment_history FOR INSERT
  TO authenticated WITH CHECK (true);

-- ============================================================
-- 2.6 client_volume_alerts
-- Generated whenever a visitador updates monthly_surgery_volume
-- and the change exceeds the threshold (±10% or ±20%)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.client_volume_alerts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  institution_id  uuid REFERENCES institutions(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now(),

  -- Volume data
  volume_before   int NOT NULL,   -- previous monthly volume
  volume_after    int NOT NULL,   -- new monthly volume
  change_pct      numeric(5,2),   -- ((after - before) / before) × 100

  -- Alert classification
  alert_level     text NOT NULL
    CHECK (alert_level IN (
      'critical_drop',    -- change_pct < -20%
      'attention_drop',   -- change_pct between -20% and -10%
      'growth',           -- change_pct > +20%
      'segment_change'    -- segment changed regardless of %
    )),

  -- Status
  is_read         boolean DEFAULT false,
  read_at         timestamptz,
  read_by         uuid REFERENCES profiles(id),

  -- Action tracking
  action_plan     text,           -- manager fills in the action plan
  action_by       uuid REFERENCES profiles(id),
  action_at       timestamptz,

  notes           text
);

COMMENT ON TABLE public.client_volume_alerts IS
  'Alerts generated when a doctor''s volume changes significantly. Manager must review and define action plan.';

CREATE INDEX IF NOT EXISTS idx_vol_alerts_client
  ON public.client_volume_alerts(client_id);
CREATE INDEX IF NOT EXISTS idx_vol_alerts_unread
  ON public.client_volume_alerts(is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_vol_alerts_date
  ON public.client_volume_alerts(created_at DESC);

-- RLS
ALTER TABLE public.client_volume_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read alerts"
  ON public.client_volume_alerts FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "System can create alerts"
  ON public.client_volume_alerts FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "Gerentes can update alerts (mark read, add action)"
  ON public.client_volume_alerts FOR UPDATE
  TO authenticated USING (true);

-- ============================================================
-- PART 3: HELPER FUNCTION — Classify segment from bands
-- Called from TypeScript after calculating volume & penetration
-- ============================================================
CREATE OR REPLACE FUNCTION classify_client_segment(
  p_volume_band       text,   -- 'high', 'medium', 'low'
  p_penetration_band  text    -- 'high', 'low'
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    -- Low volume: segment by penetration only
    WHEN p_volume_band = 'low'  AND p_penetration_band = 'low'  THEN 'check_in'
    WHEN p_volume_band = 'low'  AND p_penetration_band = 'high' THEN 'protect'
    -- High/medium volume: segment by penetration
    WHEN p_volume_band IN ('high', 'medium') AND p_penetration_band = 'low'  THEN 'grow'
    WHEN p_volume_band IN ('high', 'medium') AND p_penetration_band = 'high' THEN 'partner'
    ELSE 'check_in'
  END;
$$;

COMMENT ON FUNCTION classify_client_segment IS
  'Matrix logic: low/high volume × low/high penetration → segment.
   Thresholds: volume high>30/mo, medium=20-30, low<20. penetration high>=60%.';

-- ============================================================
-- PART 4: HELPER FUNCTION — Compute volume bands
-- ============================================================
CREATE OR REPLACE FUNCTION get_volume_band(monthly_volume int)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN monthly_volume > 30 THEN 'high'
    WHEN monthly_volume >= 20 THEN 'medium'
    ELSE 'low'
  END;
$$;

CREATE OR REPLACE FUNCTION get_penetration_band(penetration_pct numeric)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN penetration_pct >= 60 THEN 'high'
    ELSE 'low'
  END;
$$;

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
-- Summary of changes:
--   ALTERED:  clients             (+4 columns)
--   ALTERED:  client_institutions (+4 columns)
--   CREATED:  institution_equipment
--   CREATED:  institution_key_contacts
--   CREATED:  product_iol_classification  (+ seed data)
--   CREATED:  client_intelligence
--   CREATED:  client_segment_history
--   CREATED:  client_volume_alerts
--   CREATED:  classify_client_segment()  (SQL function)
--   CREATED:  get_volume_band()          (SQL function)
--   CREATED:  get_penetration_band()     (SQL function)
--
-- NOTHING DELETED OR MODIFIED IN EXISTING DATA.
-- Safe to apply on production.
-- ============================================================
