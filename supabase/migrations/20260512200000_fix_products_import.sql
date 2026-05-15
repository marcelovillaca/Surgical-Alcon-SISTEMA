-- ============================================================
-- Fix products table for bulk catalog import
-- Date: 2026-05-12
-- Issue: internal_code UNIQUE constraint was blocking bulk upserts
--        when catalog rows share internal codes or codes collide
--        with auto-generated PRD-XXXXX pattern.
-- ============================================================

-- 1. Remove UNIQUE constraint from internal_code so bulk imports don't fail
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_internal_code_key;

-- 2. Add a non-unique index instead (for fast lookups, without blocking duplicates)
CREATE INDEX IF NOT EXISTS idx_products_internal_code ON public.products (internal_code);

-- 3. Add dioptria and toricidad columns to products if they don't exist yet
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='dioptria') THEN
        ALTER TABLE public.products ADD COLUMN dioptria TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='toricidad') THEN
        ALTER TABLE public.products ADD COLUMN toricidad TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='is_critical') THEN
        ALTER TABLE public.products ADD COLUMN is_critical BOOLEAN DEFAULT false;
    END IF;
END $$;

-- 4. Ensure the upsert policy (by SKU) works for gerente role
DROP POLICY IF EXISTS "Manager write products" ON public.products;
CREATE POLICY "Manager write products" ON public.products
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'gerente')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'gerente')
  );

-- 5. Make sure any authenticated user can read products (for dashboard display)
DROP POLICY IF EXISTS "Public read products" ON public.products;
CREATE POLICY "Public read products" ON public.products
  FOR SELECT USING (true);

-- 6. Same for inventory_lots
DROP POLICY IF EXISTS "Public read lots" ON public.inventory_lots;
CREATE POLICY "Public read lots" ON public.inventory_lots
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Manager write lots" ON public.inventory_lots;
CREATE POLICY "Manager write lots" ON public.inventory_lots
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'gerente')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'gerente')
  );
