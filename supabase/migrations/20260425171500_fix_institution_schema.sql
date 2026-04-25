-- ============================================================
-- MIGRATION: Fix Institution Schema Cache Error
-- Description: Adds created_by and ensures audit columns
-- ============================================================

SET search_path TO public;

-- 1. ADD AUDIT COLUMNS TO INSTITUTIONS
ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);
ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;
ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 2. ENSURE RLS (if needed, but for now we just want to fix the schema)
-- We don't want to break existing policies, so we just add the column.
