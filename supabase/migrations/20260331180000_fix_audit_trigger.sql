-- ============================================
-- FIX: Broken audit trigger for user_invitations
-- The previous trigger used columns 'table_name' and 'record_id'
-- which DO NOT EXIST in audit_log. Correct columns are
-- 'entity_type' and 'entity_id'. This caused ALL inserts to
-- user_invitations (invites) and any trigger-linked tables to
-- fail with a database error.
-- Also fixes the RLS policy to not over-require is_verified()
-- for operational writes (imports, invites).
-- ============================================

-- 1. FIX: Correct the audit_invitation_change trigger function
CREATE OR REPLACE FUNCTION public.audit_invitation_change()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.audit_log (
        user_id,
        action,
        entity_type,    -- FIXED: was 'table_name' (column does not exist)
        entity_id,      -- FIXED: was 'record_id' (column does not exist)
        details
    ) VALUES (
        auth.uid(),
        TG_OP,
        'user_invitations',
        NEW.id::text,
        jsonb_build_object(
            'email', NEW.email,
            'role', NEW.role,
            'expires_at', NEW.expires_at
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. FIX: Correct the audit_role_change trigger function
CREATE OR REPLACE FUNCTION public.audit_role_change()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.audit_log (
        user_id,
        action,
        entity_type,    -- FIXED: was 'table_name' (column does not exist)
        entity_id,      -- FIXED: was 'record_id' (column does not exist)
        details
    ) VALUES (
        auth.uid(),
        TG_OP,
        'user_roles',
        COALESCE(NEW.user_id, OLD.user_id)::text,
        jsonb_build_object(
            'target_user', COALESCE(NEW.user_id, OLD.user_id),
            'new_role', NEW.role,
            'is_blocked', NEW.is_blocked
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. FIX: Re-create triggers to use fixed functions
DROP TRIGGER IF EXISTS tr_audit_invitations ON public.user_invitations;
CREATE TRIGGER tr_audit_invitations
    AFTER INSERT OR UPDATE ON public.user_invitations
    FOR EACH ROW EXECUTE FUNCTION public.audit_invitation_change();

DROP TRIGGER IF EXISTS tr_audit_roles ON public.user_roles;
CREATE TRIGGER tr_audit_roles
    AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
    FOR EACH ROW EXECUTE FUNCTION public.audit_role_change();

-- 4. FIX: RLS for user_invitations — Gerente can write without is_verified()
-- requirement during INSERT (creating invites) to avoid blocking the UI.
-- is_verified() check was too strict for operational writes.
DROP POLICY IF EXISTS "Gerente can manage invitations" ON public.user_invitations;
CREATE POLICY "Gerente can manage invitations" ON public.user_invitations
    FOR ALL TO authenticated
    USING (public.is_gerente())
    WITH CHECK (public.is_gerente());

-- 5. FIX: Ensure sales_details inserts are not blocked.
-- RLS for sales_details should allow gerente to insert/select.
-- Drop and recreate permissive write policy.
DROP POLICY IF EXISTS "Gerente can insert sales" ON public.sales_details;
CREATE POLICY "Gerente can insert sales" ON public.sales_details
    FOR INSERT TO authenticated
    WITH CHECK (public.is_gerente());

DROP POLICY IF EXISTS "Gerente can select sales" ON public.sales_details;
CREATE POLICY "Gerente can select sales" ON public.sales_details
    FOR SELECT TO authenticated
    USING (public.is_gerente());

DROP POLICY IF EXISTS "Gerente can delete sales" ON public.sales_details;
CREATE POLICY "Gerente can delete sales" ON public.sales_details
    FOR DELETE TO authenticated
    USING (public.is_gerente());

-- 6. FIX: Same for sales_targets
DROP POLICY IF EXISTS "Gerente can manage targets" ON public.sales_targets;
CREATE POLICY "Gerente can manage targets" ON public.sales_targets
    FOR ALL TO authenticated
    USING (public.is_gerente())
    WITH CHECK (public.is_gerente());

COMMENT ON FUNCTION public.audit_invitation_change() IS 'Fixed: uses entity_type/entity_id instead of non-existent table_name/record_id columns.';
