-- ============================================================
-- FIX: Email Confirmation + Duplicatas (v2)
-- confirmed_at é coluna gerada — apenas email_confirmed_at
-- Execute no SQL Editor do Supabase Dashboard
-- ============================================================

-- 1. Confirmar emails de usuários pendentes
UPDATE auth.users
SET 
    email_confirmed_at = NOW(),
    updated_at         = NOW()
WHERE email_confirmed_at IS NULL;

-- 2. UNIQUE(email) em profiles para impedir duplicatas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.profiles'::regclass
          AND conname  = 'profiles_email_unique'
    ) THEN
        -- Limpar duplicatas mantendo o mais antigo (primeiro cadastrado)
        DELETE FROM public.profiles a
        USING public.profiles b
        WHERE a.email = b.email
          AND a.email IS NOT NULL
          AND a.email != ''
          AND a.created_at > b.created_at;

        ALTER TABLE public.profiles
            ADD CONSTRAINT profiles_email_unique UNIQUE (email);

        RAISE NOTICE 'UNIQUE(email) adicionado em profiles';
    ELSE
        RAISE NOTICE 'UNIQUE(email) já existe';
    END IF;
END $$;

-- 3. Trigger para auto-confirmar emails em novos registros
CREATE OR REPLACE FUNCTION public.auto_confirm_new_user()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.email_confirmed_at IS NULL THEN
        NEW.email_confirmed_at := NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_auto_confirm ON auth.users;
CREATE TRIGGER on_auth_user_auto_confirm
    BEFORE INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_confirm_new_user();

DO $$
BEGIN
    RAISE NOTICE '✅ Email confirmation fix v2 aplicado com sucesso!';
END $$;
