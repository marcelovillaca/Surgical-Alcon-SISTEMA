-- ============================================
-- AUDIT LOGGING ENHANCEMENTS (A09)
-- Captures sensitive administrative actions
-- like invite creation and rol management.
-- ============================================

-- 1. Function to log user_invitations changes
CREATE OR REPLACE FUNCTION public.audit_invitation_change()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.audit_log (
        user_id,
        action,
        table_name,
        record_id,
        details
    ) VALUES (
        auth.uid(),
        TG_OP,
        'user_invitations',
        NEW.id,
        jsonb_build_object(
            'email', NEW.email,
            'role', NEW.role,
            'expires_at', NEW.expires_at
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger for invites
DROP TRIGGER IF EXISTS tr_audit_invitations ON public.user_invitations;
CREATE TRIGGER tr_audit_invitations
    AFTER INSERT OR UPDATE ON public.user_invitations
    FOR EACH ROW EXECUTE FUNCTION public.audit_invitation_change();

-- 3. Function to log user_roles changes (Management)
CREATE OR REPLACE FUNCTION public.audit_role_change()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.audit_log (
        user_id,
        action,
        table_name,
        record_id,
        details
    ) VALUES (
        auth.uid(),
        TG_OP,
        'user_roles',
        COALESCE(NEW.user_id, OLD.user_id),
        jsonb_build_object(
            'target_user', COALESCE(NEW.user_id, OLD.user_id),
            'new_role', NEW.role,
            'is_blocked', NEW.is_blocked
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Trigger for roles
DROP TRIGGER IF EXISTS tr_audit_roles ON public.user_roles;
CREATE TRIGGER tr_audit_roles
    AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
    FOR EACH ROW EXECUTE FUNCTION public.audit_role_change();

-- 5. Harden index.html with basic CSP Meta Tag (A10)
COMMENT ON TABLE public.audit_log IS 'System-wide audit trail for security-critical actions (A09).';
