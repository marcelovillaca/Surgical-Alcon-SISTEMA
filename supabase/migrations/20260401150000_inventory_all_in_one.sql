-- ============================================================
-- SCRIPT ALL-IN-ONE: Módulo de Inventário CONOFTA
-- Execute este script diretamente no SQL Editor do Supabase.
-- Ele é 100% idempotente (pode ser executado várias vezes).
-- ============================================================

-- ─── PASSO 1: Garantir tabela de jornadas cirúrgicas ─────────────────────────
CREATE TABLE IF NOT EXISTS public.conofta_journeys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  date            DATE NOT NULL,
  institution_id  UUID REFERENCES public.institutions(id) NOT NULL,
  max_capacity    INTEGER DEFAULT 20,
  description     TEXT,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.conofta_journeys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manages journeys"  ON public.conofta_journeys;
DROP POLICY IF EXISTS "Everyone reads journeys" ON public.conofta_journeys;
CREATE POLICY "Admin manages journeys"  ON public.conofta_journeys FOR ALL     USING (public.is_gerente());
CREATE POLICY "Everyone reads journeys" ON public.conofta_journeys FOR SELECT  TO authenticated USING (true);

-- ─── PASSO 2: Catálogo mestre de produtos ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.conofta_products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku         TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL CHECK (category IN ('lente', 'insumo', 'equipamento', 'outro')),
  unit        TEXT NOT NULL DEFAULT 'unid',
  base_cost   NUMERIC(12,2) DEFAULT 0,
  min_stock   INTEGER DEFAULT 5,
  is_active   BOOLEAN DEFAULT TRUE,
  notes       TEXT,
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.conofta_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Gerente full access products"     ON public.conofta_products;
DROP POLICY IF EXISTS "Admin_conofta can read products"  ON public.conofta_products;
DROP POLICY IF EXISTS "Coordinador can read products"    ON public.conofta_products;
CREATE POLICY "Gerente full access products"    ON public.conofta_products FOR ALL    USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'gerente'));
CREATE POLICY "Admin_conofta can read products" ON public.conofta_products FOR SELECT USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin_conofta', 'coordinador_local')));

-- ─── PASSO 3: Saldo de estoque por sede ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.conofta_inventory (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  product_id     UUID NOT NULL REFERENCES public.conofta_products(id) ON DELETE CASCADE,
  quantity       NUMERIC(12,2) DEFAULT 0,
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(institution_id, product_id)
);
ALTER TABLE public.conofta_inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Gerente full access inventory"   ON public.conofta_inventory;
DROP POLICY IF EXISTS "Admin_conofta can manage inventory" ON public.conofta_inventory;
DROP POLICY IF EXISTS "Coordinador sees own inventory"  ON public.conofta_inventory;
CREATE POLICY "Gerente full access inventory"      ON public.conofta_inventory FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'gerente'));
CREATE POLICY "Admin_conofta can manage inventory" ON public.conofta_inventory FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin_conofta'));
CREATE POLICY "Coordinador sees own inventory"     ON public.conofta_inventory FOR SELECT USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'coordinador_local' AND institution_id = conofta_inventory.institution_id));

-- ─── PASSO 4: Movimentos de estoque (audit trail imutável) ───────────────────
CREATE TABLE IF NOT EXISTS public.conofta_stock_movements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  UUID NOT NULL REFERENCES public.institutions(id),
  product_id      UUID NOT NULL REFERENCES public.conofta_products(id),
  movement_type   TEXT NOT NULL CHECK (movement_type IN ('entrada_reposicao','saida_jornada','ajuste_inventario','entrada_inicial','ajuste_manual')),
  quantity        NUMERIC(12,2) NOT NULL,
  reference_id    UUID,
  reference_type  TEXT,
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.conofta_stock_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Gerente full access movements"    ON public.conofta_stock_movements;
DROP POLICY IF EXISTS "Admin_conofta can read movements" ON public.conofta_stock_movements;
DROP POLICY IF EXISTS "Coordinador sees own movements"   ON public.conofta_stock_movements;
CREATE POLICY "Gerente full access movements"    ON public.conofta_stock_movements FOR ALL    USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'gerente'));
CREATE POLICY "Admin_conofta can read movements" ON public.conofta_stock_movements FOR SELECT USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin_conofta'));
CREATE POLICY "Coordinador sees own movements"   ON public.conofta_stock_movements FOR SELECT USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'coordinador_local' AND institution_id = conofta_stock_movements.institution_id));

