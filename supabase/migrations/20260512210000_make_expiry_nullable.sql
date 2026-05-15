-- Make expiry_date nullable in inventory_lots
-- The DEP 33 sync may not always have a VTO date for all products
-- (especially non-lens consumables like OVDs, solutions, etc.)
ALTER TABLE public.inventory_lots ALTER COLUMN expiry_date DROP NOT NULL;
