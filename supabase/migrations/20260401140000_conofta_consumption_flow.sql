-- ============================================================
-- CONOFTA: Consumo de Insumos por Jornada e por Paciente
-- 
-- LÓGICA DE CUSTO:
--   Custo Cirurgia = Custo_Lente_Paciente + (Σ Insumos_Jornada / N_Pacientes)
-- ============================================================

-- ─── 1. CONSUMO DE LENTE POR PACIENTE (Custo Direto) ─────────────────────────
-- Registra qual lente foi implantada em cada olho do paciente
ALTER TABLE conofta_waitlist
  ADD COLUMN IF NOT EXISTS lens_product_id     UUID REFERENCES conofta_products(id),
  ADD COLUMN IF NOT EXISTS lens_qty            NUMERIC(12,2) DEFAULT 1,
  ADD COLUMN IF NOT EXISTS lens_lot_number     TEXT,           -- Nº de lote para rastreabilidade
  ADD COLUMN IF NOT EXISTS lens_registered_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lens_registered_by  UUID REFERENCES auth.users(id);

-- ─── 2. CONSUMO DE INSUMOS DA JORNADA (Custo Rateado) ────────────────────────
-- Cada jornada pode ter N insumos consumidos. O custo total é dividido
-- pelo número de pacientes operados naquela jornada.
CREATE TABLE IF NOT EXISTS conofta_journey_supplies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jornada_id      UUID NOT NULL REFERENCES conofta_journeys(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES conofta_products(id),
  institution_id  UUID NOT NULL REFERENCES institutions(id),
  quantity        NUMERIC(12,2) NOT NULL DEFAULT 1,
  lot_number      TEXT,
  notes           TEXT,
  registered_by   UUID REFERENCES auth.users(id),
  registered_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_journey_supplies_jornada ON conofta_journey_supplies(jornada_id);
CREATE INDEX IF NOT EXISTS idx_journey_supplies_product ON conofta_journey_supplies(product_id);
CREATE INDEX IF NOT EXISTS idx_journey_supplies_institution ON conofta_journey_supplies(institution_id);

-- ─── 3. VIEW AUXILIAR: Custo por Cirurgia ────────────────────────────────────
-- View que agrega: custo da lente + fator de insumos da jornada
CREATE OR REPLACE VIEW v_surgery_cost_breakdown AS
WITH journey_patient_count AS (
  -- Conta quantos pacientes foram operados em cada jornada
  SELECT
    journey_id,
    COUNT(*) AS patient_count
  FROM conofta_waitlist
  WHERE status IN ('operado', 'concluido')
    AND journey_id IS NOT NULL
  GROUP BY journey_id
),
journey_supply_total AS (
  -- Soma o custo total de insumos por jornada (só gerente tem acesso ao base_cost)
  SELECT
    js.jornada_id,
    SUM(js.quantity * COALESCE(p.base_cost, 0)) AS total_supply_cost
  FROM conofta_journey_supplies js
  JOIN conofta_products p ON p.id = js.product_id
  GROUP BY js.jornada_id
),
patient_lens_cost AS (
  -- Custo direto da lente para cada paciente
  SELECT
    w.id AS waitlist_id,
    w.journey_id,
    COALESCE(p.base_cost, 0) * COALESCE(w.lens_qty, 1) AS lens_cost
  FROM conofta_waitlist w
  LEFT JOIN conofta_products p ON p.id = w.lens_product_id
  WHERE w.status IN ('operado', 'concluido')
)
SELECT
  plc.waitlist_id,
  plc.journey_id,
  plc.lens_cost,
  COALESCE(jst.total_supply_cost, 0) / NULLIF(jpc.patient_count, 0) AS supply_cost_per_patient,
  plc.lens_cost + COALESCE(jst.total_supply_cost, 0) / NULLIF(jpc.patient_count, 0) AS total_cost_per_surgery
FROM patient_lens_cost plc
LEFT JOIN journey_patient_count jpc ON jpc.journey_id = plc.journey_id
LEFT JOIN journey_supply_total jst   ON jst.jornada_id = plc.journey_id;

-- ─── 4. RLS para journey_supplies ────────────────────────────────────────────
ALTER TABLE conofta_journey_supplies ENABLE ROW LEVEL SECURITY;

-- Gerente: acesso total
CREATE POLICY "Gerente full journey supplies" ON conofta_journey_supplies
  FOR ALL USING (EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'gerente'
  ));