-- ─── PASSO 5: Pedidos de reposição ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.conofta_replenishment_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number   TEXT NOT NULL UNIQUE,
  institution_id   UUID NOT NULL REFERENCES public.institutions(id),
  status           TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','enviado','recebido','divergente','cancelado')),
  notes_request    TEXT,
  notes_dispatch   TEXT,
  notes_received   TEXT,
  requested_by     UUID REFERENCES auth.users(id),
  dispatched_by    UUID REFERENCES auth.users(id),
  received_by      UUID REFERENCES auth.users(id),
  requested_at     TIMESTAMPTZ DEFAULT NOW(),
  dispatched_at    TIMESTAMPTZ,
  received_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.conofta_replenishment_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Gerente full access replenishment"     ON public.conofta_replenishment_requests;
DROP POLICY IF EXISTS "Admin_conofta can manage replenishment" ON public.conofta_replenishment_requests;
DROP POLICY IF EXISTS "Coordinador manages own replenishment" ON public.conofta_replenishment_requests;
CREATE POLICY "Gerente full access replenishment"      ON public.conofta_replenishment_requests FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'gerente'));
CREATE POLICY "Admin_conofta can manage replenishment" ON public.conofta_replenishment_requests FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin_conofta'));
CREATE POLICY "Coordinador manages own replenishment"  ON public.conofta_replenishment_requests FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'coordinador_local' AND institution_id = conofta_replenishment_requests.institution_id));

-- ─── PASSO 6: Itens do pedido (Pedido / Enviado / Recebido) ──────────────────
CREATE TABLE IF NOT EXISTS public.conofta_replenishment_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id        UUID NOT NULL REFERENCES public.conofta_replenishment_requests(id) ON DELETE CASCADE,
  product_id        UUID NOT NULL REFERENCES public.conofta_products(id),
  qty_requested     NUMERIC(12,2) NOT NULL,
  qty_sent          NUMERIC(12,2),
  qty_received      NUMERIC(12,2),
  divergence_reason TEXT
);
ALTER TABLE public.conofta_replenishment_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Gerente full replenishment items"       ON public.conofta_replenishment_items;
DROP POLICY IF EXISTS "Coordinador own replenishment items"    ON public.conofta_replenishment_items;
CREATE POLICY "Gerente full replenishment items"    ON public.conofta_replenishment_items FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('gerente','admin_conofta')));
CREATE POLICY "Coordinador own replenishment items" ON public.conofta_replenishment_items FOR ALL USING (EXISTS (SELECT 1 FROM public.conofta_replenishment_requests r JOIN user_roles ur ON ur.user_id = auth.uid() AND ur.role = 'coordinador_local' WHERE r.id = conofta_replenishment_items.request_id AND r.institution_id = ur.institution_id));

-- ─── PASSO 7: Tarefas de inventário mensal ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.conofta_inventory_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  UUID NOT NULL REFERENCES public.institutions(id),
  period_year     INTEGER NOT NULL,
  period_month    INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  status          TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','em_andamento','concluido','com_divergencia')),
  due_date        DATE NOT NULL,
  completed_at    TIMESTAMPTZ,
  completed_by    UUID REFERENCES auth.users(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(institution_id, period_year, period_month)
);
ALTER TABLE public.conofta_inventory_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Gerente full access tasks"    ON public.conofta_inventory_tasks;
DROP POLICY IF EXISTS "Admin_conofta can manage tasks" ON public.conofta_inventory_tasks;
DROP POLICY IF EXISTS "Coordinador manages own tasks" ON public.conofta_inventory_tasks;
CREATE POLICY "Gerente full access tasks"     ON public.conofta_inventory_tasks FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'gerente'));
CREATE POLICY "Admin_conofta can manage tasks" ON public.conofta_inventory_tasks FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin_conofta'));
CREATE POLICY "Coordinador manages own tasks"  ON public.conofta_inventory_tasks FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'coordinador_local' AND institution_id = conofta_inventory_tasks.institution_id));

