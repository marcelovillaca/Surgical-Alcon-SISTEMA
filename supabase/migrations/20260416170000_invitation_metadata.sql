-- ============================================
-- MANUAL REGISTRATION AND USER METADATA
-- ============================================

-- 1. Add metadata to invitations for manual data pre-filling
ALTER TABLE public.user_invitations ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 2. Add email to profiles if missed earlier (redundancy check)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'email') THEN
        ALTER TABLE public.profiles ADD COLUMN email TEXT;
    END IF;
END $$;

-- 3. Reset Password Support (Conceptual for Gerente)
-- Since we can't directly reset auth passwords from SQL without Edge Functions,
-- we'll create a flag in profiles that forces a redirect in the frontend.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS reset_password_token TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS reset_password_expires TIMESTAMPTZ;

-- 4. Role list update (Gerente General label is app-side)
