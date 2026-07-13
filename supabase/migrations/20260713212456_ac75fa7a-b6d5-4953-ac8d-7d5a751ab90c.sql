-- has_role() is a SECURITY DEFINER helper used throughout RLS policies
-- (profiles, user_roles, orders, order_items, promotions, products, etc.).
-- The roles evaluating those policies must be able to EXECUTE it, otherwise
-- every authenticated/anon read fails with "permission denied for function has_role".
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, anon;