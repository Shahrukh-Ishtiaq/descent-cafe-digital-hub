export type OrderStatus =
  | "pending"
  | "preparing"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  image_url: string | null;
  is_available: boolean;
  sort_order: number;
  stock_quantity: number;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  name: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  user_id: string | null;
  customer_name: string;
  phone: string;
  address: string;
  notes: string | null;
  total: number;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
  latitude: number | null;
  longitude: number | null;
  location_label: string | null;
  assigned_rider_id: string | null;
  order_items?: OrderItem[];
}

export interface Promotion {
  id: string;
  title: string;
  description: string | null;
  discount_percent: number;
  promo_code: string | null;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  address: string | null;
  created_at?: string;
}

export type AppRole = "admin" | "rider" | "customer";