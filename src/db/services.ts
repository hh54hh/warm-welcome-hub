// طبقة الخدمات: كل العمليات على البيانات تمر من هنا
// هكذا نضمن أن الانتقال للسحابة لاحقاً يكون بتعديل هذا الملف فقط.
import { db, ensureSettings, formatInvoiceNumber, formatReturnNumber, now, uid, getSupabase, initSupabase } from "./database";
import { syncWithSupabase, startBackgroundSync } from "./sync";
import type {
  Product,
  Category,
  Invoice,
  InvoiceItem,
  ReturnRecord,
  ReturnItem,
  PaymentMethod,
  Customer,
  PaymentRecord,
  ProductBatch,
  ProductPrice,
  CustomerCredit,
  CreditPayment,
} from "./types";

/* ========== المنتجات ========== */
export async function listProducts() {
  return db.products.orderBy("updatedAt").reverse().toArray();
}

export async function getProduct(id: string) {
  return db.products.get(id);
}

export async function searchProducts(q: string) {
  const term = q.trim().toLowerCase();
  if (!term) return listProducts();
  const all = await db.products.toArray();
  return all.filter(
    (p) =>
      p.name.toLowerCase().includes(term) ||
      p.sku.toLowerCase().includes(term) ||
      (p.model?.toLowerCase().includes(term) ?? false) ||
      (p.brand?.toLowerCase().includes(term) ?? false),
  );
}

async function upsertLocalPriceRecords(productId: string, costPrice: number, salePrice: number) {
  const ts = now();
  // ابحث عن سجلات الأسعار المحلية لهذا المنتج
  const existing = await db.product_prices.where('productId').equals(productId).toArray();

  const findByType = (type: string) => existing.find((p) => p.type === type);

  // سعر الشراء
  if (costPrice !== undefined && costPrice !== null) {
    const purchase = findByType('شراء');
    if (purchase) {
      if (purchase.price !== costPrice) {
        await db.product_prices.update(purchase.id, {
          price: costPrice,
          isActive: true,
          updatedAt: ts,
          syncStatus: "local",
        });
      }
    } else {
      await db.product_prices.add({
        id: uid(),
        productId,
        price: costPrice,
        type: 'شراء',
        isActive: true,
        effectiveFrom: ts,
        quantity: 0,
        createdAt: ts,
        updatedAt: ts,
        syncStatus: "local",
      } as any);
    }
  }

  // سعر البيع
  if (salePrice !== undefined && salePrice !== null) {
    const selling = findByType('بيع');
    if (selling) {
      if (selling.price !== salePrice) {
        await db.product_prices.update(selling.id, {
          price: salePrice,
          isActive: true,
          updatedAt: ts,
          syncStatus: "local",
        });
      }
    } else {
      await db.product_prices.add({
        id: uid(),
        productId,
        price: salePrice,
        type: 'بيع',
        isActive: true,
        effectiveFrom: ts,
        quantity: 0,
        createdAt: ts,
        updatedAt: ts,
        syncStatus: "local",
      } as any);
    }
  }
}

export async function createProduct(
  data: Omit<Product, "id" | "createdAt" | "updatedAt" | "syncStatus">,
) {
  const product: Product = {
    ...data,
    id: uid(),
    createdAt: now(),
    updatedAt: now(),
    syncStatus: "local",
  };
  await db.products.add(product);
  // أنشئ سجلات الأسعار محلياً ليتم رفعها للـ product_prices
  await upsertLocalPriceRecords(product.id, product.costPrice ?? 0, product.salePrice ?? 0);
  // Trigger background sync (non-blocking)
  if (getSupabase()) {
    syncWithSupabase().catch((err) => console.warn("Auto-sync after createProduct failed:", err));
  }
  return product;
}

