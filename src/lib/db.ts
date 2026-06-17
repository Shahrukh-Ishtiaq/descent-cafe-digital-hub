import { supabase } from "@/integrations/supabase/client";

// Generated Database types don't yet include the cafe tables, so we expose a
// loosely-typed client for data access and rely on our own interfaces in types.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const sb = supabase as any;