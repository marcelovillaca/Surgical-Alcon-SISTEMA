-- ============================================================
-- SEED: Productos de prueba para el módulo de inventario
-- Categorías: lente (directo al paciente) e insumos (jornada)
-- ============================================================

-- ─── LENTES INTRAOCULARES (custo vai direto ao paciente) ────────────────────
INSERT INTO conofta_products (sku, name, category, unit, base_cost, min_stock, notes) VALUES
  ('LIO-MON-001', 'LIO Monofocal Alcon SA60AT',         'lente', 'unid', 285000, 5, 'Lente monofocal estándar - más utilizada'),
  ('LIO-MON-002', 'LIO Monofocal Hidrofóbica Bausch',   'lente', 'unid', 210000, 5, 'Lente monofocal alternativa'),
  ('LIO-TOR-001', 'LIO Tórica Alcon AcrySof IQ T3',     'lente', 'unid', 420000, 3, 'Corrección de astigmatismo leve-moderado'),
  ('LIO-TOR-002', 'LIO Tórica Alcon AcrySof IQ T5',     'lente', 'unid', 450000, 3, 'Corrección de astigmatismo moderado-alto'),
  ('LIO-MUL-001', 'LIO Multifocal Alcon PanOptix',      'lente', 'unid', 680000, 2, 'Premium - distancias múltiples'),
  ('LIO-MUL-002', 'LIO Multifocal Symfony Johnson',     'lente', 'unid', 590000, 2, 'Premium - visión extendida')
ON CONFLICT (sku) DO NOTHING;

-- ─── INSUMOS DE JORNADA (custo rateado entre os pacientes da jornada) ───────
INSERT INTO conofta_products (sku, name, category, unit, base_cost, min_stock, notes) VALUES
  -- Viscoelásticos
  ('INS-VIS-001', 'Viscoelástico OVD DisCoVisc 1.6ml',  'insumo', 'unid', 85000, 10, 'Viscoelástico cohesivo para cirugía de catarata'),
  ('INS-VIS-002', 'Viscoelástico ProVisc 0.5ml',        'insumo', 'unid', 45000, 10, 'Viscoelástico dispersivo alternativo'),

  -- Material de sutura y esponja
  ('INS-FIO-001', 'Fio Nylon 10-0 Alcon',               'insumo', 'unid', 18000, 20, 'Sutura corneana - 1 unid por paciente'),
  ('INS-ESP-001', 'Esponja de Celulosa Merocel 4x4mm',  'insumo', 'caja', 32000, 5,  'Caja con 10 esponjas'),

  -- Irrigación y BSS
  ('INS-BSS-001', 'BSS Solución Salina 500ml',          'insumo', 'unid', 22000, 8,  'Solución de irrigación estéril - 1 por jornada'),
  ('INS-BSS-002', 'BSS Plus Solución 500ml',            'insumo', 'unid', 48000, 8,  'BSS enriquecida - preferible para ojos comprometidos'),

  -- Anestesia tópica
  ('INS-ANE-001', 'Tetracaína 0.5% colirio 10ml',       'insumo', 'unid', 12000, 15, 'Anestesia tópica ocular'),
  ('INS-ANE-002', 'Oxibuprocaína 0.4% colirio',         'insumo', 'unid', 9000,  15, 'Anestesia tópica alternativa'),

  -- Antibiótico e dilatação
  ('INS-ANT-001', 'Moxifloxacino 0.5% colirio 3ml',     'insumo', 'unid', 28000, 10, 'Profilaxis antibiótica post-op'),
  ('INS-DIL-001', 'Tropicamida 1% colirio 5ml',         'insumo', 'unid', 8500,  10, 'Dilatación pupilar pre-operatoria'),
  ('INS-DIL-002', 'Fenilefrina 2.5% colirio 5ml',       'insumo', 'unid', 7000,  10, 'Dilatación pupilar refuerzo'),

  -- Descartables cirúrgicos
  ('INS-KIT-001', 'Kit Faco Descartable Alcon',         'insumo', 'kit',  95000, 5,  'Kit completo para facoemulsificación (1 por paciente)'),
  ('INS-CAP-001', 'Capsulorrexis Pinça Descartável',    'insumo', 'unid', 15000, 10, 'Pinza para capsulorrexis continua')
ON CONFLICT (sku) DO NOTHING;

-- ─── MENSAJE DE CONFIRMACIÓN ─────────────────────────────────────────────────
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM conofta_products;
  RAISE NOTICE '✅ Catálogo de productos cargado. Total: % productos', v_count;
END $$;
