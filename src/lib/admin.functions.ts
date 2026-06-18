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

// One-time bootstrap that creates the very first admin account with a chosen
// email + password. Refuses to run once any admin already exists, so the
// public endpoint cannot be abused after initial setup.
export const seedAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; password: string }) => {
    if (!d?.email || !d?.password || d.password.length < 6) {
      throw new Error("Email and a 6+ character password are required.");
    }
    return { email: d.email.trim().toLowerCase(), password: d.password };
  })
  .handler(async ({ data }) => {
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
      throw new Error("An admin already exists. Bootstrap is closed.");
    }

    // Try to find an existing user with this email first.
    let userId: string | undefined;
    const { data: list } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    const existing = list?.users?.find(
      (u: { email?: string }) => u.email?.toLowerCase() === data.email,
    );
    if (existing) {
      userId = existing.id;
      await admin.auth.admin.updateUserById(userId, {
        password: data.password,
      });
    } else {
      const { data: created, error } = await admin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        user_metadata: { full_name: "Descent Cafe Admin" },
      });
      if (error) throw new Error(error.message);
      userId = created.user.id;
    }

    await admin
      .from("user_roles")
      .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
    return { ok: true, userId };
  });

// Admin-only: grant or revoke a role for a user identified by email.
export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      email: string;
      role: "admin" | "staff" | "rider" | "customer";
      action: "add" | "remove";
    }) => {
      if (!d?.email || !d?.role || !d?.action) throw new Error("Invalid input.");
      return { email: d.email.trim().toLowerCase(), role: d.role, action: d.action };
    },
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = supabaseAdmin as any;

    const { data: list } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    const target = list?.users?.find(
      (u: { email?: string }) => u.email?.toLowerCase() === data.email,
    );
    if (!target) throw new Error("No user found with that email.");

    if (data.action === "add") {
      await admin
        .from("user_roles")
        .upsert(
          { user_id: target.id, role: data.role },
          { onConflict: "user_id,role" },
        );
    } else {
      await admin
        .from("user_roles")
        .delete()
        .eq("user_id", target.id)
        .eq("role", data.role);
    }
    return { ok: true, userId: target.id };
  });

// Admin-only: create a brand new staff or rider account.
export const createStaffUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      email: string;
      password: string;
      full_name: string;
      phone?: string;
      role: "staff" | "rider";
    }) => {
      if (!d?.email || !d?.password || d.password.length < 6 || !d?.role) {
        throw new Error("Email, 6+ char password and role are required.");
      }
      return {
        email: d.email.trim().toLowerCase(),
        password: d.password,
        full_name: (d.full_name || "").trim(),
        phone: (d.phone || "").trim(),
        role: d.role,
      };
    },
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = supabaseAdmin as any;

    const { data: created, error } = await admin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name, phone: data.phone },
    });
    if (error) throw new Error(error.message);
    const userId = created.user.id;

    await admin
      .from("user_roles")
      .upsert({ user_id: userId, role: data.role }, { onConflict: "user_id,role" });
    // Remove the default customer role so the dashboard role is unambiguous.
    await admin
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", "customer");
    return { ok: true, userId };
  });