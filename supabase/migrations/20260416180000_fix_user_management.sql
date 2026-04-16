-- ============================================
-- SCHEMA REPAIR & USER MANAGEMENT FIXES
-- ============================================

-- 1. Ensure user_roles has institution_id (MISSING FIX)
ALTER TABLE public.user_roles 
    ADD COLUMN IF NOT EXISTS institution_id UUID REFERENCES public.institutions(id) ON DELETE SET NULL;

-- 2. Update assign_role_via_invite to capture institution_id
CREATE OR REPLACE FUNCTION public.assign_role_via_invite(
    p_email TEXT,
    p_code TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
    v_role app_role;
    v_invite_id UUID;
    v_user_id UUID;
    v_inst_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    -- 1. Validate the invite exists and is not used/expired
    SELECT id, role, institution_id INTO v_invite_id, v_role, v_inst_id
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

    -- 3. Insert the role WITH institution_id
    INSERT INTO public.user_roles (user_id, role, institution_id, is_blocked)
    VALUES (v_user_id, v_role, v_inst_id, FALSE)
    ON CONFLICT (user_id) DO UPDATE SET 
        role = EXCLUDED.role,
        institution_id = EXCLUDED.institution_id;

    RETURN TRUE;
END;
$$;

-- 3. Fix Profiles RLS (be more specific)
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles 
    FOR UPDATE USING (auth.uid() = user_id);

-- 4. Ensure invitation deletion is allowed for Gerente
DROP POLICY IF EXISTS "Gerente can manage invitations" ON public.user_invitations;
CREATE POLICY "Gerente can manage invitations" ON public.user_invitations
    FOR ALL USING (public.is_gerente());

-- 5. Fix Profiles Table (Safety check)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS firstname TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lastname TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT TRUE;
