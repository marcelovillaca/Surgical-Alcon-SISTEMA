
-- 1. Institutions table
CREATE TABLE public.institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text DEFAULT 'clinica', -- clinica, hospital, optica, etc.
  city text,
  address text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read institutions" ON public.institutions FOR SELECT USING (true);
CREATE POLICY "Gerente can manage institutions" ON public.institutions FOR ALL USING (is_gerente());
CREATE POLICY "Visitador can create institutions" ON public.institutions FOR INSERT WITH CHECK (is_visitador());

-- 2. Client-Institution many-to-many
CREATE TABLE public.client_institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, institution_id)
);

ALTER TABLE public.client_institutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read client_institutions" ON public.client_institutions FOR SELECT USING (true);
CREATE POLICY "Gerente can manage client_institutions" ON public.client_institutions FOR ALL USING (is_gerente());
CREATE POLICY "Visitador can manage client_institutions" ON public.client_institutions FOR ALL USING (is_visitador());

-- 3. Visit frequency on clients
CREATE TYPE public.visit_frequency AS ENUM ('semanal', 'quincenal', 'mensual', 'trimestral');

ALTER TABLE public.clients ADD COLUMN visit_frequency public.visit_frequency DEFAULT 'mensual';

-- 4. Visit approval status
ALTER TABLE public.visits ADD COLUMN approved boolean DEFAULT NULL;
ALTER TABLE public.visits ADD COLUMN approved_by uuid REFERENCES auth.users(id);
ALTER TABLE public.visits ADD COLUMN approved_at timestamptz;

-- 5. Viáticos (travel allowances) table
CREATE TYPE public.viatico_status AS ENUM ('pendiente', 'aprobado', 'rechazado');

CREATE TABLE public.viaticos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  transporte numeric DEFAULT 0,
  hospedaje numeric DEFAULT 0,
  alimentacion numeric DEFAULT 0,
  otros numeric DEFAULT 0,
  otros_descripcion text,
  total numeric GENERATED ALWAYS AS (transporte + hospedaje + alimentacion + otros) STORED,
  status public.viatico_status DEFAULT 'pendiente',
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.viaticos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Visitador can manage own viaticos" ON public.viaticos FOR ALL USING (is_visitador() AND created_by = auth.uid());
CREATE POLICY "Gerente can manage all viaticos" ON public.viaticos FOR ALL USING (is_gerente());

CREATE TRIGGER update_viaticos_updated_at BEFORE UPDATE ON public.viaticos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