export async function updateProduct(id: string, patch: Partial<Product>) {
  await db.products.update(id, { ...patch, updatedAt: now(), syncStatus: "local" });
  const updated = await db.products.get(id);
  // إذا تغيّر السعر — حدّث سجلات product_prices المحلية أيضاً ليتم رفعها
  if (updated && (patch.costPrice !== undefined || patch.salePrice !== undefined)) {
    await upsertLocalPriceRecords(id, updated.costPrice ?? 0, updated.salePrice ?? 0);
  }
  if (getSupabase()) {
    syncWithSupabase().catch((err) => console.warn("Auto-sync after updateProduct failed:", err));
  }
  return updated;
}

export async function deleteProduct(id: string) {
  // Soft delete so the sync layer can propagate it to Supabase
  const existing = await db.products.get(id);
  if (!existing) return;
  if (existing.remoteId) {
    await db.products.update(id, {
      syncStatus: "deleted",
      deletedAt: now(),
      updatedAt: now(),
    });
    if (getSupabase()) {
      syncWithSupabase().catch((err) => console.warn("Auto-sync after deleteProduct failed:", err));
    }
  } else {
    // Never reached the cloud, safe to fully remove locally
    await db.products.delete(id);
  }
}

export async function adjustStock(productId: string, delta: number, note?: string) {
  const p = await db.products.get(productId);
  if (!p) throw new Error("منتج غير موجود");
  const newStock = p.stock + delta;
  if (newStock < 0) throw new Error("لا توجد كمية كافية في المخزن");
  await db.products.update(productId, {
    stock: newStock,
    updatedAt: now(),
    syncStatus: "local", // Critical: mark dirty so pull doesn't overwrite
  });
  await db.movements.add({
    id: uid(),
    productId,
    type: delta >= 0 ? "manual_in" : "manual_out",
    quantity: delta,
    note,
    createdAt: now(),
    updatedAt: now(),
    syncStatus: "local",
  });
  if (getSupabase()) {
    syncWithSupabase().catch((err) => console.warn("Auto-sync after adjustStock failed:", err));
  }
}

/* ========== الفئات ========== */
export async function listCategories() {
  return db.categories.orderBy("name").toArray();
}
export async function createCategory(name: string): Promise<Category> {
  const c: Category = {
    id: uid(),
    name,
    createdAt: now(),
    updatedAt: now(),
    syncStatus: "local",
  };
  await db.categories.add(c);
  return c;
}
export async function deleteCategory(id: string) {
  await db.categories.delete(id);
}

/* ========== الزبائن ========== */
export async function listCustomers() {
  return db.customers
    .orderBy("name")
    .toArray()
    .then((customers) => customers.filter((c) => !c.deletedAt));
}

export async function getCustomer(id: string) {
  const customer = await db.customers.get(id);
  if (customer?.deletedAt) return undefined;
  return customer;
}

export async function searchCustomers(q: string) {
  const term = q.trim().toLowerCase();
  if (!term) return listCustomers();
  const all = await db.customers.toArray();
  return all
    .filter((c) => !c.deletedAt)
    .filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        (c.phone?.toLowerCase().includes(term) ?? false) ||
        (c.email?.toLowerCase().includes(term) ?? false),
    );
}

export async function createCustomer(
  data: Omit<Customer, "id" | "createdAt" | "updatedAt" | "syncStatus">,
): Promise<Customer> {
  const customer: Customer = {
    ...data,
    id: uid(),
    createdAt: now(),
    updatedAt: now(),
    syncStatus: "local",
  };
  await db.customers.add(customer);
  if (getSupabase()) {
    syncWithSupabase().catch((err) => console.warn("Auto-sync after createCustomer failed:", err));
  }
  return customer;
}

export async function updateCustomer(id: string, patch: Partial<Customer>) {
  await db.customers.update(id, { ...patch, updatedAt: now(), syncStatus: "local" });
  if (getSupabase()) {
    syncWithSupabase().catch((err) => console.warn("Auto-sync after updateCustomer failed:", err));
  }
  return db.customers.get(id);
}

