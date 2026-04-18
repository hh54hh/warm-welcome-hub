import { db, getSupabase } from "./database";
import { pullFromSupabase } from "./services";
import type { BaseEntity } from "./types";

export interface SyncResult {
  success: boolean;
  errors?: string[];
  syncedRecords?: number;
}

const SYNC_BATCH_SIZE = 50;

// تعيين الجداول المراد مزامنتها
const SYNC_TABLES = [
  { name: "categories", table: db.categories, supabaseTable: "categories" },
  { name: "customers", table: db.customers, supabaseTable: "customers" },
  { name: "products", table: db.products, supabaseTable: "products" },
  { name: "invoices", table: db.invoices, supabaseTable: "sales" },
  { name: "payments", table: db.payments, supabaseTable: "credit_payments" },
  { name: "product_batches", table: db.product_batches, supabaseTable: "product_batches" },
  { name: "product_prices", table: db.product_prices, supabaseTable: "product_prices" },
] as const;

export async function getPendingRecords(): Promise<Array<{ table: string; record: BaseEntity }>> {
  const result: Array<{ table: string; record: BaseEntity }> = [];
  for (const item of SYNC_TABLES) {
    const records = await item.table.where("syncStatus").notEqual("synced").toArray();
    for (const record of records) {
      result.push({ table: item.name, record });
    }
  }
  return result;
}

export async function markRecordsSynced(table: string, ids: string[], remoteIds?: Record<string, string>) {
  const target = (db as any)[table];
  if (!target) return;
  await Promise.all(
    ids.map((id) =>
      target.update(id, {
        syncStatus: "synced",
        updatedAt: Date.now(),
        ...(remoteIds && remoteIds[id] ? { remoteId: remoteIds[id] } : {}),
      }),
    ),
  );
}

function normalizeId(raw: unknown): string | number | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const value = raw.trim();
    if (value === "") return undefined;
    const numericValue = Number(value);
    if (!Number.isNaN(numericValue) && Number.isInteger(numericValue)) {
      return numericValue;
    }
    return value;
  }
  return undefined;
}

// تحويل سجل محلي إلى تنسيق Supabase
async function resolveCategoryText(categoryId: unknown): Promise<string | null> {
  if (!categoryId) return null;
  const numericCategoryId = normalizeId(categoryId);
  if (numericCategoryId !== undefined) return numericCategoryId.toString();
  try {
    const category = await db.categories.get(categoryId.toString());
    return category?.name ?? null;
  } catch {
    return null;
  }
}

async function resolveRemoteId(tableName: string, localId: unknown): Promise<string | number | null> {
  if (!localId) return null;

  const parsedId = normalizeId(localId);
  if (parsedId !== undefined && typeof parsedId === "number") return parsedId;

  try {
    const record = await (db as any)[tableName].get(localId.toString());
    return normalizeId(record?.remoteId) ?? null;
  } catch {
    return null;
  }
}

async function resolveCustomerRemoteId(customerId: unknown): Promise<string | number | null> {
  return resolveRemoteId("customers", customerId);
}

