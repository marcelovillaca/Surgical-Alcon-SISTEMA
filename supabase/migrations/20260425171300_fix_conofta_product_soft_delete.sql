-- ============================================================
-- MIGRATION: Fix CONOFTA Product Soft Delete
-- Description: Adds active column to conofta_products
-- ============================================================

SET search_path TO public;

ALTER TABLE public.conofta_products ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;
