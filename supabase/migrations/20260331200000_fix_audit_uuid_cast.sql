-- ============================================
-- FIX v2: Correct entity_id cast (UUID, not text)
-- Previous fix used ::text but entity_id is UUID type
-- ============================================

-- 1. FIX audit_invitation_change: cast NEW.id to UUID (it already is, no cast needed)
CREATE OR REPLACE FUNCTION public.audit_invitation_change()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.audit_log (
        user_id,
        action,
        entity_type,
        entity_id,   -- column is UUID type
        details
    ) VALUES (
        auth.uid(),
        TG_OP,
        'user_invitations',
        NEW.id,       -- NEW.id is already UUID, no cast needed
        jsonb_build_object(
            'email', NEW.email,
            'role', NEW.role,
            'expires_at', NEW.expires_at
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. FIX audit_role_change: cast to UUID explicitly
CREATE OR REPLACE FUNCTION public.audit_role_change()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.audit_log (
        user_id,
        action,
        entity_type,
        entity_id,   -- column is UUID type
        details
    ) VALUES (
        auth.uid(),
        TG_OP,
        'user_roles',
        COALESCE(NEW.user_id, OLD.user_id),  -- already UUID
        jsonb_build_object(
            'target_user', COALESCE(NEW.user_id, OLD.user_id),
            'new_role', NEW.role
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Re-create triggers
DROP TRIGGER IF EXISTS tr_audit_invitations ON public.user_invitations;
CREATE TRIGGER tr_audit_invitations
    AFTER INSERT OR UPDATE ON public.user_invitations
    FOR EACH ROW EXECUTE FUNCTION public.audit_invitation_change();

DROP TRIGGER IF EXISTS tr_audit_roles ON public.user_roles;
CREATE TRIGGER tr_audit_roles
    AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
    FOR EACH ROW EXECUTE FUNCTION public.audit_role_change();

-- 4. Fix RLS for user_invitations
DROP POLICY IF EXISTS "Gerente can manage invitations" ON public.user_invitations;
CREATE POLICY "Gerente can manage invitations" ON public.user_invitations
    FOR ALL TO authenticated
    USING (public.is_gerente())
    WITH CHECK (public.is_gerente());

-- 5. Fix RLS for sales_details (gerente can insert/select/delete)
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

-- 6. Fix RLS for sales_targets
DROP POLICY IF EXISTS "Gerente can manage targets" ON public.sales_targets;
CREATE POLICY "Gerente can manage targets" ON public.sales_targets
    FOR ALL TO authenticated
    USING (public.is_gerente())
    WITH CHECK (public.is_gerente());

-- 7. Set Marcello as gerente
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'gerente'
FROM auth.users
WHERE email = 'marcelo.villaca@hotmail.com'
ON CONFLICT (user_id) DO UPDATE SET role = 'gerente', is_blocked = false;

-- 8. Also create the conofta_revenue_config table
CREATE TABLE IF NOT EXISTS public.conofta_revenue_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    anio INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM NOW()),
    sucursal TEXT,
    tipo_cirugia TEXT NOT NULL,
    ingreso_por_cirugia NUMERIC(12,2) NOT NULL DEFAULT 0,
    moneda TEXT DEFAULT 'USD',
    notas TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by TEXT,
    CONSTRAINT conofta_revenue_config_unique UNIQUE (anio, sucursal, tipo_cirugia)
);

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

INSERT INTO public.conofta_revenue_config (anio, tipo_cirugia, ingreso_por_cirugia, moneda, notas)
VALUES 
    (2025, 'Catarata', 0, 'USD', 'Actualizar con valor real'),
    (2025, 'Retina',   0, 'USD', 'Actualizar con valor real'),
    (2026, 'Catarata', 0, 'USD', 'Actualizar con valor real'),
    (2026, 'Retina',   0, 'USD', 'Actualizar con valor real')
ON CONFLICT ON CONSTRAINT conofta_revenue_config_unique DO NOTHING;