async function transformRecordForSupabase(tableName: string, record: any): Promise<any> {
  const baseRecord = { ...record };

  // حذف الحقول المحلية فقط
  delete baseRecord.syncStatus;
  delete baseRecord.remoteId;

  // تحويل timestamps من epoch إلى ISO string
  if (baseRecord.createdAt) {
    baseRecord.created_at = new Date(baseRecord.createdAt).toISOString();
    delete baseRecord.createdAt;
  }
  if (baseRecord.updatedAt) {
    baseRecord.updated_at = new Date(baseRecord.updatedAt).toISOString();
    delete baseRecord.updatedAt;
  }

  const recordId = normalizeId(record.id);
  const remoteId = normalizeId(record.remoteId);

  switch (tableName) {
    case "products": {
      const categoryText = await resolveCategoryText(record.categoryId);
      // Schema: name, quantity, description, barcode, category, minimum_stock, is_active
      const payload: any = {
        name: record.name,
        barcode: record.sku || null,
        category: categoryText,
        quantity: Math.max(0, Math.floor(record.stock || 0)),
        minimum_stock: Math.max(0, Math.floor(record.minStock || 10)),
        description: record.notes || null,
        is_active: true,
        created_at: baseRecord.created_at,
        updated_at: baseRecord.updated_at,
      };
      if (remoteId !== undefined) payload.id = remoteId;
      else if (typeof recordId === "number") payload.id = recordId;
      return payload;
    }

    case "customers": {
      // Schema: name (non-empty), phone (non-empty), is_active
      const phone = (record.phone && record.phone.trim()) ? record.phone.trim() : "غير محدد";
      const payload: any = {
        name: record.name,
        phone,
        is_active: true,
        created_at: baseRecord.created_at,
        updated_at: baseRecord.updated_at,
      };
      if (remoteId !== undefined) payload.id = remoteId;
      else if (typeof recordId === "number") payload.id = recordId;
      return payload;
    }

    case "invoices": {
      const customerRemoteId = await resolveCustomerRemoteId(record.customerId);
      const defaultCustomerName = record.customerName || (record.customerPhone ? `زبون ${record.customerPhone}` : "زبون نقدي");
      const payload: any = {
        customer_id: customerRemoteId,
        customer_name: defaultCustomerName,
        customer_phone: record.customerPhone || null,
        total_price: record.total,
        discount_amount: record.discount,
        tax_amount: 0,
        payment_method: record.paymentMethod,
        notes: record.notes || null,
        invoice_number: record.number,
        payment_type: record.paymentMethod || "نقدي",
        is_credit: record.paymentMethod === "credit",
        created_at: baseRecord.created_at,
        updated_at: baseRecord.updated_at,
      };
      if (remoteId !== undefined) {
        payload.id = remoteId;
      } else if (typeof recordId === "number") {
        payload.id = recordId;
      }
      return payload;
    }

    case "payments": {
      const creditId = await resolveRemoteId("invoices", record.invoiceId);
      const payload: any = {
        credit_id: creditId ?? null,
        amount: record.amount,
        payment_method: record.method,
        notes: record.note || null,
        created_at: baseRecord.created_at,
      };
      if (remoteId !== undefined) payload.id = remoteId;
      else if (typeof recordId === "number") payload.id = recordId;
      return payload;
    }

    default:
      if (remoteId !== undefined) {
        baseRecord.id = remoteId;
      } else if (typeof recordId === "number") {
        baseRecord.id = recordId;
      } else {
        delete baseRecord.id;
      }
      return baseRecord;
  }
}

