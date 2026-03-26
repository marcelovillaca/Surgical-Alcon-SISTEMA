-- Add 'ovds_and_solutions' to product_line enum if it exists, otherwise create it
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_line') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'product_line'::regtype AND enumlabel = 'ovds_and_solutions') THEN
            ALTER TYPE product_line ADD VALUE 'ovds_and_solutions';
        END IF;
    ELSE
        CREATE TYPE product_line AS ENUM ('total_monofocals', 'vit_ret_paks', 'phaco_paks', 'ovds_and_solutions', 'equipment', 'atiols', 'rest_of_portfolio');
    END IF;
END $$;

-- Ensure products table exists
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    product_line product_line NOT NULL,
    cost_pyg NUMERIC(15,2) DEFAULT 0,
    price_base_pyg NUMERIC(15,2) DEFAULT 0,
    unit_of_measure TEXT DEFAULT 'unidad',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure inventory_lots table exists and has dioptria/toricidad
CREATE TABLE IF NOT EXISTS public.inventory_lots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    lot_number TEXT NOT NULL,
    quantity INTEGER DEFAULT 0,
    expiry_date DATE NOT NULL,
    dioptria TEXT, -- Factor for lenses
    toricidad TEXT, -- Factor for lenses
    cost_unit_pyg NUMERIC(15,2) DEFAULT 0,
    price_base_pyg NUMERIC(15,2) DEFAULT 0,
    serial_number TEXT,
    status TEXT DEFAULT 'available',
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add columns to existing table if they were somehow missing but table existed
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory_lots' AND column_name='dioptria') THEN
        ALTER TABLE public.inventory_lots ADD COLUMN dioptria TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory_lots' AND column_name='toricidad') THEN
        ALTER TABLE public.inventory_lots ADD COLUMN toricidad TEXT;
    END IF;
END $$;

-- Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_lots ENABLE ROW LEVEL SECURITY;

-- Policies for products
DROP POLICY IF EXISTS "Public read products" ON public.products;
CREATE POLICY "Public read products" ON public.products FOR SELECT USING (true);

DROP POLICY IF EXISTS "Manager write products" ON public.products;
CREATE POLICY "Manager write products" ON public.products FOR ALL 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'gerente'))
WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'gerente'));

-- Policies for inventory_lots
DROP POLICY IF EXISTS "Public read lots" ON public.inventory_lots;
CREATE POLICY "Public read lots" ON public.inventory_lots FOR SELECT USING (true);

DROP POLICY IF EXISTS "Manager write lots" ON public.inventory_lots;
CREATE POLICY "Manager write lots" ON public.inventory_lots FOR ALL 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'gerente'))
WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'gerente'));

-- Enable realtime for these tables
-- We use a DO block because adding to a publication might fail if it already exists or if the publication doesn't exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        -- Check if it's already in the publication
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'products') THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'inventory_lots') THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_lots;
        END IF;
    END IF;
END $$;
