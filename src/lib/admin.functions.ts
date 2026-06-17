import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// One-time bootstrap: the first signed-in user who calls this becomes admin.
// Once an admin exists, only existing admins get a success response.
export const claimAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = supabaseAdmin as any;

    const { data: admins } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (admins && admins.length > 0) {
      const already = admins.some(
        (a: { user_id: string }) => a.user_id === context.userId,
      );
      if (already) return { granted: true, already: true };
      throw new Error("An admin already exists for this cafe.");
    }

    await admin
      .from("user_roles")
      .insert({ user_id: context.userId, role: "admin" });
    return { granted: true, already: false };
  });