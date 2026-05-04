-- ============================================================
-- MIGRATION: Link CONOFTA tables to conofta_institutions
-- Date: 2026-05-04
-- Description: 
--   Final step of the CONOFTA ↔ Alcon CRM separation.
--   Drops old FK constraints pointing to `institutions` (Alcon CRM),
--   migrates IDs by name matching, then re-creates FKs pointing to
--   the dedicated `conofta_institutions` table.
--   Also cleans up duplicate CONOFTA entries from Alcon's `institutions`.
-- Status: APPLIED ✅ (executed manually via Supabase SQL Editor)
-- ============================================================

BEGIN;

-- ============================================================
-- STEP 1: Drop old FK constraints (pointing to Alcon institutions)
-- ============================================================
ALTER TABLE public.conofta_waitlist 
  DROP CONSTRAINT IF EXISTS conofta_waitlist_institution_id_fkey,
  DROP CONSTRAINT IF EXISTS conofta_waitlist_assigned_institution_id_fkey;

ALTER TABLE public.conofta_inventory 
  DROP CONSTRAINT IF EXISTS conofta_inventory_institution_id_fkey;

ALTER TABLE public.conofta_stock_movements 
  DROP CONSTRAINT IF EXISTS conofta_stock_movements_institution_id_fkey;

ALTER TABLE public.conofta_journeys 
  DROP CONSTRAINT IF EXISTS conofta_journeys_institution_id_fkey;

-- ============================================================
-- STEP 2: Update IDs by matching institution names
-- ============================================================

-- 2a. Waitlist → institution_id
UPDATE public.conofta_waitlist w
SET institution_id = ci.id
FROM public.institutions i
JOIN public.conofta_institutions ci ON LOWER(TRIM(ci.name)) = LOWER(TRIM(i.name))
WHERE w.institution_id = i.id
  AND ci.id IS NOT NULL;

-- 2b. Waitlist → assigned_institution_id
UPDATE public.conofta_waitlist w
SET assigned_institution_id = ci.id
FROM public.institutions i
JOIN public.conofta_institutions ci ON LOWER(TRIM(ci.name)) = LOWER(TRIM(i.name))
WHERE w.assigned_institution_id = i.id
  AND ci.id IS NOT NULL;

-- 2c. Inventory
UPDATE public.conofta_inventory inv
SET institution_id = ci.id
FROM public.institutions i
JOIN public.conofta_institutions ci ON LOWER(TRIM(ci.name)) = LOWER(TRIM(i.name))
WHERE inv.institution_id = i.id
  AND ci.id IS NOT NULL;

-- 2d. Stock movements
UPDATE public.conofta_stock_movements sm
SET institution_id = ci.id
FROM public.institutions i
JOIN public.conofta_institutions ci ON LOWER(TRIM(ci.name)) = LOWER(TRIM(i.name))
WHERE sm.institution_id = i.id
  AND ci.id IS NOT NULL;

-- 2e. Journeys
UPDATE public.conofta_journeys j
SET institution_id = ci.id
FROM public.institutions i
JOIN public.conofta_institutions ci ON LOWER(TRIM(ci.name)) = LOWER(TRIM(i.name))
WHERE j.institution_id = i.id
  AND ci.id IS NOT NULL;

-- ============================================================
-- STEP 3: Add new FK constraints → conofta_institutions
-- ============================================================
ALTER TABLE public.conofta_waitlist
  ADD CONSTRAINT conofta_waitlist_institution_id_fkey 
    FOREIGN KEY (institution_id) REFERENCES public.conofta_institutions(id),
  ADD CONSTRAINT conofta_waitlist_assigned_institution_id_fkey 
    FOREIGN KEY (assigned_institution_id) REFERENCES public.conofta_institutions(id);

ALTER TABLE public.conofta_inventory
  ADD CONSTRAINT conofta_inventory_institution_id_fkey 
    FOREIGN KEY (institution_id) REFERENCES public.conofta_institutions(id);

ALTER TABLE public.conofta_stock_movements
  ADD CONSTRAINT conofta_stock_movements_institution_id_fkey 
    FOREIGN KEY (institution_id) REFERENCES public.conofta_institutions(id);

ALTER TABLE public.conofta_journeys
  ADD CONSTRAINT conofta_journeys_institution_id_fkey 
    FOREIGN KEY (institution_id) REFERENCES public.conofta_institutions(id);

-- ============================================================
-- STEP 4: Cleanup — remove CONOFTA duplicates from Alcon CRM
-- ============================================================
DELETE FROM public.institutions WHERE name ILIKE 'CONOFTA%';

COMMIT;

NOTIFY pgrst, 'reload schema';
