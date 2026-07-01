import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { sb } from "@/lib/db";
import { useAuth } from "@/lib/auth";
import { useRepeatingAlarm, useAdminAlarmOn } from "@/lib/alarm";

/**
 * Always-mounted watcher for admins. It rings the new-order alarm and shows a
 * toast whenever a customer places an order — no matter which page the admin is
 * on and without needing a page refresh. It keeps ringing until every pending
 * order has been moved off "pending".
 */
export function AdminOrderAlarm() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const soundOn = useAdminAlarmOn();

  const { data: pending = 0 } = useQuery({
    queryKey: ["admin-pending-count"],
    enabled: isAdmin,
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
    queryFn: async (): Promise<number> => {
      const { count } = await sb
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      return count ?? 0;
    },
  });

  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel("global-admin-orders-rt")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        () => {
          toast.success("🔔 New order received!");
          qc.invalidateQueries({ queryKey: ["admin-pending-count"] });
          qc.invalidateQueries({ queryKey: ["admin-orders"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        () => {
          qc.invalidateQueries({ queryKey: ["admin-pending-count"] });
          qc.invalidateQueries({ queryKey: ["admin-orders"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, qc]);

  useRepeatingAlarm(isAdmin && pending > 0, "admin", soundOn);

  return null;
}
