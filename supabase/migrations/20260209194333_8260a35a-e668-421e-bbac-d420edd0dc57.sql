
-- Detailed sales table matching the JSON schema
CREATE TABLE public.sales_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha date NOT NULL,
  cod_cliente text NOT NULL,
  cliente text NOT NULL,
  direccion text,
  ciudad text NOT NULL,
  linea_de_producto text NOT NULL,
  factura_nro text NOT NULL,
  cod2 text,
  codigo_producto text NOT NULL,
  producto text NOT NULL,
  costo numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  monto_en text DEFAULT 'USD',
  monto_usd numeric NOT NULL DEFAULT 0,
  vendedor text NOT NULL,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gerente can manage sales_details"
  ON public.sales_details FOR ALL
  USING (public.is_gerente());

CREATE POLICY "Authenticated can read sales_details"
  ON public.sales_details FOR SELECT
  USING (true);

-- Targets table matching the JSON schema
CREATE TABLE public.sales_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitador text NOT NULL,
  linea_de_producto text NOT NULL,
  enero numeric NOT NULL DEFAULT 0,
  febrero numeric NOT NULL DEFAULT 0,
  marzo numeric NOT NULL DEFAULT 0,
  abril numeric NOT NULL DEFAULT 0,
  mayo numeric NOT NULL DEFAULT 0,
  junio numeric NOT NULL DEFAULT 0,
  julio numeric NOT NULL DEFAULT 0,
  agosto numeric NOT NULL DEFAULT 0,
  septiembre numeric NOT NULL DEFAULT 0,
  octubre numeric NOT NULL DEFAULT 0,
  noviembre numeric NOT NULL DEFAULT 0,
  diciembre numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  anio integer NOT NULL DEFAULT EXTRACT(YEAR FROM now()),
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gerente can manage sales_targets"
  ON public.sales_targets FOR ALL
  USING (public.is_gerente());

CREATE POLICY "Authenticated can read sales_targets"
  ON public.sales_targets FOR SELECT
  USING (true);
