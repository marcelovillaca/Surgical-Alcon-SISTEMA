
-- Add new visit types to the enum
ALTER TYPE public.visit_type ADD VALUE IF NOT EXISTS 'promocion_producto';
ALTER TYPE public.visit_type ADD VALUE IF NOT EXISTS 'soporte_tecnico_clinico';
ALTER TYPE public.visit_type ADD VALUE IF NOT EXISTS 'entrenamiento_capacitacion';
ALTER TYPE public.visit_type ADD VALUE IF NOT EXISTS 'gestion_relacion';
ALTER TYPE public.visit_type ADD VALUE IF NOT EXISTS 'seguimiento_oportunidades';
ALTER TYPE public.visit_type ADD VALUE IF NOT EXISTS 'postventa_incidencias';

-- Add lens-specific fields to order_items
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS dioptria text;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS toricidad text;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS notes text;