export async function deleteCustomer(id: string) {
  const customer = await db.customers.get(id);
  if (!customer) return;

  await db.transaction("rw", [db.customers, db.invoices, db.payments, db.customer_credits, db.credit_payments], async () => {
    // Detach customer from invoices and mark them pending so the change is pushed
    await db.invoices.where("customerId").equals(id).modify({
      customerId: undefined,
      customerName: undefined,
      customerPhone: undefined,
      updatedAt: now(),
      syncStatus: "local",
    });
    // Local-only payment & credit records — local deletes are fine
    await db.payments.where("customerId").equals(id).delete();
    await db.customer_credits.where("customer_id").equals(id).delete();

    if (customer.remoteId) {
      // Soft delete: sync layer will DELETE on Supabase
      await db.customers.update(id, {
        syncStatus: "deleted",
        deletedAt: now(),
        updatedAt: now(),
      });
    } else {
      // Never synced — just remove locally
      await db.customers.delete(id);
    }
  });

  if (getSupabase()) {
    syncWithSupabase().catch((err) => console.warn("Auto-sync after deleteCustomer failed:", err));
  }
}

export async function listPayments() {
  return db.payments.orderBy("createdAt").reverse().toArray();
}

export async function createPaymentRecord(input: {
  invoiceId?: string;
  customerId?: string;
  method: PaymentMethod;
  amount: number;
  currency?: string;
  note?: string;
  status?: "completed" | "pending" | "failed";
  paidAt?: number;
}): Promise<PaymentRecord> {
  const record: PaymentRecord = {
    id: uid(),
    invoiceId: input.invoiceId,
    customerId: input.customerId,
    method: input.method,
    amount: input.amount,
    currency: input.currency ?? "د.ع",
    status: input.status ?? "completed",
    note: input.note,
    paidAt: input.paidAt ?? now(),
    createdAt: now(),
    updatedAt: now(),
    syncStatus: "local",
  };
  await db.payments.add(record);
  return record;
}

export async function getCustomerBalance(customerId: string) {
  const invoices = await db.invoices.where("customerId").equals(customerId).toArray();
  return invoices.reduce((sum, inv) => sum + (inv.total - inv.paid), 0);
}

/* ========== الفواتير ========== */
export interface CreateInvoiceInput {
  items: InvoiceItem[];
  discount: number;
  paid: number;
  paymentMethod: PaymentMethod;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
}

export async function createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
  if (!input.items.length) throw new Error("لا توجد منتجات في الفاتورة");

  return db.transaction("rw", [db.invoices, db.products, db.movements, db.settings, db.customers], async () => {
    // تحقق من المخزون
    for (const item of input.items) {
      const p = await db.products.get(item.productId);
      if (!p) throw new Error(`منتج محذوف: ${item.name}`);
      if (p.stock < item.quantity)
        throw new Error(`الكمية غير كافية للمنتج: ${p.name} (المتاح ${p.stock})`);
    }

    const settings = await ensureSettings();
    const nextNumber = settings.invoiceCounter + 1;

    const customer = input.customerId ? await db.customers.get(input.customerId) : undefined;
    const subtotal = input.items.reduce((s, i) => s + i.total, 0);
    const total = Math.max(0, subtotal - input.discount);
    const change = Math.max(0, input.paid - total);

    const invoice: Invoice = {
      id: uid(),
      number: formatInvoiceNumber(nextNumber),
      items: input.items,
      subtotal,
      discount: input.discount,
      total,
      paid: input.paid,
      change,
      paymentMethod: input.paymentMethod,
      customerId: input.customerId,
      customerName: input.customerName ?? customer?.name,
      customerPhone: input.customerPhone ?? customer?.phone,
      notes: input.notes,
      status: "completed",
      createdAt: now(),
      updatedAt: now(),
      syncStatus: "local",
    };

    await db.invoices.add(invoice);
    await db.settings.update("settings", { invoiceCounter: nextNumber, updatedAt: now() });

    // خصم المخزون + حركات
    for (const item of input.items) {
      const p = await db.products.get(item.productId);
      if (!p) continue;
      await db.products.update(item.productId, {
        stock: p.stock - item.quantity,
        updatedAt: now(),
      });
      await db.movements.add({
        id: uid(),
        productId: item.productId,
        type: "sale",
        quantity: -item.quantity,
        refId: invoice.id,
        createdAt: now(),
        updatedAt: now(),
        syncStatus: "local",
      });
    }

    return invoice;
  });
}

