-- ============================================
-- CONOFTA WAITLIST — ADD MISSING COLUMNS
-- Adds all columns required by the surgical
-- scheduling flow that were missing from the
-- original migration.
-- ============================================

-- 1. Expand the waitlist_status enum if needed
DO $$
BEGIN
    -- Add 'informado' if missing
    IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
                   WHERE t.typname = 'waitlist_status' AND e.enumlabel = 'informado') THEN
        ALTER TYPE public.waitlist_status ADD VALUE 'informado' AFTER 'pendente';
    END IF;
    -- Add 'concluido' if missing
    IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
                   WHERE t.typname = 'waitlist_status' AND e.enumlabel = 'concluido') THEN
        ALTER TYPE public.waitlist_status ADD VALUE 'concluido' AFTER 'operado';
    END IF;
END $$;

-- 2. Add all missing columns to conofta_waitlist
ALTER TABLE public.conofta_waitlist
    ADD COLUMN IF NOT EXISTS target_eye          TEXT        CHECK (target_eye IN ('OD', 'OS')),
    ADD COLUMN IF NOT EXISTS surgery_date        DATE,
    ADD COLUMN IF NOT EXISTS surgery_time        TEXT,
    ADD COLUMN IF NOT EXISTS surgeon_id          UUID        REFERENCES public.conofta_surgeons(id),
    ADD COLUMN IF NOT EXISTS actual_surgery_date DATE,

    -- Timeline tracking
    ADD COLUMN IF NOT EXISTS informed_at         TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS apto_at             TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS scheduled_at        TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS operated_at         TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS finalized_at        TIMESTAMPTZ,

    -- Clinical flags
    ADD COLUMN IF NOT EXISTS has_diabetes        BOOLEAN     DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS has_hipertensao     BOOLEAN     DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS has_anticoagulados  BOOLEAN     DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS pending_reason      TEXT,
    ADD COLUMN IF NOT EXISTS requesting_doctor   TEXT,

    -- Pre-op visual acuity
    ADD COLUMN IF NOT EXISTS pre_op_va_right     TEXT,
    ADD COLUMN IF NOT EXISTS pre_op_va_left      TEXT,
    ADD COLUMN IF NOT EXISTS pre_op_va_od        TEXT,
    ADD COLUMN IF NOT EXISTS pre_op_va_os        TEXT,

    -- Post-op visual acuity
    ADD COLUMN IF NOT EXISTS post_op_va_right    TEXT,
    ADD COLUMN IF NOT EXISTS post_op_va_left     TEXT,
    ADD COLUMN IF NOT EXISTS post_op_va_od       TEXT,
    ADD COLUMN IF NOT EXISTS post_op_va_os       TEXT,

    -- Exam checkboxes (pre-op)
    ADD COLUMN IF NOT EXISTS exam_hemograma      BOOLEAN     DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS exam_glicemia       BOOLEAN     DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS exam_hba1c          BOOLEAN     DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS exam_crasis         BOOLEAN     DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS exam_orina          BOOLEAN     DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS exam_ecg            BOOLEAN     DEFAULT FALSE;

-- 3. Ensure the conofta_surgeons table exists
CREATE TABLE IF NOT EXISTS public.conofta_surgeons (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    specialty   TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on surgeons
ALTER TABLE public.conofta_surgeons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone reads surgeons" ON public.conofta_surgeons;
DROP POLICY IF EXISTS "Admin manages surgeons"  ON public.conofta_surgeons;

CREATE POLICY "Everyone reads surgeons" ON public.conofta_surgeons
    FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "Admin manages surgeons" ON public.conofta_surgeons
    FOR ALL USING (public.is_gerente());

-- 4. Re-create the waitlist update policy to also allow coordinators
DROP POLICY IF EXISTS "Admin manages all waitlist" ON public.conofta_waitlist;
DROP POLICY IF EXISTS "Coordinador updates waitlist" ON public.conofta_waitlist;

CREATE POLICY "Admin manages all waitlist" ON public.conofta_waitlist
    FOR ALL USING (
        public.is_gerente()
        OR EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
            AND role IN ('admin_conofta', 'coordinador_local')
        )
    );