// مزامنة البيانات مع Supabase
export async function syncWithSupabase(): Promise<SyncResult> {
  const supabase = getSupabase();
  if (!supabase) {
    return { success: false, errors: ["Supabase client not configured"] };
  }

  console.log("🔄 بدء المزامنة مع Supabase...");

  const errors: string[] = [];
  let syncedCount = 0;

  try {
    // 1. تحميل التحديثات من Supabase أولاً
    const pullResult = await pullFromSupabase();
    if (!pullResult.success) {
      errors.push(...(pullResult.errors || []));
    }

    // 2. رفع السجلات المعلقة
    const pendingRecords = await getPendingRecords();
    console.log(`🔁 هناك ${pendingRecords.length} سجل (سجلات) في قائمة الانتظار للمزامنة.`);
    if (pendingRecords.length > 0) {
      console.log("🔁 السجلات المعلقة:", pendingRecords.map(({ table, record }) => ({ table, id: record.id, syncStatus: record.syncStatus })));
    }
    const deletedRecords = pendingRecords.filter((item) => item.record.syncStatus === "deleted");
    const activeRecords = pendingRecords.filter((item) => item.record.syncStatus !== "deleted");

    const syncRecord = async (table: string, record: any) => {
      const supabaseTable = SYNC_TABLES.find((t) => t.name === table)?.supabaseTable;
      if (!supabaseTable) return;

      const transformedRecord = await transformRecordForSupabase(table, record);
      const hasNumericId = transformedRecord.id !== undefined;
      const response = hasNumericId
        ? await supabase.from(supabaseTable).upsert(transformedRecord, { onConflict: "id" }).select()
        : await supabase.from(supabaseTable).insert(transformedRecord).select();

      const error = response.error;
      const responseData: any = response.data;
      const returnedData = Array.isArray(responseData) ? responseData[0] : responseData;
      const remoteId = returnedData?.id ? returnedData.id.toString() : undefined;

      if (error) {
        const missingRelation = /(relation ".*" does not exist|missing relation)/i.test(error.message || "");
        if (missingRelation) {
          console.warn(`Skipping sync for ${table} because remote table ${supabaseTable} does not exist: ${error.message}`);
          return;
        }
        errors.push(`Error syncing ${table} record ${record.id}: ${error.message}`);
        console.error(`❌ فشل مزامنة ${table} record ${record.id}:`, {
          message: error.message,
          status: response.status,
          data: response.data,
          hint: (response.error as any)?.hint,
          details: (response.error as any)?.details,
          transformedRecord,
        });
      } else {
        await markRecordsSynced(table, [record.id], remoteId ? { [record.id]: remoteId } : undefined);
        syncedCount++;
        console.log(`✅ تم مزامنة ${table} record ${record.id}`, remoteId ? `(remote id: ${remoteId})` : "");
      }
    };

    const deleteRecord = async (table: string, record: any) => {
      const supabaseTable = SYNC_TABLES.find((t) => t.name === table)?.supabaseTable;
      if (!supabaseTable) return;

      const target = (db as any)[table];
      const remoteKey = normalizeId(record.remoteId ?? record.id);

      // No remote id — just remove locally
      if (remoteKey === undefined) {
        if (target) await target.delete(record.id);
        syncedCount++;
        console.log(`🗑️ تم حذف ${table} record ${record.id} محلياً (بدون معرف بعيد)`);
        return;
      }

      // Try DELETE first; if FK constraint blocks it, fall back to soft delete via is_active=false
      let { error } = await supabase.from(supabaseTable).delete().eq("id", remoteKey);

      if (error) {
        const missingRelation = /(relation ".*" does not exist|missing relation)/i.test(error.message || "");
        if (missingRelation) {
          console.warn(`Skipping delete sync for ${table} because remote table ${supabaseTable} does not exist: ${error.message}`);
          if (target) await target.delete(record.id);
          syncedCount++;
          return;
        }

        // Foreign key violation — soft-delete remotely instead
        const fkConflict = /(foreign key|violates foreign key constraint|conflict)/i.test(error.message || "");
        if (fkConflict && (table === "customers" || table === "products" || table === "categories")) {
          const softPayload: any = { is_active: false, updated_at: new Date().toISOString() };
          const softResult = await supabase.from(supabaseTable).update(softPayload).eq("id", remoteKey);
          if (!softResult.error) {
            if (target) await target.delete(record.id);
            syncedCount++;
            console.log(`🗑️ تم تعطيل ${table} record ${record.id} (soft delete remote, FK محمي)`);
            return;
          }
          error = softResult.error;
        }

        errors.push(`Error deleting ${table} record ${record.id}: ${error.message}`);
        console.error(`❌ فشل حذف ${table} record ${record.id}:`, error);
      } else {
        // Success — physically remove from local DB
        if (target) await target.delete(record.id);
        syncedCount++;
        console.log(`🗑️ تم حذف ${table} record ${record.id} من السحابة والمحلي`);
      }
    };

    for (const { table, record } of activeRecords) {
      try {
        await syncRecord(table, record);
      } catch (err) {
        errors.push(`Failed to sync ${table} record ${record.id}: ${err}`);
      }
    }

    for (const { table, record } of deletedRecords.sort((a, b) => {
      const indexA = SYNC_TABLES.findIndex((t) => t.name === a.table);
      const indexB = SYNC_TABLES.findIndex((t) => t.name === b.table);
      return indexB - indexA;
    })) {
      try {
        await deleteRecord(table, record);
      } catch (err) {
        errors.push(`Failed to delete ${table} record ${record.id}: ${err}`);
      }
    }

    return {
      success: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      syncedRecords: syncedCount,
    };

  } catch (err) {
    return {
      success: false,
      errors: [`Sync failed: ${err}`],
    };
  }
}

// مزامنة تلقائية في الخلفية
export async function startBackgroundSync(intervalMinutes: number = 5) {
  const intervalMs = intervalMinutes * 60 * 1000;

  const syncLoop = async () => {
    try {
      const result = await syncWithSupabase();
      if (!result.success) {
        console.error("Background sync failed:", result.errors);
      } else if (result.syncedRecords && result.syncedRecords > 0) {
        console.log(`Synced ${result.syncedRecords} records`);
      }
    } catch (err) {
      console.error("Background sync error:", err);
    }
  };

  // مزامنة فورية عند البدء
  await syncLoop();

  // ثم كل فترة
  setInterval(syncLoop, intervalMs);
}