export async function listInvoices() {
  return db.invoices.orderBy("createdAt").reverse().toArray();
}
export async function getInvoice(id: string) {
  return db.invoices.get(id);
}

/* ========== المرتجعات ========== */
export interface CreateReturnInput {
  invoiceId: string;
  items: ReturnItem[]; // الكميات المراد ارجاعها
  reason?: string;
}

export async function createReturn(input: CreateReturnInput): Promise<ReturnRecord> {
  return db.transaction(
    "rw",
    [db.invoices, db.products, db.movements, db.returns, db.settings],
    async () => {
      const inv = await db.invoices.get(input.invoiceId);
      if (!inv) throw new Error("فاتورة غير موجودة");

      // تحقق أن كميات الإرجاع <= الكميات الأصلية
      for (const r of input.items) {
        const original = inv.items.find((i) => i.productId === r.productId);
        if (!original) throw new Error("منتج ليس ضمن الفاتورة");
        if (r.quantity <= 0) throw new Error("كمية إرجاع غير صحيحة");
        if (r.quantity > original.quantity)
          throw new Error(`أقصى كمية للارجاع للمنتج ${original.name} هي ${original.quantity}`);
      }

      const settings = await ensureSettings();
      const nextRet = settings.returnCounter + 1;
      const total = input.items.reduce((s, i) => s + i.total, 0);

      const rec: ReturnRecord = {
        id: uid(),
        number: formatReturnNumber(nextRet),
        invoiceId: inv.id,
        invoiceNumber: inv.number,
        items: input.items,
        total,
        reason: input.reason,
        createdAt: now(),
        updatedAt: now(),
        syncStatus: "local",
      };
      await db.returns.add(rec);
      await db.settings.update("settings", { returnCounter: nextRet, updatedAt: now() });

      // إعادة الكمية للمخزن + تحديث الفاتورة الأصلية
      for (const r of input.items) {
        const p = await db.products.get(r.productId);
        if (p) {
          await db.products.update(r.productId, {
            stock: p.stock + r.quantity,
            updatedAt: now(),
          });
        }
        await db.movements.add({
          id: uid(),
          productId: r.productId,
          type: "return",
          quantity: r.quantity,
          refId: rec.id,
          createdAt: now(),
          updatedAt: now(),
          syncStatus: "local",
        });
      }

      const originalSubtotal = inv.items.reduce((sum, item) => sum + item.total, 0);
      const updatedItems = inv.items
        .map((item) => {
          const returned = input.items.find((r) => r.productId === item.productId);
          if (!returned) return item;
          const remainingQty = item.quantity - returned.quantity;
          const unitTotal = item.quantity > 0 ? item.total / item.quantity : 0;
          if (remainingQty <= 0) return null;
          return {
            ...item,
            quantity: remainingQty,
            total: Math.round(unitTotal * remainingQty),
          };
        })
        .filter(Boolean) as typeof inv.items;

      const newSubtotal = updatedItems.reduce((sum, item) => sum + item.total, 0);
      const newDiscount = originalSubtotal > 0 ? Math.round((newSubtotal / originalSubtotal) * inv.discount) : 0;
      const newTotal = Math.max(0, newSubtotal - newDiscount);
      const newChange = Math.max(0, inv.paid - newTotal);

      const allReturns = await db.returns.where("invoiceId").equals(inv.id).toArray();
      const returnedQtyByProduct = new Map<string, number>();
      for (const ret of allReturns) {
        for (const it of ret.items) {
          returnedQtyByProduct.set(
            it.productId,
            (returnedQtyByProduct.get(it.productId) ?? 0) + it.quantity,
          );
        }
      }
      const fullyReturned = inv.items.every(
        (i) => (returnedQtyByProduct.get(i.productId) ?? 0) >= i.quantity,
      );
      const newStatus = fullyReturned ? "returned" : "partially_returned";

      await db.invoices.update(inv.id, {
        items: updatedItems,
        subtotal: newSubtotal,
        discount: newDiscount,
        total: newTotal,
        change: newChange,
        status: newStatus,
        updatedAt: now(),
      });

      return rec;
    },
  );
}

