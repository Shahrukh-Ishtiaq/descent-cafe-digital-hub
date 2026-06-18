-- Products: stock tracking
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock_quantity integer NOT NULL DEFAULT 100;

-- Orders: location + rider assignment
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS longitude double precision;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS location_label text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS assigned_rider_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Riders can view orders assigned to them
CREATE POLICY "Riders view assigned orders" ON public.orders
  FOR SELECT TO authenticated
  USING (assigned_rider_id = auth.uid() AND public.has_role(auth.uid(), 'rider'));

-- Riders can update delivery status of their assigned orders
CREATE POLICY "Riders update assigned orders" ON public.orders
  FOR UPDATE TO authenticated
  USING (assigned_rider_id = auth.uid() AND public.has_role(auth.uid(), 'rider'))
  WITH CHECK (assigned_rider_id = auth.uid() AND public.has_role(auth.uid(), 'rider'));

-- Riders can view items of their assigned orders
CREATE POLICY "Riders view assigned order items" ON public.order_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND o.assigned_rider_id = auth.uid()));

-- Admins can manage all roles
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admins can view all profiles (for customer management) — replace existing view policy
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "View profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

-- Promotions table
CREATE TABLE IF NOT EXISTS public.promotions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  discount_percent integer NOT NULL DEFAULT 0,
  promo_code text,
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.promotions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promotions TO authenticated;
GRANT ALL ON public.promotions TO service_role;

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active promotions" ON public.promotions
  FOR SELECT USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage promotions" ON public.promotions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_promotions_updated_at BEFORE UPDATE ON public.promotions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();