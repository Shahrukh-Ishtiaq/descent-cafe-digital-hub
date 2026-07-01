import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// The primary owner account that is always granted admin access on sign-in.
const PRIMARY_ADMIN_EMAIL = "descentcafe@gmail.com";

// Ensures the signed-in user is granted the admin role when their email matches
// the cafe's primary owner account. Safe to call on every login: it only acts
// for the one hard-coded owner email and is a no-op for everyone else.
export const ensurePrimaryAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = String(
      (context.claims as { email?: string }).email ?? "",
    ).toLowerCase();
    if (email !== PRIMARY_ADMIN_EMAIL) return { granted: false };

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = supabaseAdmin as any;

    await admin
      .from("user_roles")
      .upsert(
        { user_id: context.userId, role: "admin" },
        { onConflict: "user_id,role" },
      );
    return { granted: true };
  });

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
      role: "admin" | "rider" | "customer";
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

// Admin-only: create a brand new rider account with name, phone, email & password.
export const createRider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      email: string;
      password: string;
      full_name: string;
      phone?: string;
    }) => {
      if (!d?.email || !d?.password || d.password.length < 6) {
        throw new Error("Email and a 6+ character password are required.");
      }
      return {
        email: d.email.trim().toLowerCase(),
        password: d.password,
        full_name: (d.full_name || "").trim(),
        phone: (d.phone || "").trim(),
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

    // Make sure the rider's profile carries their name & phone for dashboards.
    await admin
      .from("profiles")
      .upsert(
        { id: userId, full_name: data.full_name, phone: data.phone },
        { onConflict: "id" },
      );

    await admin
      .from("user_roles")
      .upsert({ user_id: userId, role: "rider" }, { onConflict: "user_id,role" });
    // Remove the default customer role so the dashboard role is unambiguous.
    await admin
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", "customer");
    return { ok: true, userId };
  });

// Admin-only: list every team member (admins + riders) with their email, name
// and phone. Reads auth users directly so riders always show up even if their
// profile row is missing, and backfills any missing profiles on the way.
export const listTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
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

    const { data: roleRows } = await admin
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["admin", "rider"]);
    const ids = [
      ...new Set(
        (roleRows ?? []).map((r: { user_id: string }) => r.user_id),
      ),
    ] as string[];
    if (ids.length === 0) return { team: [] as TeamMember[] };

    const { data: profs } = await admin
      .from("profiles")
      .select("id, full_name, phone")
      .in("id", ids);
    const pmap: Record<string, { full_name: string | null; phone: string | null }> =
      {};
    (profs ?? []).forEach(
      (p: { id: string; full_name: string | null; phone: string | null }) =>
        (pmap[p.id] = { full_name: p.full_name, phone: p.phone }),
    );

    const { data: list } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    const umap: Record<
      string,
      { email?: string; user_metadata?: { full_name?: string; phone?: string } }
    > = {};
    (list?.users ?? []).forEach(
      (u: {
        id: string;
        email?: string;
        user_metadata?: { full_name?: string; phone?: string };
      }) => (umap[u.id] = u),
    );

    // Backfill any missing profile rows from auth metadata so the rest of the
    // app (dropdowns, tracking) can rely on the profiles table.
    const toBackfill = ids
      .filter((id) => !pmap[id])
      .map((id) => ({
        id,
        full_name: umap[id]?.user_metadata?.full_name ?? null,
        phone: umap[id]?.user_metadata?.phone ?? null,
      }));
    if (toBackfill.length) {
      await admin.from("profiles").upsert(toBackfill, { onConflict: "id" });
      toBackfill.forEach(
        (p) => (pmap[p.id] = { full_name: p.full_name, phone: p.phone }),
      );
    }

    const rolesById: Record<string, string[]> = {};
    (roleRows ?? []).forEach((r: { user_id: string; role: string }) => {
      rolesById[r.user_id] = rolesById[r.user_id] || [];
      rolesById[r.user_id].push(r.role);
    });

    const team: TeamMember[] = ids.map((id) => ({
      id,
      full_name: pmap[id]?.full_name || umap[id]?.user_metadata?.full_name || null,
      phone: pmap[id]?.phone || umap[id]?.user_metadata?.phone || null,
      email: umap[id]?.email ?? null,
      roles: rolesById[id] ?? [],
    }));
    return { team };
  });

export type TeamMember = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  roles: string[];
};

// Public: resolve a Pakistani phone number to the account email so customers
// can sign in with either their email or phone. Returns null when no match,
// so it never reveals whether a given email exists.
export const resolveLoginEmail = createServerFn({ method: "POST" })
  .inputValidator((d: { phone: string }) => {
    const raw = (d?.phone || "").replace(/[\s-]/g, "");
    if (!raw) throw new Error("Phone number is required.");
    return { phone: raw };
  })
  .handler(async ({ data }) => {
    // Normalise to the local 03XXXXXXXXX form for matching.
    let local = data.phone;
    if (local.startsWith("+92")) local = "0" + local.slice(3);
    else if (local.startsWith("92")) local = "0" + local.slice(2);
    const digits = local.replace(/\D/g, "");
    if (!/^03\d{9}$/.test(digits)) return { email: null as string | null };

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = supabaseAdmin as any;

    // Match against the stored profile phone, ignoring spaces/dashes.
    const { data: profs } = await admin
      .from("profiles")
      .select("id, phone");
    const match = (profs ?? []).find((p: { phone: string | null }) => {
      const pd = (p.phone || "").replace(/\D/g, "");
      const norm = pd.startsWith("92") ? "0" + pd.slice(2) : pd;
      return norm === digits;
    });
    if (!match) return { email: null as string | null };

    const { data: u } = await admin.auth.admin.getUserById(match.id);
    return { email: (u?.user?.email as string | undefined) ?? null };
  });