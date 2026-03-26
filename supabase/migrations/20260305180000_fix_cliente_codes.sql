-- Fix: when the 'cliente' column contains only digits (it's a code, not a name),
-- swap the values: move the wrong code to cod_cliente and set cliente to empty
-- so future re-imports will fill it correctly.
-- This also handles the case where cod_cliente was empty and cliente had the code.

UPDATE public.sales_details
SET
  cod_cliente = CASE
    WHEN cod_cliente IS NULL OR cod_cliente = '' THEN cliente
    ELSE cod_cliente
  END,
  cliente = CASE
    WHEN cliente ~ '^\d+$' THEN ''   -- cliente is only digits → clear it (was a code)
    ELSE cliente
  END
WHERE cliente ~ '^\d+$';   -- Only update rows where cliente looks like a code

-- Also ensure cod_cliente column exists (it should from original migration)
-- No-op if already exists:
ALTER TABLE public.sales_details ADD COLUMN IF NOT EXISTS cod_cliente text NOT NULL DEFAULT '';
ALTER TABLE public.sales_details ADD COLUMN IF NOT EXISTS mercado text DEFAULT 'Privado';
