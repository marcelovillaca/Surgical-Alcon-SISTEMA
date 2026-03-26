-- ============================================
-- SECURITY HARDENING MIGRATION
-- Fixes VULN-01 (Broken Access Control) 
-- and VULN-03 (Excessive Info Leakage)
-- ============================================

-- 1. Fix conofta_waitlist RLS (VULN-01)
-- Drop the overly broad policy
DROP POLICY IF EXISTS "Admin manages all waitlist" ON public.conofta_waitlist;

-- Policy for Admins (Full Access)
CREATE POLICY "Admin/Gerente manages all waitlist" ON public.conofta_waitlist
    FOR ALL USING (
        public.is_gerente()
        OR EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
            AND role = 'admin_conofta'
            AND is_blocked = FALSE
        )
    );

-- Policy for Local Coordinators (Isolated by Institution)
CREATE POLICY "Coordinador manages own institution" ON public.conofta_waitlist
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
            AND role = 'coordinador_local'
            AND institution_id = conofta_waitlist.institution_id
            AND is_blocked = FALSE
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
            AND role = 'coordinador_local'
            AND institution_id = conofta_waitlist.institution_id
            AND is_blocked = FALSE
        )
    );

-- 2. Restrict access to patients (VULN-01)
DROP POLICY IF EXISTS "Admin manages all patients" ON public.conofta_patients;
DROP POLICY IF EXISTS "External Hospital can manage patients via waitlist" ON public.conofta_patients;

CREATE POLICY "Admin/Gerente manages all patients" ON public.conofta_patients 
    FOR ALL USING (public.is_gerente() OR public.has_role(auth.uid(), 'admin_conofta'));

CREATE POLICY "Coordinador manages institutional patients" ON public.conofta_patients
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.conofta_waitlist w
            JOIN public.user_roles ur ON w.institution_id = ur.institution_id
            WHERE w.patient_id = conofta_patients.id
            AND ur.user_id = auth.uid()
            AND ur.role = 'coordinador_local'
            AND ur.is_blocked = FALSE
        )
    );

-- 3. Restrict Intelligence Data (VULN-03)
-- conofta_targets
DROP POLICY IF EXISTS "Authenticated can read conofta_targets" ON public.conofta_targets;
CREATE POLICY "Only Gerente reads targets" ON public.conofta_targets
    FOR SELECT USING (public.is_gerente());

-- conofta_expenses
DROP POLICY IF EXISTS "Authenticated can read conofta_expenses" ON public.conofta_expenses;
CREATE POLICY "Only Gerente reads expenses" ON public.conofta_expenses
    FOR SELECT USING (public.is_gerente());

-- 4. Audit Log Protection
DROP POLICY IF EXISTS "Gerente can read audit" ON public.audit_log;
CREATE POLICY "Admin/Gerente reads audit" ON public.audit_log
    FOR SELECT USING (public.is_gerente() OR public.has_role(auth.uid(), 'admin_conofta'));
