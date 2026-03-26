-- ============================================
-- CONOFTA WAITLIST & SURGICAL SCHEDULING
-- ============================================

-- 1. ADD NEW ROLE TO app_role (If not already present)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'app_role' AND e.enumlabel = 'hospital_externo') THEN
        ALTER TYPE public.app_role ADD VALUE 'hospital_externo';
    END IF;
END $$;

-- 2. PATIENTS TABLE (Central registry)
CREATE TABLE IF NOT EXISTS public.conofta_patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cedula TEXT NOT NULL UNIQUE,
    firstname TEXT NOT NULL,
    lastname TEXT NOT NULL,
    address TEXT,
    city TEXT,
    phone TEXT,
    email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. WAITLIST STATUS ENUM
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'waitlist_status') THEN
        CREATE TYPE public.waitlist_status AS ENUM ('pendente', 'apto', 'agendado', 'operado', 'cancelado');
    END IF;
END $$;

-- 4. WAITLIST TABLE
CREATE TABLE IF NOT EXISTS public.conofta_waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES public.conofta_patients(id) ON DELETE CASCADE NOT NULL,
    institution_id UUID REFERENCES public.institutions(id) NOT NULL, -- Hospital de origem
    assigned_institution_id UUID REFERENCES public.institutions(id), -- Onde a cirurgia será feita
    status waitlist_status NOT NULL DEFAULT 'pendente',
    pre_surgical_data JSONB DEFAULT '{}',
    exams_data JSONB DEFAULT '{}',
    request_file_url TEXT, -- URL para o PDF de solicitação
    aptitude_file_url TEXT, -- URL para o PDF de aptidão
    journey_id UUID, -- Referência futura para conofta_journeys
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. JOURNEYS TABLE
CREATE TABLE IF NOT EXISTS public.conofta_journeys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    date DATE NOT NULL,
    institution_id UUID REFERENCES public.institutions(id) NOT NULL,
    max_capacity INTEGER DEFAULT 20,
    description TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. AUDIT LOG TRIGGER FUNCTION
-- This tracks status changes and centre movements
CREATE OR REPLACE FUNCTION public.audit_waitlist_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE') THEN
        IF (OLD.status IS DISTINCT FROM NEW.status OR OLD.assigned_institution_id IS DISTINCT FROM NEW.assigned_institution_id) THEN
            INSERT INTO public.audit_log (user_id, action, entity_type, entity_id, details)
            VALUES (
                auth.uid(),
                'UPDATE_WAITLIST',
                'conofta_waitlist',
                NEW.id,
                jsonb_build_object(
                    'old_status', OLD.status,
                    'new_status', NEW.status,
                    'old_assigned_centre', OLD.assigned_institution_id,
                    'new_assigned_centre', NEW.assigned_institution_id
                )
            );
        END IF;
    ELSIF (TG_OP = 'INSERT') THEN
         INSERT INTO public.audit_log (user_id, action, entity_type, entity_id, details)
            VALUES (
                auth.uid(),
                'CREATE_WAITLIST',
                'conofta_waitlist',
                NEW.id,
                jsonb_build_object('status', NEW.status, 'patient_id', NEW.patient_id)
            );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if trigger exists before creating
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_waitlist_change') THEN
        CREATE TRIGGER on_waitlist_change
            AFTER INSERT OR UPDATE ON public.conofta_waitlist
            FOR EACH ROW EXECUTE FUNCTION public.audit_waitlist_changes();
    END IF;
END $$;

-- 7. ENABLE RLS
ALTER TABLE public.conofta_patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conofta_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conofta_journeys ENABLE ROW LEVEL SECURITY;

-- 8. RLS POLICIES

-- Drop existing if any for idempotency
DROP POLICY IF EXISTS "Admin manages all patients" ON public.conofta_patients;
DROP POLICY IF EXISTS "External Hospital can manage patients via waitlist" ON public.conofta_patients;
DROP POLICY IF EXISTS "Admin manages all waitlist" ON public.conofta_waitlist;
DROP POLICY IF EXISTS "Hospital sees its own waitlist" ON public.conofta_waitlist;
DROP POLICY IF EXISTS "Hospital inserts its own waitlist" ON public.conofta_waitlist;
DROP POLICY IF EXISTS "Admin manages journeys" ON public.conofta_journeys;
DROP POLICY IF EXISTS "Everyone reads journeys" ON public.conofta_journeys;

-- Patients
CREATE POLICY "Admin manages all patients" ON public.conofta_patients FOR ALL USING (public.is_gerente());
CREATE POLICY "External Hospital can manage patients via waitlist" ON public.conofta_patients FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.conofta_waitlist 
        WHERE conofta_waitlist.patient_id = conofta_patients.id 
        AND conofta_waitlist.institution_id IN (
            SELECT institution_id FROM public.client_institutions ci
            JOIN public.clients c ON ci.client_id = c.id
            WHERE c.assigned_to = auth.uid()
        )
    )
);

-- Waitlist
CREATE POLICY "Admin manages all waitlist" ON public.conofta_waitlist FOR ALL USING (public.is_gerente());
CREATE POLICY "Hospital sees its own waitlist" ON public.conofta_waitlist FOR SELECT
USING (
    institution_id IN (
        SELECT ci.institution_id FROM public.client_institutions ci
        JOIN public.clients c ON ci.client_id = c.id
        WHERE c.assigned_to = auth.uid()
    )
);
CREATE POLICY "Hospital inserts its own waitlist" ON public.conofta_waitlist FOR INSERT
WITH CHECK (
    institution_id IN (
        SELECT ci.institution_id FROM public.client_institutions ci
        JOIN public.clients c ON ci.client_id = c.id
        WHERE c.assigned_to = auth.uid()
    )
);

-- Journeys
CREATE POLICY "Admin manages journeys" ON public.conofta_journeys FOR ALL USING (public.is_gerente());
CREATE POLICY "Everyone reads journeys" ON public.conofta_journeys FOR SELECT TO authenticated USING (true);

-- 10. STORAGE BUCKET FOR MEDICAL DOCUMENTS
-- Note: Buckets are managed in the 'storage' schema
INSERT INTO storage.buckets (id, name, public) 
VALUES ('conofta_documents', 'conofta_documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies
DROP POLICY IF EXISTS "Admin has full access to documents" ON storage.objects;
DROP POLICY IF EXISTS "Hospitals can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Hospitals can read their own documents" ON storage.objects;

CREATE POLICY "Admin has full access to documents"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'conofta_documents' AND public.is_gerente());

CREATE POLICY "Hospitals can upload documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'conofta_documents' 
    AND (storage.foldername(name))[1] IN (
        SELECT ci.institution_id::text FROM public.client_institutions ci
        JOIN public.clients c ON ci.client_id = c.id
        WHERE c.assigned_to = auth.uid()
    )
);

CREATE POLICY "Hospitals can read their own documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'conofta_documents' 
    AND (storage.foldername(name))[1] IN (
        SELECT ci.institution_id::text FROM public.client_institutions ci
        JOIN public.clients c ON ci.client_id = c.id
        WHERE c.assigned_to = auth.uid()
    )
);
-- 11. TRIGGERS FOR UPDATED_AT
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_conofta_patients_updated_at') THEN
        CREATE TRIGGER update_conofta_patients_updated_at BEFORE UPDATE ON public.conofta_patients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_conofta_waitlist_updated_at') THEN
        CREATE TRIGGER update_conofta_waitlist_updated_at BEFORE UPDATE ON public.conofta_waitlist FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;
