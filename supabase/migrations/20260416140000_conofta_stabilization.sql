-- ============================================
-- CONOFTA STABILIZATION
-- Fixes RLS policies and ensures schema consistency
-- ============================================

-- 1. Ensure conofta_patients has policies for coordinators
-- Coordonadores need to be able to register new patients (INSERT)
-- and update existing ones (UPDATE) if they are in their institution's scope.
-- However, for the initial search/registration, we'll be slightly more permissive 
-- to allow finding patients across institutions to avoid duplicates.

DROP POLICY IF EXISTS "Coordinador can see patients in their waitlist" ON public.conofta_patients;
DROP POLICY IF EXISTS "Coordinador local manage patients" ON public.conofta_patients;
DROP POLICY IF EXISTS "Admin manages all patients" ON public.conofta_patients;

-- All CONOFTA staff can see all patients (to avoid duplicates by searching cedula)
CREATE POLICY "CONOFTA staff can see all patients" ON public.conofta_patients
    FOR SELECT TO authenticated
    USING (
        public.is_gerente() 
        OR EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin_conofta', 'coordinador_local')
        )
    );

-- All CONOFTA staff can insert/upsert patients
CREATE POLICY "CONOFTA staff can manage patients" ON public.conofta_patients
    FOR ALL TO authenticated
    USING (
        public.is_gerente() 
        OR EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin_conofta', 'coordinador_local')
        )
    )
    WITH CHECK (
        public.is_gerente() 
        OR EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin_conofta', 'coordinador_local')
        )
    );

-- 2. Ensure conofta_surgeons is accessible
-- Already has policies, but let's make sure coordinators can view all active surgeons
DROP POLICY IF EXISTS "Everyone reads surgeons" ON public.conofta_surgeons;
CREATE POLICY "Everyone reads surgeons" ON public.conofta_surgeons
    FOR SELECT TO authenticated USING (true); -- Allow seeing all surgeons for selection

-- 3. Fix conofta_products and other missing tables if they don't have RLS
DO $$
BEGIN
    -- conofta_products
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'conofta_products') THEN
        CREATE TABLE public.conofta_products (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name        TEXT NOT NULL,
            sku         TEXT,
            category    TEXT, -- 'lente', 'insumo', etc
            unit        TEXT,
            is_active   BOOLEAN DEFAULT TRUE,
            created_at  TIMESTAMPTZ DEFAULT now()
        );
        ALTER TABLE public.conofta_products ENABLE ROW LEVEL SECURITY;
    END IF;

    -- conofta_revenue_config
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'conofta_revenue_config') THEN
        CREATE TABLE public.conofta_revenue_config (
            id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            anio                INTEGER NOT NULL,
            sucursal            TEXT, -- NULL means all
            tipo_cirugia        TEXT NOT NULL,
            ingreso_por_cirugia NUMERIC NOT NULL DEFAULT 0,
            moneda              TEXT DEFAULT 'USD',
            created_at          TIMESTAMPTZ DEFAULT now(),
            UNIQUE(anio, sucursal, tipo_cirugia)
        );
        ALTER TABLE public.conofta_revenue_config ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Policies for conofta_products
DROP POLICY IF EXISTS "CONOFTA staff reads products" ON public.conofta_products;
CREATE POLICY "CONOFTA staff reads products" ON public.conofta_products
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin manage products" ON public.conofta_products;
CREATE POLICY "Admin manage products" ON public.conofta_products
    FOR ALL TO authenticated USING (public.is_gerente() OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin_conofta'));

-- Policies for conofta_revenue_config
DROP POLICY IF EXISTS "CONOFTA staff reads revenue" ON public.conofta_revenue_config;
CREATE POLICY "CONOFTA staff reads revenue" ON public.conofta_revenue_config
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin manage revenue" ON public.conofta_revenue_config;
CREATE POLICY "Admin manage revenue" ON public.conofta_revenue_config
    FOR ALL TO authenticated USING (public.is_gerente() OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin_conofta'));
