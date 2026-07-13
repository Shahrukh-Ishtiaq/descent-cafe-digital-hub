-- 1) Stop trusting client-submitted order data: remove the policies that let
-- the browser insert orders/order_items directly. Order creation now happens
-- only through the server (which recomputes prices from the products table).
DROP POLICY IF EXISTS "Users create own orders" ON public.orders;
DROP POLICY IF EXISTS "Insert items for own orders" ON public.order_items;

-- 2) Lock down SECURITY DEFINER trigger functions so signed-in users cannot
-- call them directly. They only ever run as triggers, which does not require
-- EXECUTE to be granted to end-user roles.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.decrement_stock_on_order() FROM PUBLIC, anon, authenticated;