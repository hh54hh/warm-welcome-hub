// أنواع البيانات الأساسية لتطبيق مركز البدر
// مصممة بحيث تكون متوافقة لاحقاً مع Lovable Cloud (Postgres) عبر مفتاح id واحد و timestamps.

export type ID = string;

export interface BaseEntity {
  id: ID;
  createdAt: number; // epoch ms
  updatedAt: number;
  // علم المزامنة المستقبلية مع Cloud
  syncStatus?: "local" | "synced" | "pending" | "deleted";
  remoteId?: string | null;
  deletedAt?: number;
}

export interface Category extends BaseEntity {
  name: string;
}

export interface Product extends BaseEntity {
  name: string;
  sku: string; // كود/باركود
  model?: string; // الموديل (مهم للإلكترونيات)
  brand?: string;
  categoryId?: ID;
  costPrice: number; // سعر الكلفة
  salePrice: number; // سعر البيع
  stock: number; // الكمية المتاحة
  minStock: number; // حد التنبيه
  unit?: string; // قطعة، علبة...
  notes?: string;
}

export interface Customer extends BaseEntity {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}

export type PaymentMethod = "cash" | "card" | "transfer" | "credit";

export interface PaymentRecord extends BaseEntity {
  invoiceId?: ID;
  customerId?: ID;
  method: PaymentMethod;
  amount: number;
  currency: string;
  status: "completed" | "pending" | "failed";
  note?: string;
  paidAt: number;
}

export interface InvoiceItem {
  productId: ID;
  name: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  discount: number; // خصم على البند
  total: number; // (unitPrice * quantity) - discount
}

export type InvoiceStatus = "completed" | "returned" | "partially_returned";

export interface Invoice extends BaseEntity {
  number: string; // رقم الفاتورة المعروض (مثل INV-000123)
  items: InvoiceItem[];
  subtotal: number;
  discount: number; // خصم عام على الفاتورة
  total: number;
  paid: number;
  change: number;
  paymentMethod: PaymentMethod;
  customerId?: ID;
  customerName?: string;
  customerPhone?: string;
  status: InvoiceStatus;
  notes?: string;
}

export interface ReturnItem {
  productId: ID;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ReturnRecord extends BaseEntity {
  number: string; // RET-000xxx
  invoiceId: ID;
  invoiceNumber: string;
  items: ReturnItem[];
  total: number;
  reason?: string;
}

export interface StockMovement extends BaseEntity {
  productId: ID;
  type: "sale" | "return" | "manual_in" | "manual_out" | "adjustment";
  quantity: number; // موجب = دخول، سالب = خروج
  refId?: ID; // مرجع (فاتورة/مرتجع)
  note?: string;
}

export interface AppSettings {
  id: "settings";
  shopName: string;
  currency: string;
  pin: string; // رقم سري بسيط
  invoiceCounter: number;
  returnCounter: number;
  taxRate: number; // نسبة مئوية، 0 افتراضياً
  footerNote?: string;
  updatedAt: number;
}

// أنواع Supabase الإضافية
export interface ProductBatch {
  id: number;
  product_id: number;
  batch_name: string;
  original_quantity: number;
  remaining_quantity: number;
  purchase_price: number;
  selling_price: number;
  marketing_price?: number;
  supplier?: string;
  expiry_date?: string;
  batch_code?: string;
  notes?: string;
  is_active: boolean;
  is_expired: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductPrice {
  id: number;
  product_id: number;
  price: number;
  type: 'selling' | 'purchase' | 'marketing';
  created_at: string;
  updated_at: string;
  is_active: boolean;
  effective_from?: string;
  effective_to?: string;
  notes?: string;
  quantity?: number;
}

export interface BatchSaleItem {
  id: number;
  sale_item_id: number;
  batch_id: number;
  quantity_sold: number;
  price_used: number;
  batch_name: string;
  created_at: string;
}

export interface CreditPayment {
  id: number;
  credit_id: number;
  amount: number;
  payment_method: string;
  notes?: string;
  created_at: string;
}

export interface CustomerCredit {
  id: number;
  customer_id: number;
  sale_id: number;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  status: 'مفتوح' | 'مغلق' | 'ملغي';
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface AppSetting {
  id: number;
  key: string;
  value: any;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: number;
  user_id?: string;
  activity_type: string;
  table_name: string;
  record_id?: number;
  old_values?: any;
  new_values?: any;
  description?: string;
  created_at: string;
  ip_address?: string;
  user_agent?: string;
}

export interface UserProfile {
  id: string;
  username?: string;
  full_name?: string;
  role: 'admin' | 'manager' | 'user';
  created_at: string;
  updated_at: string;
  is_active: boolean;
  preferences?: any;
  last_login?: string;
}
