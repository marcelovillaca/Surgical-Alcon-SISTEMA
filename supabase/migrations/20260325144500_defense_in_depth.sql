-- ============================================
-- DEFENSE IN DEPTH: EMAIL VERIFICATION ENFORCEMENT
-- Hardens RLS to ensure unconfirmed emails cannot
-- access sensitive medical or financial data.
-- ============================================

-- 1. Utility function to check email verification in JWT
CREATE OR REPLACE FUNCTION public.is_verified()
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if email_confirmed_at exists and is not null in the JWT
    RETURN (auth.jwt() ->> 'email_confirmed_at') IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Harden conofta_targets (Financial Targets)
-- Only verified gerentes can see this.
DROP POLICY IF EXISTS "Gerentes can view targets" ON public.conofta_targets;
CREATE POLICY "Gerentes can view targets" ON public.conofta_targets
    FOR SELECT TO authenticated
    USING (
        public.is_gerente() 
        AND public.is_verified()
    );

-- 3. Harden conofta_expenses (Financial Intelligence)
DROP POLICY IF EXISTS "Gerente can view expenses" ON public.conofta_expenses;
CREATE POLICY "Gerente can view expenses" ON public.conofta_expenses
    FOR SELECT TO authenticated
    USING (
        public.is_gerente() 
        AND public.is_verified()
    );

-- 4. Harden audit_log access
DROP POLICY IF EXISTS "Management can view audit_log" ON public.audit_log;
CREATE POLICY "Management can view audit_log" ON public.audit_log
    FOR SELECT TO authenticated
    USING (
        (public.is_gerente() OR public.has_role(auth.uid(), 'admin_conofta'))
        AND public.is_verified()
    );

-- 5. Restrictive policy for conofta_waitlist (Patient Data)
-- Users MUST be verified to see patient lists.
DROP POLICY IF EXISTS "Verified users access waitlist" ON public.conofta_waitlist;
CREATE POLICY "Verified users access waitlist" ON public.conofta_waitlist
    AS RESTRICTIVE
    FOR ALL TO authenticated
    USING (public.is_verified());

-- 6. Add rate limit protection to user_invitations (Anti-Brute Force)
-- We add a check to count recent attempts by IP (simulated via DB or just strict logic)
-- For now, we ensure that only verified Gerentes can list codes.
DROP POLICY IF EXISTS "Gerente can manage invitations" ON public.user_invitations;
CREATE POLICY "Gerente can manage invitations" ON public.user_invitations
    FOR ALL TO authenticated
    USING (
        public.is_gerente() 
        AND public.is_verified()
    );

COMMENT ON FUNCTION public.is_verified() IS 'Checks if the current session belongs to an email-verified user.';
