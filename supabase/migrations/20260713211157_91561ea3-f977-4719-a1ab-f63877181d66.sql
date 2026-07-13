-- has_role is a SECURITY DEFINER helper used inside RLS policies. It must not
-- be directly callable by end users over the Data API. Revoking EXECUTE from
-- anon/authenticated does not affect its use inside RLS policy evaluation.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;