-- ─── PASSO 8: Insumos consumidos por jornada ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.conofta_journey_supplies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jornada_id      UUID NOT NULL REFERENCES public.conofta_journeys(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES public.conofta_products(id),
  institution_id  UUID NOT NULL REFERENCES public.institutions(id),
  quantity        NUMERIC(12,2) NOT NULL DEFAULT 1,
  lot_number      TEXT,
  notes           TEXT,
  registered_by   UUID REFERENCES auth.users(id),
  registered_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.conofta_journey_supplies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Gerente full journey supplies"          ON public.conofta_journey_supplies;
DROP POLICY IF EXISTS "Admin CONOFTA manage journey supplies"  ON public.conofta_journey_supplies;
DROP POLICY IF EXISTS "Coordinador own journey supplies"       ON public.conofta_journey_supplies;
CREATE POLICY "Gerente full journey supplies"         ON public.conofta_journey_supplies FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'gerente'));
CREATE POLICY "Admin CONOFTA manage journey supplies" ON public.conofta_journey_supplies FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin_conofta'));
CREATE POLICY "Coordinador own journey supplies"      ON public.conofta_journey_supplies FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'coordinador_local' AND institution_id = conofta_journey_supplies.institution_id));

-- ─── PASSO 9: Colunas de lente no paciente ───────────────────────────────────
ALTER TABLE public.conofta_waitlist
  ADD COLUMN IF NOT EXISTS lens_product_id    UUID REFERENCES public.conofta_products(id),
  ADD COLUMN IF NOT EXISTS lens_qty           NUMERIC(12,2) DEFAULT 1,
  ADD COLUMN IF NOT EXISTS lens_lot_number    TEXT,
  ADD COLUMN IF NOT EXISTS lens_registered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lens_registered_by UUID REFERENCES auth.users(id);

-- ─── PASSO 10: Índices ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_inventory_institution       ON public.conofta_inventory(institution_id);
CREATE INDEX IF NOT EXISTS idx_movements_institution       ON public.conofta_stock_movements(institution_id);
CREATE INDEX IF NOT EXISTS idx_replenishment_institution   ON public.conofta_replenishment_requests(institution_id);
CREATE INDEX IF NOT EXISTS idx_replenishment_status        ON public.conofta_replenishment_requests(status);
CREATE INDEX IF NOT EXISTS idx_tasks_institution           ON public.conofta_inventory_tasks(institution_id);
CREATE INDEX IF NOT EXISTS idx_journey_supplies_jornada    ON public.conofta_journey_supplies(jornada_id);

