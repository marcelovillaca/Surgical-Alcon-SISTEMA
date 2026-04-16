-- ============================================================
-- FIX: Limpar registros órfãos em user_roles + RLS para delete
-- Execute no SQL Editor do Supabase Dashboard
-- ============================================================

-- 1. Ver o que está em user_roles (diagnóstico)
SELECT ur.id, ur.user_id, ur.role, ur.is_blocked,
       u.email as auth_email
FROM public.user_roles ur
LEFT JOIN auth.users u ON u.id = ur.user_id
ORDER BY ur.role;

-- 2. Deletar registros onde user_id não existe em auth.users
--    (esses são os registros "fantasma" que causam o erro)
DELETE FROM public.user_roles
WHERE user_id IS NULL
   OR user_id NOT IN (SELECT id FROM auth.users);

-- 3. RLS: Gerente pode fazer tudo em user_roles
DROP POLICY IF EXISTS "Gerente full access user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "User can view own role"          ON public.user_roles;
DROP POLICY IF EXISTS "Gerente manages user_roles"     ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own role"        ON public.user_roles;
DROP POLICY IF EXISTS "gerente_manage_roles"           ON public.user_roles;
DROP POLICY IF EXISTS "Allow role assignment"          ON public.user_roles;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Gerente: controle total
CREATE POLICY "Gerente full access user_roles" ON public.user_roles
    FOR ALL TO authenticated
    USING (public.is_gerente())
    WITH CHECK (public.is_gerente());

-- Usuário: lê o próprio role
CREATE POLICY "User can view own role" ON public.user_roles
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- 4. Confirmar resultado
SELECT ur.user_id, ur.role, u.email
FROM public.user_roles ur
JOIN auth.users u ON u.id = ur.user_id;
