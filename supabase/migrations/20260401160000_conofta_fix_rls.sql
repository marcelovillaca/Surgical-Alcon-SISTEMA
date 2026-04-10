-- ============================================
-- FIX RLS POLICIES FOR CONOFTA ROLES
-- ============================================

-- First, ensure helper functions are up to date and correct
CREATE OR REPLACE FUNCTION public.is_admin_conofta()
RETURNS boolean AS $$
BEGIN
  RETURN (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('gerente', 'admin_conofta')
      AND is_blocked = false
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_user_institution()
RETURNS uuid AS $$
BEGIN
  RETURN (
    SELECT institution_id FROM public.user_roles
    WHERE user_id = auth.uid()
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. CONOFTA_PATIENTS
ALTER TABLE public.conofta_patients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manages all patients" ON public.conofta_patients;
DROP POLICY IF EXISTS "External Hospital can manage patients via waitlist" ON public.conofta_patients;

CREATE POLICY "Admin/Gerente full access to patients"
  ON public.conofta_patients FOR ALL
  TO authenticated
  USING (public.is_admin_conofta());

CREATE POLICY "Coordinador can see patients in their waitlist"
  ON public.conofta_patients FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conofta_waitlist w
      WHERE w.patient_id = public.conofta_patients.id
      AND w.institution_id = public.get_user_institution()
    )
  );

-- 2. CONOFTA_WAITLIST
ALTER TABLE public.conofta_waitlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manages all waitlist" ON public.conofta_waitlist;
DROP POLICY IF EXISTS "Hospital sees its own waitlist" ON public.conofta_waitlist;
DROP POLICY IF EXISTS "Hospital inserts its own waitlist" ON public.conofta_waitlist;

CREATE POLICY "Admin/Gerente full access to waitlist"
  ON public.conofta_waitlist FOR ALL
  TO authenticated
  USING (public.is_admin_conofta());

CREATE POLICY "Coordinador local manage their institution waitlist"
  ON public.conofta_waitlist FOR ALL
  TO authenticated
  USING (institution_id = public.get_user_institution())
  WITH CHECK (institution_id = public.get_user_institution());

-- 3. CONOFTA_JOURNEYS
ALTER TABLE public.conofta_journeys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manages journeys" ON public.conofta_journeys;
DROP POLICY IF EXISTS "Everyone reads journeys" ON public.conofta_journeys;

CREATE POLICY "Admin/Gerente manage journeys"
  ON public.conofta_journeys FOR ALL
  TO authenticated
  USING (public.is_admin_conofta());

CREATE POLICY "Everyone reads journeys"
  ON public.conofta_journeys FOR SELECT
  TO authenticated
  USING (true);

-- 4. CONOFTA_PRODUCTS (Used in select for lenses)
ALTER TABLE public.conofta_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Everyone reads products" ON public.conofta_products;
CREATE POLICY "Everyone reads products"
  ON public.conofta_products FOR SELECT
  TO authenticated
  USING (true);

-- 5. CONOFTA_SURGEONS
ALTER TABLE public.conofta_surgeons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Everyone reads surgeons" ON public.conofta_surgeons;
CREATE POLICY "Everyone reads surgeons"
  ON public.conofta_surgeons FOR SELECT
  TO authenticated
  USING (true);
