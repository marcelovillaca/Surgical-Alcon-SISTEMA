-- ============================================
-- UNIQUE CODES AND SCHEMA SIMPLIFICATION
-- ============================================

-- 1. Helper function to generate unique alpha-numeric codes
CREATE OR REPLACE FUNCTION public.generate_unique_code(prefix TEXT DEFAULT '') 
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Removed confusing chars like 0, O, I, 1
    result TEXT := '';
    i INTEGER := 0;
BEGIN
    FOR i IN 1..6 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    RETURN prefix || result;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- 2. Add unique_code column to core tables if not exists
DO $$ 
BEGIN
    -- Patients
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conofta_patients' AND column_name = 'unique_code') THEN
        ALTER TABLE public.conofta_patients ADD COLUMN unique_code TEXT UNIQUE DEFAULT public.generate_unique_code('P-');
    END IF;

    -- Institutions
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'institutions' AND column_name = 'unique_code') THEN
        ALTER TABLE public.institutions ADD COLUMN unique_code TEXT UNIQUE DEFAULT public.generate_unique_code('S-');
    END IF;

    -- Products
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'conofta_products') THEN
        CREATE TABLE public.conofta_products (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT NOT NULL,
            sku TEXT,
            category TEXT,
            unit TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            unique_code TEXT UNIQUE DEFAULT public.generate_unique_code('IT-'),
            created_at TIMESTAMPTZ DEFAULT now()
        );
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conofta_products' AND column_name = 'unique_code') THEN
        ALTER TABLE public.conofta_products ADD COLUMN unique_code TEXT UNIQUE DEFAULT public.generate_unique_code('IT-');
    END IF;

    -- Update waitlist for simplified Pre-Op and Diopter
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conofta_waitlist' AND column_name = 'exam_preop_complete') THEN
        ALTER TABLE public.conofta_waitlist ADD COLUMN exam_preop_complete BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conofta_waitlist' AND column_name = 'dioptria') THEN
        ALTER TABLE public.conofta_waitlist ADD COLUMN dioptria NUMERIC;
    END IF;

    -- Surgeon/Requesting Doctor synchronization support
    -- We'll handle this in the application layer, but let's ensure surgeon_id is flexible
END $$;
