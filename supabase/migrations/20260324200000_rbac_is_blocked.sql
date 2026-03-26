-- ============================================
-- RBAC SECURITY ENHANCEMENTS
-- Adds is_blocked to user_roles for user
-- account suspension by gerente.
-- Also adds institution_id to user_invitations
-- so invites can pre-assign a sede.
-- ============================================

-- 1. Add is_blocked column to user_roles
ALTER TABLE public.user_roles
    ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Add institution_id to user_invitations (for coordinador_local pre-assignment)
ALTER TABLE public.user_invitations
    ADD COLUMN IF NOT EXISTS institution_id UUID REFERENCES public.institutions(id) ON DELETE SET NULL;

-- 3. Update RLS policies to block suspended users
-- Revoke access for blocked users on sensitive tables

-- conofta_waitlist: blocked users cannot read or write
DROP POLICY IF EXISTS "Blocked users denied" ON public.conofta_waitlist;
CREATE POLICY "Blocked users denied" ON public.conofta_waitlist
    AS RESTRICTIVE
    FOR ALL TO authenticated
    USING (
        NOT EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
            AND is_blocked = TRUE
        )
    );

-- visits: blocked users cannot read or write
DROP POLICY IF EXISTS "Blocked users denied visits" ON public.visits;
CREATE POLICY "Blocked users denied visits" ON public.visits
    AS RESTRICTIVE
    FOR ALL TO authenticated
    USING (
        NOT EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
            AND is_blocked = TRUE
        )
    );

-- 4. Add helpful index for performance
CREATE INDEX IF NOT EXISTS idx_user_roles_blocked
    ON public.user_roles(user_id, is_blocked)
    WHERE is_blocked = TRUE;

-- 5. Verify is_gerente() function exists and is correct
-- (should already exist, this is a safety check)
CREATE OR REPLACE FUNCTION public.is_gerente()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
        AND role = 'gerente'
        AND is_blocked = FALSE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
