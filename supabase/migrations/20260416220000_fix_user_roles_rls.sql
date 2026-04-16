-- ============================================================
-- FIX: RLS para user_roles - permitir Gerente deletar/atualizar
-- Execute no SQL Editor do Supabase Dashboard
-- ============================================================

-- Verificar políticas existentes em user_roles
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'user_roles';

-- Dropar políticas antigas que podem conflitar
DROP POLICY IF EXISTS "Gerente manages user_roles"     ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own role"        ON public.user_roles;
DROP POLICY IF EXISTS "Gerente can manage roles"       ON public.user_roles;
DROP POLICY IF EXISTS "Allow role assignment"          ON public.user_roles;
DROP POLICY IF EXISTS "gerente_manage_roles"           ON public.user_roles;

-- Habilitar RLS se não estiver habilitado
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Política: Gerente tem controle total sobre user_roles
CREATE POLICY "Gerente full access user_roles" ON public.user_roles
    FOR ALL TO authenticated
    USING (public.is_gerente())
    WITH CHECK (public.is_gerente());

-- Política: Qualquer usuário autenticado pode VER seu próprio role
CREATE POLICY "User can view own role" ON public.user_roles
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Confirmar
DO $$ BEGIN
    RAISE NOTICE '✅ RLS user_roles corrigido - Gerente pode deletar/editar roles';
END $$;
