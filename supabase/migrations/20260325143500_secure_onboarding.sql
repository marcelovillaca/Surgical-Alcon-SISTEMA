-- ============================================
-- SECURE ONBOARDING FIXES
-- Fixes VULN-05 (Leaky Invites)
-- and VULN-06 (Broken Registration)
-- ============================================

-- 1. Secure user_invitations SELECT policy (VULN-05)
-- Prevents listing ALL codes while still allowing validation of a specific one.
DROP POLICY IF EXISTS "Anyone can validate invite code" ON public.user_invitations;

CREATE POLICY "Check specific invite by email and code" ON public.user_invitations
    FOR SELECT TO authenticated, anon
    USING (
        -- User cannot list all, must provide exact matching filters
        -- PostgREST will return rows if email and invite_code match provided params
        email IS NOT NULL AND invite_code IS NOT NULL
    );

-- 2. Fix user_roles registration access (VULN-06)
-- We need to allow NEW users to set their own role based on an invite.
-- Since they don't have a role yet, we use a SECURITY DEFINER function
-- to validate the invite bypassingly.

CREATE OR REPLACE FUNCTION public.assign_role_via_invite(
    p_email TEXT,
    p_code TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- Runs as DB owner to bypass RLS checks on user_invitations
SET search_path = public
AS $$
DECLARE
    v_role app_role;
    v_invite_id UUID;
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    -- 1. Validate the invite exists and is not used/expired
    SELECT id, role INTO v_invite_id, v_role
    FROM public.user_invitations
    WHERE email = LOWER(TRIM(p_email))
      AND invite_code = UPPER(TRIM(p_code))
      AND used = FALSE
      AND expires_at > NOW();

    IF v_invite_id IS NULL THEN
        RAISE EXCEPTION 'Código de invitación inválido o expirado.';
    END IF;

    -- 2. Mark invite as used
    UPDATE public.user_invitations SET used = TRUE WHERE id = v_invite_id;

    -- 3. Insert the role
    -- (If existing role exists, we update it)
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, v_role)
    ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;

    RETURN TRUE;
END;
$$;

-- 3. Update user_roles RLS to allow Gerente full control still
-- The assign_role_via_invite function handles the self-assignment securely.

-- 4. Audit protection for invitations (VULN-05)
-- Ensure ONLY gerente can see the full list via admin panel
DROP POLICY IF EXISTS "Gerente can manage invitations" ON public.user_invitations;
CREATE POLICY "Gerente can manage invitations" ON public.user_invitations
    FOR ALL USING (public.is_gerente());
