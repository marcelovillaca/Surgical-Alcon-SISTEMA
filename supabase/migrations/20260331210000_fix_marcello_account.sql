-- ============================================
-- FIX: Create/Reset Marcello's real Supabase account
-- Run this in Supabase SQL Editor
-- ============================================

-- STEP 1: Check if user already exists in auth.users
SELECT id, email, email_confirmed_at, created_at
FROM auth.users
WHERE email = 'marcelo.villaca@hotmail.com';

-- STEP 2: If the user exists but email is not confirmed, confirm it
UPDATE auth.users
SET email_confirmed_at = NOW(),
    updated_at = NOW()
WHERE email = 'marcelo.villaca@hotmail.com'
  AND email_confirmed_at IS NULL;

-- STEP 3: Ensure the user has gerente role
-- (safe upsert - runs even if user already has a role)
INSERT INTO public.user_roles (user_id, role, is_blocked)
SELECT id, 'gerente', false
FROM auth.users
WHERE email = 'marcelo.villaca@hotmail.com'
ON CONFLICT (user_id) DO UPDATE SET role = 'gerente', is_blocked = false;

-- STEP 4: Ensure profile exists
INSERT INTO public.profiles (user_id, full_name)
SELECT id, 'Marcelo Villaca'
FROM auth.users
WHERE email = 'marcelo.villaca@hotmail.com'
ON CONFLICT (user_id) DO UPDATE SET full_name = 'Marcelo Villaca';

-- STEP 5: Verify everything looks good
SELECT 
    u.id,
    u.email,
    u.email_confirmed_at,
    r.role,
    r.is_blocked,
    p.full_name
FROM auth.users u
LEFT JOIN public.user_roles r ON r.user_id = u.id
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE u.email = 'marcelo.villaca@hotmail.com';