export async function listReturns() {
  return db.returns.orderBy("createdAt").reverse().toArray();
}

export async function returnsForInvoice(invoiceId: string) {
  return db.returns.where("invoiceId").equals(invoiceId).toArray();
}

/* ========== لوحة المعلومات ========== */
export async function dashboardStats() {
  const [products, invoices, returns] = await Promise.all([
    db.products.toArray(),
    db.invoices.toArray(),
    db.returns.toArray(),
  ]);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayMs = todayStart.getTime();
  const todayInvoices = invoices.filter((i) => i.createdAt >= todayMs);
  const todaySales = todayInvoices.reduce((s, i) => s + i.total, 0);
  const todayReturns = returns
    .filter((r) => r.createdAt >= todayMs)
    .reduce((s, r) => s + r.total, 0);
  const lowStock = products.filter((p) => p.stock <= p.minStock).length;
  const totalProducts = products.length;
  const stockValue = products.reduce((s, p) => s + p.stock * p.costPrice, 0);
  return {
    todaySales,
    todayInvoiceCount: todayInvoices.length,
    todayReturns,
    lowStock,
    totalProducts,
    stockValue,
    totalInvoices: invoices.length,
  };
}

/* ========== المزامنة مع Supabase ========== */

let syncInitialized = false;

// تهيئة المزامنة
export async function initializeSync() {
  if (syncInitialized) return true;

  // التحقق من وجود متغيرات البيئة
  if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
    console.warn("Supabase environment variables not set. Running in offline mode only.");
    return false;
  }

  try {
    // تهيئة Supabase client
    await initSupabase();

    // بدء المزامنة في الخلفية
    await startBackgroundSync(5); // كل 5 دقائق
    syncInitialized = true;
    console.log("Background sync initialized");
    return true;
  } catch (error) {
    console.error("Failed to initialize sync:", error);
    return false;
  }
}

// مزامنة يدوية
export async function manualSync() {
  try {
    const result = await syncWithSupabase();
    return result;
  } catch (error) {
    return {
      success: false,
      errors: [`Sync failed: ${error}`],
    };
  }
}

