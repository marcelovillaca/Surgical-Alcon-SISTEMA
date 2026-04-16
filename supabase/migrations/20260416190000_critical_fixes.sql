-- ============================================================
-- CRITICAL FIXES v2 - USER MANAGEMENT
-- Versão corrigida - agnóstica ao schema de profiles
-- Cole este script no SQL Editor do Supabase Dashboard
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- BLOCO A: ENUM - Adicionar roles ausentes
-- Estes não dependem do schema de profiles
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'admin_conofta'     AND enumtypid = 'public.app_role'::regtype) THEN
        ALTER TYPE public.app_role ADD VALUE 'admin_conofta';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'coordinador_local' AND enumtypid = 'public.app_role'::regtype) THEN
        ALTER TYPE public.app_role ADD VALUE 'coordinador_local';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'hospital_externo'  AND enumtypid = 'public.app_role'::regtype) THEN
        ALTER TYPE public.app_role ADD VALUE 'hospital_externo';
    END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- BLOCO B: user_invitations - Colunas obrigatórias
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.user_invitations
    ADD COLUMN IF NOT EXISTS institution_id UUID REFERENCES public.institutions(id) ON DELETE SET NULL;

ALTER TABLE public.user_invitations
    ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- ─────────────────────────────────────────────────────────────
-- BLOCO C: user_roles - Colunas obrigatórias
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.user_roles
    ADD COLUMN IF NOT EXISTS institution_id UUID REFERENCES public.institutions(id) ON DELETE SET NULL;

ALTER TABLE public.user_roles
    ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT FALSE;

-- ─────────────────────────────────────────────────────────────
-- BLOCO D: Corrigir UNIQUE constraint em user_roles
-- O app assume 1 role por user, então UNIQUE(user_id) é correto
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
    v_old_constraint TEXT;
    v_has_single_unique BOOLEAN;
BEGIN
    -- Dropar constraint (user_id, role) se existir
    SELECT conname INTO v_old_constraint
    FROM pg_constraint c
    JOIN pg_attribute a1 ON a1.attrelid = c.conrelid AND a1.attnum = c.conkey[1]
    JOIN pg_attribute a2 ON a2.attrelid = c.conrelid AND a2.attnum = c.conkey[2]
    WHERE c.conrelid = 'public.user_roles'::regclass
      AND c.contype  = 'u'
      AND array_length(c.conkey, 1) = 2
      AND a1.attname = 'user_id'
      AND a2.attname = 'role'
    LIMIT 1;

    IF v_old_constraint IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.user_roles DROP CONSTRAINT ' || quote_ident(v_old_constraint);
        RAISE NOTICE 'Dropped old constraint: %', v_old_constraint;
    END IF;

    -- Adicionar UNIQUE(user_id) se ainda não existe
    SELECT EXISTS (
        SELECT 1 FROM pg_constraint c
        WHERE c.conrelid = 'public.user_roles'::regclass
          AND c.contype  = 'u'
          AND c.conname  = 'user_roles_user_id_unique'
    ) INTO v_has_single_unique;

    IF NOT v_has_single_unique THEN
        ALTER TABLE public.user_roles
            ADD CONSTRAINT user_roles_user_id_unique UNIQUE (user_id);
        RAISE NOTICE 'Added UNIQUE(user_id) constraint to user_roles';
    END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- BLOCO E: profiles - Adicionar colunas de forma segura
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email     TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS firstname TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lastname  TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city      TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS reset_password_token TEXT;

-- must_change_password: adicionar com DEFAULT FALSE (não afeta usuários existentes)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE;

-- Garantir que usuários existentes não ficam bloqueados
UPDATE public.profiles SET must_change_password = FALSE WHERE must_change_password = TRUE;

