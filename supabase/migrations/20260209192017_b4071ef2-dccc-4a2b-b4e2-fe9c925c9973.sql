
-- ============================================
-- SURGICAL ALCON - Complete Database Schema
-- ============================================

-- 1. ENUMS
CREATE TYPE public.app_role AS ENUM ('gerente', 'visitador', 'bodega', 'expedicion');
CREATE TYPE public.pricing_level AS ENUM ('A', 'B', 'C', 'D');
CREATE TYPE public.client_segment AS ENUM ('check_in', 'grow', 'partner', 'protect');
CREATE TYPE public.order_status AS ENUM ('borrador', 'pendiente', 'en_preparacion', 'en_ruta', 'entregado', 'devolucion');
CREATE TYPE public.visit_type AS ENUM ('soporte_tecnico', 'presentacion', 'cirugia', 'entrega');
CREATE TYPE public.product_line AS ENUM ('total_monofocals', 'vit_ret_paks', 'phaco_paks', 'equipment', 'atiols', 'rest_of_portfolio');

-- 2. PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. USER ROLES (separate table as required)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. HELPER FUNCTIONS (security definer to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_gerente()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'gerente')
$$;

CREATE OR REPLACE FUNCTION public.is_visitador()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'visitador')
$$;

CREATE OR REPLACE FUNCTION public.is_bodega()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'bodega')
$$;

CREATE OR REPLACE FUNCTION public.is_expedicion()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'expedicion')
$$;

-- 5. PRODUCTS
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  product_line product_line NOT NULL,
  cost_pyg BIGINT NOT NULL DEFAULT 0,
  price_base_pyg BIGINT NOT NULL DEFAULT 0,
  unit_of_measure TEXT DEFAULT 'unidad',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- 6. CLIENTS
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  segment client_segment NOT NULL DEFAULT 'check_in',
  pricing_level pricing_level NOT NULL DEFAULT 'D',
  discount_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  address TEXT,
  city TEXT,
  phone TEXT,
  email TEXT,
  contact_name TEXT,
  market_type TEXT DEFAULT 'privado',
  assigned_to UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- 7. INVENTORY LOTS
CREATE TABLE public.inventory_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  lot_number TEXT NOT NULL,
  serial_number TEXT UNIQUE,
  quantity INTEGER NOT NULL DEFAULT 0,
  expiry_date DATE NOT NULL,
  cost_unit_pyg BIGINT NOT NULL DEFAULT 0,
  price_base_pyg BIGINT NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'disponible',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_lots ENABLE ROW LEVEL SECURITY;

-- 8. ORDERS
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  client_id UUID REFERENCES public.clients(id) NOT NULL,
  status order_status NOT NULL DEFAULT 'borrador',
  total_pyg BIGINT NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  prepared_by UUID REFERENCES auth.users(id),
  dispatched_by UUID REFERENCES auth.users(id),
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 9. ORDER ITEMS
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) NOT NULL,
  lot_id UUID REFERENCES public.inventory_lots(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price_pyg BIGINT NOT NULL DEFAULT 0,
  discount_pct NUMERIC(5,2) DEFAULT 0,
  subtotal_pyg BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- 10. VISITS (SFA)
CREATE TABLE public.visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) NOT NULL,
  visit_type visit_type NOT NULL,
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  scheduled_time TIME,
  check_in_at TIMESTAMPTZ,
  check_in_lat NUMERIC(10,7),
  check_in_lon NUMERIC(10,7),
  check_out_at TIMESTAMPTZ,
  check_out_lat NUMERIC(10,7),
  check_out_lon NUMERIC(10,7),
  observations TEXT,
  order_id UUID REFERENCES public.orders(id),
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;

-- 11. AUDIT LOG
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB,
  gps_lat NUMERIC(10,7),
  gps_lon NUMERIC(10,7),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- 12. SALES IMPORTS
CREATE TABLE public.sales_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  fecha DATE,
  factura_nro TEXT,
  monto_pyg BIGINT DEFAULT 0,
  costo_pyg BIGINT DEFAULT 0,
  margin_pyg BIGINT GENERATED ALWAYS AS (monto_pyg - costo_pyg) STORED,
  imported_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sales_imports ENABLE ROW LEVEL SECURITY;

-- 13. COMMISSION ACCELERATORS (editable by Gerente)
CREATE TABLE public.commission_accelerators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  min_cumplimiento INTEGER NOT NULL,
  max_cumplimiento INTEGER NOT NULL,
  pago_pct INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.commission_accelerators ENABLE ROW LEVEL SECURITY;