-- ─── PASSO 11: Função para número de pedido ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_request_number()
RETURNS TEXT AS $$
DECLARE
  v_prefix TEXT := 'REP-' || TO_CHAR(NOW(), 'YYYYMM') || '-';
  v_count  INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.conofta_replenishment_requests
  WHERE request_number LIKE v_prefix || '%';
  RETURN v_prefix || LPAD((v_count + 1)::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- ─── PASSO 12: Trigger — débito de insumos da jornada ────────────────────────
CREATE OR REPLACE FUNCTION public.deduct_supply_from_inventory()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.conofta_inventory (institution_id, product_id, quantity)
  VALUES (NEW.institution_id, NEW.product_id, -NEW.quantity)
  ON CONFLICT (institution_id, product_id)
  DO UPDATE SET quantity = public.conofta_inventory.quantity - NEW.quantity, updated_at = NOW();

  INSERT INTO public.conofta_stock_movements (institution_id, product_id, movement_type, quantity, reference_id, reference_type, notes, created_by)
  VALUES (NEW.institution_id, NEW.product_id, 'saida_jornada', -NEW.quantity, NEW.jornada_id, 'jornada', 'Consumo Jornada: ' || NEW.jornada_id::TEXT, NEW.registered_by);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_deduct_supply ON public.conofta_journey_supplies;
CREATE TRIGGER trg_deduct_supply
AFTER INSERT ON public.conofta_journey_supplies
FOR EACH ROW EXECUTE FUNCTION public.deduct_supply_from_inventory();

-- ─── PASSO 13: Trigger — débito de lente do paciente ────────────────────────
CREATE OR REPLACE FUNCTION public.deduct_lens_from_inventory()
RETURNS TRIGGER AS $$
DECLARE v_institution_id UUID;
BEGIN
  IF NEW.lens_product_id IS NULL OR (OLD.lens_product_id IS NOT DISTINCT FROM NEW.lens_product_id) THEN
    RETURN NEW;
  END IF;
  v_institution_id := NEW.institution_id;
  IF v_institution_id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.conofta_inventory (institution_id, product_id, quantity)
  VALUES (v_institution_id, NEW.lens_product_id, -COALESCE(NEW.lens_qty, 1))
  ON CONFLICT (institution_id, product_id)
  DO UPDATE SET quantity = public.conofta_inventory.quantity - COALESCE(NEW.lens_qty, 1), updated_at = NOW();

  INSERT INTO public.conofta_stock_movements (institution_id, product_id, movement_type, quantity, reference_id, reference_type, notes, created_by)
  VALUES (v_institution_id, NEW.lens_product_id, 'saida_jornada', -COALESCE(NEW.lens_qty, 1), NEW.id, 'waitlist_entry', 'Lente: Paciente ' || NEW.id::TEXT, NEW.lens_registered_by);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_deduct_lens ON public.conofta_waitlist;
CREATE TRIGGER trg_deduct_lens
AFTER UPDATE OF lens_product_id ON public.conofta_waitlist
FOR EACH ROW EXECUTE FUNCTION public.deduct_lens_from_inventory();

-- ─── PASSO 14: SEED — Produtos de teste ──────────────────────────────────────
INSERT INTO public.conofta_products (sku, name, category, unit, base_cost, min_stock, notes) VALUES
  ('LIO-MON-001', 'LIO Monofocal Alcon SA60AT',        'lente',  'unid', 285000, 5, 'Lente monofocal estándar'),
  ('LIO-MON-002', 'LIO Monofocal Hidrofóbica Bausch',  'lente',  'unid', 210000, 5, 'Alternativa monofocal'),
  ('LIO-TOR-001', 'LIO Tórica Alcon AcrySof IQ T3',    'lente',  'unid', 420000, 3, 'Astigmatismo leve-moderado'),
  ('LIO-TOR-002', 'LIO Tórica Alcon AcrySof IQ T5',    'lente',  'unid', 450000, 3, 'Astigmatismo moderado-alto'),
  ('LIO-MUL-001', 'LIO Multifocal Alcon PanOptix',     'lente',  'unid', 680000, 2, 'Premium - distancias múltiples'),
  ('INS-VIS-001', 'Viscoelástico OVD DisCoVisc 1.6ml', 'insumo', 'unid',  85000,10, 'Viscoelástico cohesivo'),
  ('INS-VIS-002', 'Viscoelástico ProVisc 0.5ml',       'insumo', 'unid',  45000,10, 'Viscoelástico dispersivo'),
  ('INS-FIO-001', 'Fio Nylon 10-0 Alcon',              'insumo', 'unid',  18000,20, 'Sutura corneana'),
  ('INS-BSS-001', 'BSS Solución Salina 500ml',         'insumo', 'unid',  22000, 8, 'Irrigación estéril'),
  ('INS-ANE-001', 'Tetracaína 0.5% colirio 10ml',      'insumo', 'unid',  12000,15, 'Anestesia tópica'),
  ('INS-ANT-001', 'Moxifloxacino 0.5% colirio 3ml',   'insumo', 'unid',  28000,10, 'Profilaxis antibiótica'),
  ('INS-DIL-001', 'Tropicamida 1% colirio 5ml',        'insumo', 'unid',   8500,10, 'Dilatación pupilar'),
  ('INS-KIT-001', 'Kit Faco Descartable Alcon',        'insumo', 'kit',   95000, 5, 'Kit facoemulsificación'),
  ('INS-ESP-001', 'Esponja de Celulosa Merocel 4x4mm', 'insumo', 'caja',  32000, 5, 'Caja x10 esponjas')
ON CONFLICT (sku) DO NOTHING;

DO $$
DECLARE v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.conofta_products;
  RAISE NOTICE '✅ Módulo de Inventário instalado. Produtos no catálogo: %', v_count;
END $$;
