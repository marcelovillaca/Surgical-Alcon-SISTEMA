-- ============================================================
-- CONOFTA INVENTORY MODULE
-- Criado: 2026-04-01
-- ============================================================

-- ─── 1. CATÁLOGO DE PRODUTOS (Mestre) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conofta_products (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku           TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  category      TEXT NOT NULL CHECK (category IN ('lente', 'insumo', 'equipamento', 'outro')),
  unit          TEXT NOT NULL DEFAULT 'unid',
  base_cost     NUMERIC(12,2) DEFAULT 0,  -- Visível APENAS para Gerente
  min_stock     INTEGER DEFAULT 5,        -- Nível mínimo antes de alertar
  is_active     BOOLEAN DEFAULT TRUE,
  notes         TEXT,
  created_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 2. ESTOQUE POR SEDE ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conofta_inventory (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  product_id     UUID NOT NULL REFERENCES conofta_products(id) ON DELETE CASCADE,
  quantity       NUMERIC(12,2) DEFAULT 0,
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(institution_id, product_id)
);

-- ─── 3. PEDIDOS DE REPOSIÇÃO (Pedido / Enviado / Recebido) ───────────────────
CREATE TABLE IF NOT EXISTS conofta_replenishment_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number      TEXT NOT NULL UNIQUE,       -- ex: REP-202604-001
  institution_id      UUID NOT NULL REFERENCES institutions(id),
  status              TEXT NOT NULL DEFAULT 'pendente'
                        CHECK (status IN (
                          'pendente',    -- Coordinador criou, aguarda Central
                          'enviado',     -- Admin Central despachou
                          'recebido',    -- Coordinador confirmou recepção
                          'divergente',  -- Houve diferença Enviado vs Recebido
                          'cancelado'
                        )),
  notes_request       TEXT,   -- Observações do Coordinador ao pedir
  notes_dispatch      TEXT,   -- Observações do Admin ao despachar
  notes_received      TEXT,   -- Observações do Coordinador ao receber
  requested_by        UUID REFERENCES auth.users(id),
  dispatched_by       UUID REFERENCES auth.users(id),
  received_by         UUID REFERENCES auth.users(id),
  requested_at        TIMESTAMPTZ DEFAULT NOW(),
  dispatched_at       TIMESTAMPTZ,
  received_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 4. ITEMS DO PEDIDO (Detalhe linha a linha) ───────────────────────────────
CREATE TABLE IF NOT EXISTS conofta_replenishment_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id     UUID NOT NULL REFERENCES conofta_replenishment_requests(id) ON DELETE CASCADE,
  product_id     UUID NOT NULL REFERENCES conofta_products(id),
  qty_requested  NUMERIC(12,2) NOT NULL,   -- O que o Coordinador pediu
  qty_sent       NUMERIC(12,2),            -- O que o Central despachou (pode diferir)
  qty_received   NUMERIC(12,2),            -- O que o Coordinador confirmou receber
  divergence_reason TEXT                   -- Motivo se Enviado ≠ Recebido
);

-- ─── 5. MOVIMENTOS DE ESTOQUE (Audit Trail imutável) ─────────────────────────
CREATE TABLE IF NOT EXISTS conofta_stock_movements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  UUID NOT NULL REFERENCES institutions(id),
  product_id      UUID NOT NULL REFERENCES conofta_products(id),
  movement_type   TEXT NOT NULL CHECK (movement_type IN (
    'entrada_reposicao',    -- Reposição aprovada pelo Central
    'saida_jornada',        -- Consumo em Jornada Cirúrgica
    'ajuste_inventario',    -- Ajuste de inventário mensal
    'entrada_inicial',      -- Carga inicial de estoque
    'ajuste_manual'         -- Ajuste manual autorizado (só Gerente)
  )),
  quantity        NUMERIC(12,2) NOT NULL,  -- Positivo = entrada, Negativo = saída
  reference_id    UUID,          -- ID do request ou jornada relacionada
  reference_type  TEXT,          -- 'replenishment_request' | 'jornada' | 'inventario'
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
  -- NOTA: Não tem UPDATE/DELETE por design — imutável para auditoria
);

-- ─── 6. TAREFAS DE INVENTÁRIO MENSAL ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conofta_inventory_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  UUID NOT NULL REFERENCES institutions(id),
  period_year     INTEGER NOT NULL,
  period_month    INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  status          TEXT NOT NULL DEFAULT 'pendente'
                    CHECK (status IN ('pendente', 'em_andamento', 'concluido', 'com_divergencia')),
  due_date        DATE NOT NULL,
  completed_at    TIMESTAMPTZ,
  completed_by    UUID REFERENCES auth.users(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(institution_id, period_year, period_month)
);

-- ─── 7. ITENS DO INVENTÁRIO (Contagem física vs Sistema) ─────────────────────
CREATE TABLE IF NOT EXISTS conofta_inventory_count_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         UUID NOT NULL REFERENCES conofta_inventory_tasks(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES conofta_products(id),
  qty_system      NUMERIC(12,2) NOT NULL,   -- Saldo no sistema no momento da contagem
  qty_physical    NUMERIC(12,2),            -- Contagem física realizada
  divergence      NUMERIC(12,2)             -- qty_physical - qty_system (gerado automaticamente)
);

