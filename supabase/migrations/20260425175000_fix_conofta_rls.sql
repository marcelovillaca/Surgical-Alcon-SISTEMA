-- ============================================================
-- MIGRATION: Fix CONOFTA Permissions & Schema Cache
-- Description: Enables RLS and grants permissions
-- ============================================================

SET search_path TO public;

-- 1. ENABLE RLS
ALTER TABLE public.conofta_institutions ENABLE ROW LEVEL SECURITY;

-- 2. CREATE POLICIES (Allow all authenticated users to manage CONOFTA data)
DROP POLICY IF EXISTS "Allow authenticated select" ON public.conofta_institutions;
CREATE POLICY "Allow authenticated select" ON public.conofta_institutions
FOR SELECT TO authenticated USING (active = true);

DROP POLICY IF EXISTS "Allow authenticated insert" ON public.conofta_institutions;
CREATE POLICY "Allow authenticated insert" ON public.conofta_institutions
FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated update" ON public.conofta_institutions;
CREATE POLICY "Allow authenticated update" ON public.conofta_institutions
FOR UPDATE TO authenticated USING (true);

-- 3. ENSURE PERMISSIONS
GRANT ALL ON TABLE public.conofta_institutions TO postgres;
GRANT ALL ON TABLE public.conofta_institutions TO authenticated;
GRANT ALL ON TABLE public.conofta_institutions TO service_role;

-- 4. REFRESH SURGEONS TABLE PERMISSIONS (just in case)
ALTER TABLE public.conofta_surgeons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated select surgeons" ON public.conofta_surgeons;
CREATE POLICY "Allow authenticated select surgeons" ON public.conofta_surgeons
FOR SELECT TO authenticated USING (active = true);

-- 5. NOTIFY POSTGREST TO RELOAD SCHEMA
NOTIFY pgrst, 'reload schema';
