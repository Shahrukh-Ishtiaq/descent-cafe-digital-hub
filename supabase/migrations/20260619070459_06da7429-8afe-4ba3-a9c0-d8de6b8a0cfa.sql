-- Storage policies for product image uploads (admins manage; signed URLs serve public)
CREATE POLICY "Admins upload product images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins read product images" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update product images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete product images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'));

-- Auto-manage stock: decrement on each ordered item, flag out-of-stock automatically
CREATE OR REPLACE FUNCTION public.decrement_stock_on_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    UPDATE public.products
      SET stock_quantity = GREATEST(stock_quantity - NEW.quantity, 0),
          is_available = CASE WHEN (stock_quantity - NEW.quantity) <= 0 THEN false ELSE is_available END
    WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_decrement_stock ON public.order_items;
CREATE TRIGGER trg_decrement_stock
  AFTER INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.decrement_stock_on_order();

-- Live menu/stock updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;