// قاعدة البيانات المحلية باستخدام Dexie (IndexedDB)
// مُصممة لتعمل أوفلاين الآن ومستعدة للمزامنة مع Supabase.
import Dexie, { type Table } from "dexie";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Product,
  Category,
  Invoice,
  ReturnRecord,
  StockMovement,
  AppSettings,
  Customer,
  PaymentRecord,
} from "./types";

const GLOBAL_SUPABASE_KEY = "__BadrCenterSupabaseClient__";
let supabase: SupabaseClient | null = null;

const getGlobalSupabaseClient = (): SupabaseClient | null => {
  if (typeof window === "undefined") return null;
  return (window as any)[GLOBAL_SUPABASE_KEY] ?? null;
};

const setGlobalSupabaseClient = (client: SupabaseClient) => {
  if (typeof window !== "undefined") {
    (window as any)[GLOBAL_SUPABASE_KEY] = client;
  }
};

const initializeSupabase = async () => {
  if (supabase) return supabase;

  const globalClient = getGlobalSupabaseClient();
  if (globalClient) {
    supabase = globalClient;
    return supabase;
  }

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
    const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      setGlobalSupabaseClient(supabase);
    }
  } catch (error) {
    console.warn("Supabase not available, running in offline mode only");
  }

  return supabase;
};

export const getSupabase = () => supabase;
export const initSupabase = initializeSupabase;

class BadrDB extends Dexie {
  products!: Table<Product, string>;
  categories!: Table<Category, string>;
  customers!: Table<Customer, string>;
  invoices!: Table<Invoice, string>;
  returns!: Table<ReturnRecord, string>;
  movements!: Table<StockMovement, string>;
  payments!: Table<PaymentRecord, string>;
  settings!: Table<AppSettings, string>;

  // جداول إضافية للمطابقة مع Supabase
  product_batches!: Table<any, string>;
  product_prices!: Table<any, string>;
  batch_sale_items!: Table<any, string>;
  credit_payments!: Table<any, string>;
  customer_credits!: Table<any, string>;
  app_settings!: Table<any, string>;
  activity_log!: Table<any, string>;
  user_profiles!: Table<any, string>;

  constructor() {
    super("badr_center_db");
    this.version(2).stores({
      products: "id, sku, name, categoryId, brand, model, stock, updatedAt, syncStatus, remoteId",
      categories: "id, name, updatedAt, syncStatus, remoteId",
      customers: "id, name, phone, updatedAt, syncStatus, remoteId",
      invoices: "id, number, customerId, createdAt, status, syncStatus, remoteId",
      returns: "id, number, invoiceId, createdAt, syncStatus, remoteId",
      movements: "id, productId, type, createdAt, refId, syncStatus, remoteId",
      payments: "id, invoiceId, customerId, createdAt, syncStatus, remoteId",
      settings: "id",

      // جداول Supabase
      product_batches: "id, product_id, batch_name, remaining_quantity, expiry_date, is_active, updated_at, syncStatus, remoteId",
      product_prices: "id, product_id, price, type, is_active, effective_from, effective_to, syncStatus, remoteId",
      batch_sale_items: "id, sale_item_id, batch_id, quantity_sold, syncStatus, remoteId",
      credit_payments: "id, credit_id, amount, payment_method, created_at, syncStatus, remoteId",
      customer_credits: "id, customer_id, sale_id, total_amount, paid_amount, remaining_amount, status, updated_at, syncStatus, remoteId",
      app_settings: "id, key, value, updated_at, syncStatus, remoteId",
      activity_log: "id, user_id, activity_type, table_name, record_id, created_at, syncStatus, remoteId",
      user_profiles: "id, username, full_name, role, is_active, last_login, syncStatus, remoteId",
    });

    // الإصدار 3: أضف فهارس بصيغة camelCase ليتطابق مع الكود (productId, customerId, ...)
    this.version(3).stores({
      products: "id, sku, name, categoryId, brand, model, stock, updatedAt, syncStatus, remoteId",
      categories: "id, name, updatedAt, syncStatus, remoteId",
      customers: "id, name, phone, updatedAt, syncStatus, remoteId, deletedAt",
      invoices: "id, number, customerId, createdAt, status, syncStatus, remoteId",
      returns: "id, number, invoiceId, createdAt, syncStatus, remoteId",
      movements: "id, productId, type, createdAt, refId, syncStatus, remoteId",
      payments: "id, invoiceId, customerId, createdAt, syncStatus, remoteId",
      settings: "id",

      product_batches: "id, productId, product_id, batch_name, remaining_quantity, expiry_date, is_active, updated_at, syncStatus, remoteId",
      product_prices: "id, productId, product_id, price, type, isActive, is_active, effective_from, effective_to, syncStatus, remoteId",
      batch_sale_items: "id, sale_item_id, batch_id, quantity_sold, syncStatus, remoteId",
      credit_payments: "id, credit_id, amount, payment_method, created_at, syncStatus, remoteId",
      customer_credits: "id, customer_id, sale_id, total_amount, paid_amount, remaining_amount, status, updated_at, syncStatus, remoteId",
      app_settings: "id, key, value, updated_at, syncStatus, remoteId",
      activity_log: "id, user_id, activity_type, table_name, record_id, created_at, syncStatus, remoteId",
      user_profiles: "id, username, full_name, role, is_active, last_login, syncStatus, remoteId",
    });
  }
}

export const db = new BadrDB();

export const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const now = () => Date.now();

export async function ensureSettings(): Promise<AppSettings> {
  const existing = await db.settings.get("settings");
  if (existing) return existing;
  const fresh: AppSettings = {
    id: "settings",
    shopName: "مركز البدر",
    currency: "د.ع",
    pin: "1234",
    invoiceCounter: 0,
    returnCounter: 0,
    taxRate: 0,
    footerNote: "شكراً لتعاملكم مع مركز البدر",
    updatedAt: now(),
  };
  await db.settings.put(fresh);
  return fresh;
}

export function formatInvoiceNumber(n: number) {
  return `INV-${String(n).padStart(6, "0")}`;
}
export function formatReturnNumber(n: number) {
  return `RET-${String(n).padStart(6, "0")}`;
}