-- ─── ÍNDICES ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_inventory_institution ON conofta_inventory(institution_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_institution ON conofta_stock_movements(institution_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON conofta_stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_replenishment_institution ON conofta_replenishment_requests(institution_id);
CREATE INDEX IF NOT EXISTS idx_replenishment_status ON conofta_replenishment_requests(status);
CREATE INDEX IF NOT EXISTS idx_inventory_tasks_institution ON conofta_inventory_tasks(institution_id);
CREATE INDEX IF NOT EXISTS idx_inventory_tasks_status ON conofta_inventory_tasks(status);

-- ─── FUNÇÕES AUXILIARES ───────────────────────────────────────────────────────

-- Gera número de pedido sequencial: REP-YYYYMM-XXX
CREATE OR REPLACE FUNCTION generate_request_number()
RETURNS TEXT AS $$
DECLARE
  v_prefix TEXT := 'REP-' || TO_CHAR(NOW(), 'YYYYMM') || '-';
  v_count  INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM conofta_replenishment_requests
  WHERE request_number LIKE v_prefix || '%';
  RETURN v_prefix || LPAD((v_count + 1)::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- Trigger: atualiza divergência automática nos itens de inventário
CREATE OR REPLACE FUNCTION calc_inventory_divergence()
RETURNS TRIGGER AS $$
BEGIN
  NEW.divergence := COALESCE(NEW.qty_physical, 0) - NEW.qty_system;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calc_divergence
BEFORE INSERT OR UPDATE ON conofta_inventory_count_items
FOR EACH ROW EXECUTE FUNCTION calc_inventory_divergence();

-- ─── RLS (Row Level Security) ─────────────────────────────────────────────────
ALTER TABLE conofta_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE conofta_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE conofta_replenishment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE conofta_replenishment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE conofta_stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE conofta_inventory_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE conofta_inventory_count_items ENABLE ROW LEVEL SECURITY;

-- Políticas: Gerente vê tudo
CREATE POLICY "Gerente full access products" ON conofta_products
  FOR ALL USING (EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'gerente'
  ));

CREATE POLICY "Gerente full access inventory" ON conofta_inventory
  FOR ALL USING (EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'gerente'
  ));

CREATE POLICY "Gerente full access replenishment" ON conofta_replenishment_requests
  FOR ALL USING (EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'gerente'
  ));

CREATE POLICY "Gerente full access movements" ON conofta_stock_movements
  FOR ALL USING (EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'gerente'
  ));

CREATE POLICY "Gerente full access tasks" ON conofta_inventory_tasks
  FOR ALL USING (EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'gerente'
  ));

-- Políticas: Admin CONOFTA vê todas as sedes
CREATE POLICY "Admin_conofta can read products" ON conofta_products
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin_conofta'
  ));

CREATE POLICY "Admin_conofta can manage inventory" ON conofta_inventory
  FOR ALL USING (EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin_conofta'
  ));

CREATE POLICY "Admin_conofta can manage replenishment" ON conofta_replenishment_requests
  FOR ALL USING (EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin_conofta'
  ));

CREATE POLICY "Admin_conofta can read movements" ON conofta_stock_movements
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin_conofta'
  ));

CREATE POLICY "Admin_conofta can manage tasks" ON conofta_inventory_tasks
  FOR ALL USING (EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin_conofta'
  ));

-- Políticas: Coordinador Local — somente sua sede
CREATE POLICY "Coordinador can read products" ON conofta_products
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'coordinador_local'
  ));

CREATE POLICY "Coordinador sees own inventory" ON conofta_inventory
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'coordinador_local'
    AND institution_id = conofta_inventory.institution_id
  ));

CREATE POLICY "Coordinador manages own replenishment" ON conofta_replenishment_requests
  FOR ALL USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'coordinador_local'
    AND institution_id = conofta_replenishment_requests.institution_id
  ));

CREATE POLICY "Coordinador sees own movements" ON conofta_stock_movements
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'coordinador_local'
    AND institution_id = conofta_stock_movements.institution_id
  ));

CREATE POLICY "Coordinador manages own tasks" ON conofta_inventory_tasks
  FOR ALL USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'coordinador_local'
    AND institution_id = conofta_inventory_tasks.institution_id
  ));

-- Policies: conofta_replenishment_items e count_items herdados via join
CREATE POLICY "Gerente full replenishment items" ON conofta_replenishment_items
  FOR ALL USING (EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('gerente', 'admin_conofta')
  ));
CREATE POLICY "Coordinador own replenishment items" ON conofta_replenishment_items
  FOR ALL USING (EXISTS (
    SELECT 1 FROM conofta_replenishment_requests r
    JOIN user_roles ur ON ur.user_id = auth.uid() AND ur.role = 'coordinador_local'
    WHERE r.id = conofta_replenishment_items.request_id
    AND r.institution_id = ur.institution_id
  ));

CREATE POLICY "Gerente full count items" ON conofta_inventory_count_items
  FOR ALL USING (EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('gerente', 'admin_conofta')
  ));
CREATE POLICY "Coordinador own count items" ON conofta_inventory_count_items
  FOR ALL USING (EXISTS (
    SELECT 1 FROM conofta_inventory_tasks t
    JOIN user_roles ur ON ur.user_id = auth.uid() AND ur.role = 'coordinador_local'
    WHERE t.id = conofta_inventory_count_items.task_id
    AND t.institution_id = ur.institution_id
  ));
