import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DEFAULT_DELIVERY_FEE = 100;

type IncomingItem = { id: string; quantity: number };

// Places an order using ONLY server-trusted values. Item prices, the subtotal,
// the delivery fee and the grand total are all recomputed from the database —
// anything the browser sends for price/total is ignored, so a customer cannot
// tamper with what they owe.
export const placeOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      items: IncomingItem[];
      customer_name: string;
      phone: string;
      address: string;
      notes?: string | null;
      latitude?: number | null;
      longitude?: number | null;
    }) => {
      const items = Array.isArray(d?.items) ? d.items : [];
      const cleaned = items
        .map((i) => ({
          id: String(i?.id ?? "").trim(),
          quantity: Math.floor(Number(i?.quantity)),
        }))
        .filter((i) => i.id && Number.isFinite(i.quantity) && i.quantity > 0);
      if (cleaned.length === 0) throw new Error("Your cart is empty.");
      if (cleaned.length > 100) throw new Error("Too many items in one order.");

      const customer_name = String(d?.customer_name ?? "").trim();
      const phone = String(d?.phone ?? "").trim();
      const address = String(d?.address ?? "").trim();
      if (!customer_name || customer_name.length > 80)
        throw new Error("A valid name is required.");
      if (!phone || phone.length > 20)
        throw new Error("A valid phone number is required.");
      if (!address || address.length > 300)
        throw new Error("A valid delivery address is required.");

      const notes = d?.notes ? String(d.notes).slice(0, 300) : null;
      const latitude =
        typeof d?.latitude === "number" && Number.isFinite(d.latitude)
          ? d.latitude
          : null;
      const longitude =
        typeof d?.longitude === "number" && Number.isFinite(d.longitude)
          ? d.longitude
          : null;

      return {
        items: cleaned,
        customer_name,
        phone,
        address,
        notes,
        latitude,
        longitude,
      };
    },
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = supabaseAdmin as any;

    const ids = data.items.map((i) => i.id);
    const { data: products, error: prodErr } = await admin
      .from("products")
      .select("id, name, price, is_available, stock_quantity")
      .in("id", ids);
    if (prodErr) throw new Error("Could not verify your cart. Please retry.");

    const byId: Record<
      string,
      {
        id: string;
        name: string;
        price: number;
        is_available: boolean;
        stock_quantity: number;
      }
    > = {};
    (products ?? []).forEach((p: { id: string }) => (byId[p.id] = p as never));

    const blocked: string[] = [];
    const lineItems: { product_id: string; name: string; price: number; quantity: number }[] =
      [];
    let subtotal = 0;

    for (const item of data.items) {
      const p = byId[item.id];
      if (!p || !p.is_available || p.stock_quantity < item.quantity) {
        blocked.push(p?.name ?? "an item");
        continue;
      }
      const price = Number(p.price);
      subtotal += price * item.quantity;
      lineItems.push({
        product_id: p.id,
        name: p.name,
        price,
        quantity: item.quantity,
      });
    }

    if (blocked.length > 0) {
      throw new Error(
        `No longer available: ${blocked.join(", ")}. Please update your cart.`,
      );
    }

    // Delivery fee comes from admin-controlled settings, never the client.
    const { data: setting } = await admin
      .from("app_settings")
      .select("value")
      .eq("key", "delivery_fee")
      .maybeSingle();
    const feeAmount = setting?.value?.amount;
    const deliveryFee =
      typeof feeAmount === "number" ? feeAmount : DEFAULT_DELIVERY_FEE;

    const total = subtotal + deliveryFee;

    const { data: order, error: orderErr } = await admin
      .from("orders")
      .insert({
        user_id: context.userId,
        customer_name: data.customer_name,
        phone: data.phone,
        address: data.address,
        notes: data.notes,
        total,
        status: "pending",
        latitude: data.latitude,
        longitude: data.longitude,
        location_label:
          data.latitude != null && data.longitude != null
            ? `${data.latitude},${data.longitude}`
            : null,
      })
      .select()
      .single();
    if (orderErr) throw new Error("Could not place your order. Please retry.");

    const { error: itemsErr } = await admin.from("order_items").insert(
      lineItems.map((li) => ({ ...li, order_id: order.id })),
    );
    if (itemsErr) throw new Error("Could not save your order items.");

    // Keep the customer's profile up to date for next time.
    await admin
      .from("profiles")
      .update({
        full_name: data.customer_name,
        phone: data.phone,
        address: data.address,
      })
      .eq("id", context.userId);

    return { orderId: order.id as string, total };
  });
