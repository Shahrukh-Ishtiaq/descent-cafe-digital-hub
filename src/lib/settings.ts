import { useQuery } from "@tanstack/react-query";
import { sb } from "./db";

export const DEFAULT_DELIVERY_FEE = 100;

// Global delivery charge controlled by the admin. Falls back to a sane default
// so checkout never breaks if the setting is missing.
export function useDeliveryFee() {
  const { data } = useQuery({
    queryKey: ["settings", "delivery_fee"],
    staleTime: 60_000,
    queryFn: async (): Promise<number> => {
      const { data, error } = await sb
        .from("app_settings")
        .select("value")
        .eq("key", "delivery_fee")
        .maybeSingle();
      if (error) throw error;
      const amount = data?.value?.amount;
      return typeof amount === "number" ? amount : DEFAULT_DELIVERY_FEE;
    },
  });
  return data ?? DEFAULT_DELIVERY_FEE;
}