// تحميل البيانات من Supabase إلى القاعدة المحلية
export async function pullFromSupabase() {
  const supabaseClient = getSupabase();
  if (!supabaseClient) return { success: false, errors: ["Supabase not configured"] };

  try {
    const errors: string[] = [];

    // تحميل المنتجات النشطة فقط — تجاهل المحذوف ناعمياً
    const { data: products, error: productsError } = await supabaseClient
      .from("products")
      .select("*")
      .eq("is_active", true);

    if (productsError) {
      errors.push(`Products sync error: ${productsError.message}`);
    } else if (products) {
      const activeRemoteIds = new Set(products.map((p: any) => p.id.toString()));

      // أزل محلياً أي منتج يحمل remoteId لكنه لم يعد نشطاً في السحابة (محذوف)
      const allLocal = await db.products.toArray();
      for (const local of allLocal) {
        if (!local.remoteId) continue;
        if (local.syncStatus && local.syncStatus !== "synced") continue; // فيه تغييرات معلّقة
        if (!activeRemoteIds.has(local.remoteId.toString())) {
          await db.products.delete(local.id);
        }
      }

      for (const product of products) {
        const existingProduct = await db.products.where('remoteId').equals(product.id.toString()).first();

        // CRITICAL: never overwrite local records that have unpushed changes
        if (existingProduct && existingProduct.syncStatus && existingProduct.syncStatus !== "synced") {
          continue;
        }

        const productData = {
          name: product.name,
          sku: product.barcode || product.id.toString(),
          categoryId: product.category?.toString(),
          costPrice: existingProduct?.costPrice ?? 0, // prices live in product_prices; keep local
          salePrice: existingProduct?.salePrice ?? 0,
          stock: product.quantity || 0,
          minStock: product.minimum_stock || product.min_stock || 10,
          notes: product.description,
          unit: existingProduct?.unit,
          brand: existingProduct?.brand,
          model: existingProduct?.model,
          createdAt: new Date(product.created_at).getTime(),
          updatedAt: new Date(product.updated_at).getTime(),
          syncStatus: "synced" as const,
          remoteId: product.id.toString(),
        };

        if (existingProduct) {
          await db.products.update(existingProduct.id, productData);
        } else {
          await db.products.put({
            id: product.id.toString(),
            ...productData,
          });
        }
      }
    }

    // تحميل الزبائن
    const { data: customers, error: customersError } = await supabaseClient
      .from("customers")
      .select("*");

    if (customersError) {
      errors.push(`Customers sync error: ${customersError.message}`);
    } else if (customers) {
      for (const customer of customers) {
        const existingCustomer = await db.customers.where('remoteId').equals(customer.id.toString()).first();
        if (existingCustomer?.deletedAt) continue;
        // Skip customers that have local pending changes
        if (existingCustomer && existingCustomer.syncStatus && existingCustomer.syncStatus !== "synced") {
          continue;
        }
        // Skip inactive customers from the cloud (treated as deleted)
        if (customer.is_active === false) {
          if (existingCustomer && !existingCustomer.deletedAt) {
            await db.customers.delete(existingCustomer.id);
          }
          continue;
        }

        const customerData = {
          name: customer.name,
          phone: customer.phone,
          createdAt: new Date(customer.created_at).getTime(),
          updatedAt: new Date(customer.updated_at).getTime(),
          syncStatus: "synced" as const,
          remoteId: customer.id.toString(),
        };

        if (existingCustomer) {
          await db.customers.update(existingCustomer.id, customerData);
        } else {
          await db.customers.put({
            id: customer.id.toString(),
            ...customerData,
          });
        }
      }
    }

    // تحميل الفئات
    const { data: categories, error: categoriesError } = await supabaseClient
      .from("categories")
      .select("*");

    if (categoriesError) {
      const missingTable = categoriesError.message?.includes("relation \"public.categories\" does not exist");
      if (missingTable) {
        console.warn("Categories table does not exist in Supabase; skipping categories sync.");
      } else {
        errors.push(`Categories sync error: ${categoriesError.message}`);
      }
    } else if (categories) {
      for (const category of categories) {
        const existingCategory = await db.categories.where('remoteId').equals(category.id.toString()).first();

        const categoryData = {
          name: category.name,
          description: category.description || "",
          createdAt: new Date(category.created_at).getTime(),
          updatedAt: new Date(category.updated_at).getTime(),
          syncStatus: "synced" as const,
          remoteId: category.id.toString(),
        };

        if (existingCategory) {
          // Update existing local record
          await db.categories.update(existingCategory.id, categoryData);
        } else {
          // Add new record
          await db.categories.put({
            id: category.id.toString(),
            ...categoryData,
          });
        }
      }
    }

    // تحميل المبيعات (الفواتير)
    const { data: sales, error: salesError } = await supabaseClient
      .from("sales")
      .select("*, sale_items(*)");

    if (salesError) {
      errors.push(`Sales sync error: ${salesError.message}`);
    } else if (sales) {
      for (const sale of sales) {
        const existingInvoice = await db.invoices.where('remoteId').equals(sale.id.toString()).first();

        const items: InvoiceItem[] = sale.sale_items?.map((item: any) => ({
          productId: item.product_id?.toString() ?? "",
          name: item.product_name || "",
          sku: item.product_sku || item.product_id?.toString() || "",
          unitPrice: item.price_used || 0,
          quantity: item.quantity || 0,
          discount: item.discount_amount || 0,
          total: item.line_total || 0,
        })) || [];

        const totalPrice = sale.total_price ?? items.reduce((sum, item) => sum + item.total, 0);
        const paidAmount = sale.paid_amount ?? (sale.is_credit ? 0 : totalPrice);
        const changeAmount = Math.max(0, paidAmount - totalPrice);

        const invoiceData = {
          number: sale.invoice_number || `INV-${sale.id}`,
          items,
          subtotal: items.reduce((sum, item) => sum + item.total, 0),
          discount: sale.discount_amount || 0,
          total: totalPrice,
          paid: paidAmount,
          change: changeAmount,
          paymentMethod: sale.payment_method as PaymentMethod,
          customerId: sale.customer_id?.toString(),
          customerName: sale.customer_name,
          customerPhone: sale.customer_phone,
          status: "completed" as const,
          createdAt: new Date(sale.created_at).getTime(),
          updatedAt: new Date(sale.updated_at).getTime(),
          syncStatus: "synced" as const,
          remoteId: sale.id.toString(),
        };

        if (existingInvoice) {
          // Update existing local record
          await db.invoices.update(existingInvoice.id, invoiceData);
        } else {
          // Add new record
          await db.invoices.put({
            id: sale.id.toString(),
            ...invoiceData,
          });
        }
      }
    }

    // تحميل دفعات المنتجات
    const { data: productBatches, error: productBatchesError } = await supabaseClient
      .from("product_batches")
      .select("*");

    if (productBatchesError) {
      errors.push(`Product batches sync error: ${productBatchesError.message}`);
    } else if (productBatches) {
      for (const batch of productBatches) {
        const existingBatch = await db.product_batches.where('remoteId').equals(batch.id.toString()).first();

        const batchData = {
          productId: batch.product_id.toString(),
          batchName: batch.batch_name,
          originalQuantity: batch.original_quantity,
          remainingQuantity: batch.remaining_quantity,
          purchasePrice: batch.purchase_price,
          sellingPrice: batch.selling_price,
          marketingPrice: batch.marketing_price,
          supplier: batch.supplier,
          expiryDate: batch.expiry_date ? new Date(batch.expiry_date).getTime() : undefined,
          batchCode: batch.batch_code,
          notes: batch.notes,
          isActive: batch.is_active,
          isExpired: batch.is_expired,
          createdAt: new Date(batch.created_at).getTime(),
          updatedAt: new Date(batch.updated_at).getTime(),
          syncStatus: "synced",
          remoteId: batch.id.toString(),
        };

        if (existingBatch) {
          // Update existing local record
          await db.product_batches.update(existingBatch.id, batchData);
        } else {
          // Add new record
          await db.product_batches.put({
            id: batch.id.toString(),
            ...batchData,
          });
        }
      }
    }

    // تحميل أسعار المنتجات
    const { data: productPrices, error: productPricesError } = await supabaseClient
      .from("product_prices")
      .select("*");

    if (productPricesError) {
      errors.push(`Product prices sync error: ${productPricesError.message}`);
    } else if (productPrices) {
      for (const price of productPrices) {
        const existingPrice = await db.product_prices.where('remoteId').equals(price.id.toString()).first();

        const priceData = {
          productId: price.product_id.toString(),
          price: price.price,
          type: price.type,
          isActive: price.is_active,
          effectiveFrom: price.effective_from ? new Date(price.effective_from).getTime() : Date.now(),
          effectiveTo: price.effective_to ? new Date(price.effective_to).getTime() : undefined,
          notes: price.notes,
          quantity: price.quantity || 0,
          createdAt: new Date(price.created_at).getTime(),
          updatedAt: new Date(price.updated_at).getTime(),
          syncStatus: "synced",
          remoteId: price.id.toString(),
        };

        if (existingPrice) {
          // Update existing local record
          await db.product_prices.update(existingPrice.id, priceData);
        } else {
          // Add new record
          await db.product_prices.put({
            id: price.id.toString(),
            ...priceData,
          });
        }
      }

      // تحديث أسعار المنتجات في جدول products بناءً على product_prices
      // ملاحظة: نستخدم remoteId للبحث لأن الـ id المحلي عبارة عن UUID للمنتجات الجديدة
      const productPriceMap = new Map<string, { purchase: number; selling: number; marketing: number }>();
      for (const price of productPrices) {
        const productRemoteId = price.product_id.toString();
        if (!productPriceMap.has(productRemoteId)) {
          productPriceMap.set(productRemoteId, { purchase: 0, selling: 0, marketing: 0 });
        }
        const prices = productPriceMap.get(productRemoteId)!;
        if (!price.is_active) continue;
        if (price.type === 'بيع' || price.type === 'selling') {
          prices.selling = Number(price.price) || prices.selling;
        } else if (price.type === 'شراء' || price.type === 'purchase') {
          prices.purchase = Number(price.price) || prices.purchase;
        } else if (price.type === 'تسويق' || price.type === 'marketing') {
          prices.marketing = Number(price.price) || prices.marketing;
        }
      }

      // تحديث المنتجات بالأسعار الجديدة — البحث بـ remoteId أو id
      for (const [productRemoteId, prices] of productPriceMap) {
        // فقط حدّث إذا كانت لدينا أسعار فعلية (تجنب الكتابة فوق المحلي بأصفار)
        if (prices.purchase === 0 && prices.selling === 0) continue;

        let target = await db.products.where('remoteId').equals(productRemoteId).first();
        if (!target) target = await db.products.get(productRemoteId);
        if (!target) continue;
        // لا تكتب فوق منتج فيه تغييرات محلية معلّقة
        if (target.syncStatus && target.syncStatus !== "synced") continue;

        await db.products.update(target.id, {
          costPrice: prices.purchase || target.costPrice || 0,
          salePrice: prices.selling || target.salePrice || 0,
          updatedAt: Date.now(),
        });
      }
    }

    // تحميل ديون الزبائن
    const { data: customerCredits, error: customerCreditsError } = await supabaseClient
      .from("customer_credits")
      .select("*");

    if (customerCreditsError) {
      errors.push(`Customer credits sync error: ${customerCreditsError.message}`);
    } else if (customerCredits) {
      for (const credit of customerCredits) {
        await db.customer_credits.put({
          id: credit.id.toString(),
          customer_id: credit.customer_id?.toString(),
          sale_id: credit.sale_id?.toString(),
          total_amount: credit.total_amount,
          paid_amount: credit.paid_amount,
          remaining_amount: credit.remaining_amount,
          status: credit.status,
          notes: credit.notes,
          created_at: credit.created_at,
          updated_at: credit.updated_at,
          syncStatus: "synced",
        });
      }
    }

    return {
      success: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };

  } catch (error) {
    return {
      success: false,
      errors: [`Pull failed: ${error}`],
    };
  }
}

// التحقق من حالة الاتصال
export async function checkOnlineStatus() {
  const supabaseClient = getSupabase();
  if (!supabaseClient) return false;

  try {
    const { error } = await supabaseClient.from("products").select("id").limit(1);
    return !error;
  } catch {
    return false;
  }
}
