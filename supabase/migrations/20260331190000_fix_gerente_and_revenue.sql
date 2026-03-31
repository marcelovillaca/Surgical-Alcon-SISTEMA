-- ============================================
-- FIX: Proper Gerente setup for Marcello
-- Remove emergency mock and ensure DB has correct roles
-- ============================================

-- 1. Find Marcello's real auth user_id and ensure gerente role
-- If Marcello is already in user_roles, update to gerente
-- If not, this will be done via the invite system (which now works)

-- Ensure the is_gerente() function works properly:
CREATE OR REPLACE FUNCTION public.is_gerente()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN public.has_role(auth.uid(), 'gerente');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Grant gerente to Marcello by email (safe upsert)
-- We find the user_id from auth.users via profiles table
DO $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Try to find Marcello's user_id from profiles
    SELECT user_id INTO v_user_id
    FROM public.profiles
    WHERE full_name ILIKE '%marcell%villac%'
       OR full_name ILIKE '%marcelo%villac%'
    LIMIT 1;

    IF v_user_id IS NOT NULL THEN
        -- Upsert gerente role
        INSERT INTO public.user_roles (user_id, role)
        VALUES (v_user_id, 'gerente')
        ON CONFLICT (user_id) DO UPDATE SET role = 'gerente', is_blocked = false;
        
        RAISE NOTICE 'Gerente role assigned to user_id: %', v_user_id;
    ELSE
        RAISE NOTICE 'User Marcello not found in profiles. Please sign-in first.';
    END IF;
END $$;

-- 3. Also try to find by auth.users email directly (if available via view)
-- Grant gerente to any user with this email who has a profile
-- This is a fallback if profiles table doesn't have the name yet

-- 4. Add conofta_revenue table for public ingress per surgery type
-- This is the "what the government pays per surgery" data
CREATE TABLE IF NOT EXISTS public.conofta_revenue_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    anio INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM NOW()),
    sucursal TEXT,                     -- NULL = applies to all sedes
    tipo_cirugia TEXT NOT NULL,        -- 'Catarata', 'Retina', etc.
    ingreso_por_cirugia NUMERIC(12,2) NOT NULL DEFAULT 0,  -- What government pays
    moneda TEXT DEFAULT 'USD',
    notas TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by TEXT
);

-- Unique constraint: one config per year/sede/surgery type
ALTER TABLE public.conofta_revenue_config
    DROP CONSTRAINT IF EXISTS conofta_revenue_config_unique;
ALTER TABLE public.conofta_revenue_config
    ADD CONSTRAINT conofta_revenue_config_unique
    UNIQUE (anio, sucursal, tipo_cirugia);

-- Enable RLS
ALTER TABLE public.conofta_revenue_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Gerente can manage revenue config" ON public.conofta_revenue_config;
CREATE POLICY "Gerente can manage revenue config" ON public.conofta_revenue_config
    FOR ALL TO authenticated
    USING (public.is_gerente())
    WITH CHECK (public.is_gerente());

DROP POLICY IF EXISTS "Conofta roles can view revenue config" ON public.conofta_revenue_config;
CREATE POLICY "Conofta roles can view revenue config" ON public.conofta_revenue_config
    FOR SELECT TO authenticated
    USING (
        public.is_gerente() OR
        public.has_role(auth.uid(), 'admin_conofta') OR
        public.has_role(auth.uid(), 'coordinador_local')
    );

-- 5. Insert default values for Catarata and Retina
INSERT INTO public.conofta_revenue_config (anio, tipo_cirugia, ingreso_por_cirugia, moneda, notas)
VALUES 
    (2025, 'Catarata', 0, 'USD', 'Ingreso público por cirugia de catarata - actualizar con valor real'),
    (2025, 'Retina',   0, 'USD', 'Ingreso público por cirugia de retina - actualizar con valor real'),
    (2026, 'Catarata', 0, 'USD', 'Ingreso público por cirugia de catarata - actualizar con valor real'),
    (2026, 'Retina',   0, 'USD', 'Ingreso público por cirugia de retina - actualizar con valor real')
ON CONFLICT (anio, sucursal, tipo_cirugia) DO NOTHING;

COMMENT ON TABLE public.conofta_revenue_config IS 'Ingreso público por tipo de cirugía (lo que paga el gobierno/CONOFTA por cada acto quirúrgico). Usado para calcular P&L.';