-- Admin CONOFTA: lê e registra de todas as sedes
CREATE POLICY "Admin CONOFTA manage journey supplies" ON conofta_journey_supplies
  FOR ALL USING (EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin_conofta'
  ));

-- Coordinador Local: apenas sua sede
CREATE POLICY "Coordinador own journey supplies" ON conofta_journey_supplies
  FOR ALL USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'coordinador_local'
    AND institution_id = conofta_journey_supplies.institution_id
  ));

-- ─── 5. Trigger: ao registrar consumo, baixa do estoque ──────────────────────
CREATE OR REPLACE FUNCTION deduct_supply_from_inventory()
RETURNS TRIGGER AS $$
BEGIN
  -- Decrementa o saldo no conofta_inventory
  INSERT INTO conofta_inventory (institution_id, product_id, quantity)
  VALUES (NEW.institution_id, NEW.product_id, -NEW.quantity)
  ON CONFLICT (institution_id, product_id)
  DO UPDATE SET
    quantity = conofta_inventory.quantity - NEW.quantity,
    updated_at = NOW();

  -- Registra no audit trail
  INSERT INTO conofta_stock_movements (
    institution_id, product_id, movement_type, quantity,
    reference_id, reference_type, notes, created_by
  ) VALUES (
    NEW.institution_id, NEW.product_id, 'saida_jornada', -NEW.quantity,
    NEW.jornada_id, 'jornada',
    'Consumo em Jornada: ' || NEW.jornada_id::TEXT,
    NEW.registered_by
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_deduct_supply
AFTER INSERT ON conofta_journey_supplies
FOR EACH ROW EXECUTE FUNCTION deduct_supply_from_inventory();

-- Trigger: ao registrar lente no paciente, baixa do estoque
CREATE OR REPLACE FUNCTION deduct_lens_from_inventory()
RETURNS TRIGGER AS $$
DECLARE
  v_institution_id UUID;
BEGIN
  -- Só executa se a lente foi registrada (foi definido lens_product_id)
  IF NEW.lens_product_id IS NULL OR OLD.lens_product_id = NEW.lens_product_id THEN
    RETURN NEW;
  END IF;

  -- Busca a instituição do paciente
  SELECT institution_id INTO v_institution_id FROM conofta_waitlist WHERE id = NEW.id;

  IF v_institution_id IS NULL THEN RETURN NEW; END IF;

  -- Decrementa estoque
  INSERT INTO conofta_inventory (institution_id, product_id, quantity)
  VALUES (v_institution_id, NEW.lens_product_id, -COALESCE(NEW.lens_qty, 1))
  ON CONFLICT (institution_id, product_id)
  DO UPDATE SET
    quantity = conofta_inventory.quantity - COALESCE(NEW.lens_qty, 1),
    updated_at = NOW();

  -- Audit trail
  INSERT INTO conofta_stock_movements (
    institution_id, product_id, movement_type, quantity,
    reference_id, reference_type, notes, created_by
  ) VALUES (
    v_institution_id, NEW.lens_product_id, 'saida_jornada',
    -COALESCE(NEW.lens_qty, 1),
    NEW.id, 'waitlist_entry',
    'Lente implantada - Paciente: ' || NEW.id::TEXT,
    NEW.lens_registered_by
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_deduct_lens
AFTER UPDATE OF lens_product_id ON conofta_waitlist
FOR EACH ROW EXECUTE FUNCTION deduct_lens_from_inventory();