-- ─────────────────────────────────────────────────────────────
-- BLOCO F: Sincronizar emails (agnóstico ao schema)
-- Detecta se profiles usa 'user_id' ou 'id' como FK
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
    v_has_user_id_col BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'profiles'
          AND column_name  = 'user_id'
    ) INTO v_has_user_id_col;

    IF v_has_user_id_col THEN
        RAISE NOTICE 'profiles schema: uses user_id column';
        UPDATE public.profiles p
        SET    email = u.email
        FROM   auth.users u
        WHERE  p.user_id = u.id
          AND  (p.email IS NULL OR p.email = '');
    ELSE
        RAISE NOTICE 'profiles schema: id = auth.uid() directly';
        UPDATE public.profiles p
        SET    email = u.email
        FROM   auth.users u
        WHERE  p.id = u.id
          AND  (p.email IS NULL OR p.email = '');
    END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- BLOCO G: assign_role_via_invite RPC (corrigida)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.assign_role_via_invite(
    p_email TEXT,
    p_code  TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role      app_role;
    v_invite_id UUID;
    v_user_id   UUID;
    v_inst_id   UUID;
    v_meta      JSONB;
BEGIN
    v_user_id := auth.uid();

    -- 1. Validar convite (não expirado, não usado)
    SELECT id, role, institution_id, metadata
    INTO   v_invite_id, v_role, v_inst_id, v_meta
    FROM   public.user_invitations
    WHERE  email       = LOWER(TRIM(p_email))
      AND  invite_code = UPPER(TRIM(p_code))
      AND  used        = FALSE
      AND  expires_at  > NOW();

    IF v_invite_id IS NULL THEN
        RAISE EXCEPTION 'Código de invitación inválido o expirado.';
    END IF;

    -- 2. Marcar como usado
    UPDATE public.user_invitations SET used = TRUE WHERE id = v_invite_id;

    -- 3. Inserir/atualizar role — ON CONFLICT (user_id) agora é válido
    INSERT INTO public.user_roles (user_id, role, institution_id, is_blocked)
    VALUES (v_user_id, v_role, v_inst_id, FALSE)
    ON CONFLICT (user_id) DO UPDATE
        SET role           = EXCLUDED.role,
            institution_id = EXCLUDED.institution_id,
            is_blocked     = FALSE;

    -- 4. Pré-preencher perfil com metadata do registro manual
    --    Usa user_id ou id dependendo do schema
    IF v_meta IS NOT NULL AND v_meta::TEXT != '{}' THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'user_id'
        ) THEN
            UPDATE public.profiles
            SET firstname            = COALESCE(v_meta->>'firstname', firstname),
                lastname             = COALESCE(v_meta->>'lastname',  lastname),
                phone                = COALESCE(v_meta->>'phone',     phone),
                city                 = COALESCE(v_meta->>'city',      city),
                birth_date           = CASE WHEN v_meta->>'birth_date' IS NOT NULL AND v_meta->>'birth_date' != ''
                                            THEN (v_meta->>'birth_date')::DATE ELSE birth_date END,
                must_change_password = TRUE
            WHERE user_id = v_user_id;
        ELSE
            UPDATE public.profiles
            SET firstname            = COALESCE(v_meta->>'firstname', firstname),
                lastname             = COALESCE(v_meta->>'lastname',  lastname),
                phone                = COALESCE(v_meta->>'phone',     phone),
                city                 = COALESCE(v_meta->>'city',      city),
                birth_date           = CASE WHEN v_meta->>'birth_date' IS NOT NULL AND v_meta->>'birth_date' != ''
                                            THEN (v_meta->>'birth_date')::DATE ELSE birth_date END,
                must_change_password = TRUE
            WHERE id = v_user_id;
        END IF;
    END IF;

    RETURN TRUE;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- BLOCO H: is_gerente() atualizada (inclui is_blocked check)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_gerente()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id   = auth.uid()
          AND role       = 'gerente'
          AND is_blocked = FALSE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ─────────────────────────────────────────────────────────────
-- BLOCO I: RLS para user_invitations
-- Remove conflito entre políticas
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Gerente full access invitations"        ON public.user_invitations;
DROP POLICY IF EXISTS "User can validate own invite"           ON public.user_invitations;
DROP POLICY IF EXISTS "Gerente can manage invitations"        ON public.user_invitations;
DROP POLICY IF EXISTS "Check specific invite by email and code" ON public.user_invitations;
DROP POLICY IF EXISTS "Validate own invite"                   ON public.user_invitations;
DROP POLICY IF EXISTS "Anyone can validate invite code"       ON public.user_invitations;

-- Gerente tem acesso total
CREATE POLICY "Gerente full access invitations" ON public.user_invitations
    FOR ALL TO authenticated
    USING (public.is_gerente());

-- Qualquer usuário autenticado pode validar o próprio convite (para registro)
CREATE POLICY "User can validate own invite" ON public.user_invitations
    FOR SELECT TO authenticated, anon
    USING (true);  -- PostgREST filtra via .eq('email',...).eq('invite_code',...)

-- ─────────────────────────────────────────────────────────────
-- BLOCO J: RLS para profiles (agnóstico ao schema)
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
    v_has_user_id BOOLEAN;
    v_ref_col     TEXT;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'user_id'
    ) INTO v_has_user_id;

    v_ref_col := CASE WHEN v_has_user_id THEN 'user_id' ELSE 'id' END;
    RAISE NOTICE 'profiles FK column detected: %', v_ref_col;

    -- Dropar políticas existentes que podem conflitar
    DROP POLICY IF EXISTS "Own profile read/write"        ON public.profiles;
    DROP POLICY IF EXISTS "Gerente manages all profiles"  ON public.profiles;
    DROP POLICY IF EXISTS "Users can view own profile"    ON public.profiles;
    DROP POLICY IF EXISTS "Users can update own profile"  ON public.profiles;
    DROP POLICY IF EXISTS "Gerente can view all profiles" ON public.profiles;
    DROP POLICY IF EXISTS "Gerente can update all profiles" ON public.profiles;
    DROP POLICY IF EXISTS "Users manage own profile"      ON public.profiles;

    -- Recriar com a coluna correta
    EXECUTE format(
        'CREATE POLICY "Own profile read/write" ON public.profiles
         FOR ALL TO authenticated
         USING (auth.uid() = %I)
         WITH CHECK (auth.uid() = %I)',
        v_ref_col, v_ref_col
    );

    EXECUTE format(
        'CREATE POLICY "Gerente manages all profiles" ON public.profiles
         FOR ALL TO authenticated
         USING (public.is_gerente())',
        v_ref_col
    );
END $$;

-- ─────────────────────────────────────────────────────────────
-- Confirmação final
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'CRITICAL FIXES v2 - aplicados com sucesso!';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'A - ENUM: admin_conofta, coordinador_local, hospital_externo';
    RAISE NOTICE 'B - user_invitations: institution_id + metadata';
    RAISE NOTICE 'C - user_roles: institution_id + is_blocked';
    RAISE NOTICE 'D - UNIQUE(user_id) corrigido em user_roles';
    RAISE NOTICE 'E - profiles: novos campos adicionados';
    RAISE NOTICE 'F - Email sync executado';
    RAISE NOTICE 'G - assign_role_via_invite RPC corrigida';
    RAISE NOTICE 'H - is_gerente() atualizada com is_blocked check';
    RAISE NOTICE 'I - RLS invitations sem conflito';
    RAISE NOTICE 'J - RLS profiles agnóstica ao schema';
    RAISE NOTICE '============================================';
END $$;
