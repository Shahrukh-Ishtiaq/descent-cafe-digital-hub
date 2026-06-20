-- =========================================================
-- App settings (global config such as delivery charge)
-- =========================================================
CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view settings"
  ON public.app_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins manage settings"
  ON public.app_settings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed the default delivery fee (Rs. 100)
INSERT INTO public.app_settings (key, value)
VALUES ('delivery_fee', '{"amount": 100}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- =========================================================
-- Categories (admin-managed menu categories)
-- =========================================================
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  blurb text,
  image_url text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view categories"
  ON public.categories FOR SELECT
  USING (true);

CREATE POLICY "Admins manage categories"
  ON public.categories FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed existing default categories
INSERT INTO public.categories (name, blurb, sort_order) VALUES
  ('Coffee', 'Single-origin espresso, lattes & cold brew.', 1),
  ('Chai & Tea', 'Desi doodh patti, karak & Kashmiri chai.', 2),
  ('Parathas', 'Flaky aloo, cheese, qeema & more.', 3),
  ('Snacks', 'Sandwiches, wings, fries & bites.', 4),
  ('Beverages', 'Lassi, fresh limes & mocktails.', 5),
  ('Desserts', 'Brownies, cheesecake & sweet treats.', 6)
ON CONFLICT (name) DO NOTHING;