-- 14. INSTALLED EQUIPMENT (intelligence)
CREATE TABLE public.installed_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  equipment_name TEXT NOT NULL,
  brand TEXT,
  is_own BOOLEAN DEFAULT false,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.installed_equipment ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- PROFILES
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Gerente can view all profiles" ON public.profiles FOR SELECT USING (public.is_gerente());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- USER ROLES
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Gerente can view all roles" ON public.user_roles FOR SELECT USING (public.is_gerente());
CREATE POLICY "Gerente can manage roles" ON public.user_roles FOR ALL USING (public.is_gerente());

-- PRODUCTS (all authenticated can read)
CREATE POLICY "Authenticated can read products" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gerente can manage products" ON public.products FOR ALL USING (public.is_gerente());

-- CLIENTS
CREATE POLICY "Gerente can manage clients" ON public.clients FOR ALL USING (public.is_gerente());
CREATE POLICY "Visitador can read assigned clients" ON public.clients FOR SELECT USING (public.is_visitador() AND (assigned_to = auth.uid() OR created_by = auth.uid()));
CREATE POLICY "Visitador can create clients" ON public.clients FOR INSERT WITH CHECK (public.is_visitador());
CREATE POLICY "Bodega/Exp can read clients" ON public.clients FOR SELECT USING (public.is_bodega() OR public.is_expedicion());

-- INVENTORY LOTS
CREATE POLICY "Authenticated can read lots" ON public.inventory_lots FOR SELECT TO authenticated USING (true);
CREATE POLICY "Bodega can manage lots" ON public.inventory_lots FOR ALL USING (public.is_bodega() OR public.is_gerente());

-- ORDERS
CREATE POLICY "Gerente can manage orders" ON public.orders FOR ALL USING (public.is_gerente());
CREATE POLICY "Visitador can manage own orders" ON public.orders FOR ALL USING (public.is_visitador() AND created_by = auth.uid());
CREATE POLICY "Bodega can read orders" ON public.orders FOR SELECT USING (public.is_bodega());
CREATE POLICY "Expedicion can read/update orders" ON public.orders FOR SELECT USING (public.is_expedicion());
CREATE POLICY "Expedicion can update order status" ON public.orders FOR UPDATE USING (public.is_expedicion());

-- ORDER ITEMS
CREATE POLICY "Gerente can manage order items" ON public.order_items FOR ALL USING (public.is_gerente());
CREATE POLICY "Owner can manage order items" ON public.order_items FOR ALL USING (
  EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.created_by = auth.uid())
);
CREATE POLICY "Authenticated can read order items" ON public.order_items FOR SELECT TO authenticated USING (true);

-- VISITS
CREATE POLICY "Gerente can manage visits" ON public.visits FOR ALL USING (public.is_gerente());
CREATE POLICY "Visitador can manage own visits" ON public.visits FOR ALL USING (public.is_visitador() AND created_by = auth.uid());
CREATE POLICY "Others can read visits" ON public.visits FOR SELECT USING (public.is_bodega() OR public.is_expedicion());

-- AUDIT LOG (append-only, gerente reads)
CREATE POLICY "Gerente can read audit" ON public.audit_log FOR SELECT USING (public.is_gerente());
CREATE POLICY "Authenticated can insert audit" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (true);

-- SALES IMPORTS
CREATE POLICY "Gerente can manage sales imports" ON public.sales_imports FOR ALL USING (public.is_gerente());

-- COMMISSION ACCELERATORS
CREATE POLICY "Authenticated can read accelerators" ON public.commission_accelerators FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gerente can manage accelerators" ON public.commission_accelerators FOR ALL USING (public.is_gerente());

-- INSTALLED EQUIPMENT
CREATE POLICY "Authenticated can read equipment" ON public.installed_equipment FOR SELECT TO authenticated USING (true);
CREATE POLICY "Visitador/Gerente can manage equipment" ON public.installed_equipment FOR ALL USING (public.is_gerente() OR (public.is_visitador() AND created_by = auth.uid()));

-- ============================================
-- TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_visits_updated_at BEFORE UPDATE ON public.visits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_inventory_lots_updated_at BEFORE UPDATE ON public.inventory_lots FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Seed default commission accelerators
INSERT INTO public.commission_accelerators (min_cumplimiento, max_cumplimiento, pago_pct) VALUES
  (0, 79, 0),
  (80, 89, 70),
  (90, 99, 90),
  (100, 109, 100),
  (110, 119, 120),
  (120, 150, 140);
