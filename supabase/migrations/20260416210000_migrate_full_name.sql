-- ============================================================
-- FIX: Migrar full_name → firstname + lastname
-- CORRIGIDO: profiles usa 'id' (não 'user_id') em produção
-- ============================================================

-- Separar full_name em firstname + lastname para usuários existentes
UPDATE public.profiles
SET
    firstname = CASE
        WHEN full_name IS NOT NULL AND TRIM(full_name) != '' THEN
            SPLIT_PART(TRIM(full_name), ' ', 1)
        ELSE firstname
    END,
    lastname = CASE
        WHEN full_name IS NOT NULL AND TRIM(full_name) != ''
             AND POSITION(' ' IN TRIM(full_name)) > 0 THEN
            TRIM(SUBSTRING(TRIM(full_name) FROM POSITION(' ' IN TRIM(full_name)) + 1))
        ELSE lastname
    END
WHERE (firstname IS NULL OR firstname = '')
  AND full_name IS NOT NULL
  AND TRIM(full_name) != '';

-- Verificar resultado (usando 'id' - a FK correta neste schema)
SELECT id, full_name, firstname, lastname, email
FROM public.profiles
ORDER BY created_at DESC
LIMIT 20;
