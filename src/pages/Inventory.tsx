import { useMemo, useState } from "react";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertTriangle,
  Package as PackageIcon,
  ArrowDownUp,
  CheckCircle,
  Loader,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import type { Product } from "@/db/types";
import { adjustStock, createProduct, deleteProduct, updateProduct } from "@/db/services";
import { fmtCurrency, fmtNumber } from "@/lib/format";
import { toast } from "sonner";
import { z } from "zod";

const productSchema = z.object({
  name: z.string().trim().min(1, "الاسم مطلوب").max(120),
  sku: z.string().trim().min(1, "الكود مطلوب").max(60),
  model: z.string().trim().max(80).optional().or(z.literal("")),
  brand: z.string().trim().max(80).optional().or(z.literal("")),
  costPrice: z.number().nonnegative(),
  salePrice: z.number().nonnegative(),
  stock: z.number().int().nonnegative(),
  minStock: z.number().int().nonnegative(),
  unit: z.string().trim().max(20).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

const empty: Partial<Product> = {
  name: "",
  sku: "",
  model: "",
  brand: "",
  costPrice: 0,
  salePrice: 0,
  stock: 0,
  minStock: 1,
  unit: "قطعة",
  notes: "",
};

const Inventory = () => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<Partial<Product>>(empty);
  const [toDelete, setToDelete] = useState<Product | null>(null);
  const [adjustOpen, setAdjustOpen] = useState<Product | null>(null);
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustNote, setAdjustNote] = useState("");

  const products = useLiveQuery(() =>
    db.products
      .orderBy("updatedAt")
      .reverse()
      .toArray()
      .then((list) => list.filter((p) => !p.deletedAt && p.syncStatus !== "deleted")),
  );

  const filtered = useMemo(() => {
    const list = products ?? [];
    const term = query.trim().toLowerCase();
    const result = term
      ? list.filter(
          (p) =>
            p.name.toLowerCase().includes(term) ||
            p.sku.toLowerCase().includes(term) ||
            (p.model?.toLowerCase().includes(term) ?? false) ||
            (p.brand?.toLowerCase().includes(term) ?? false),
        )
      : list;

    // طباعة معلومات المزامنة
    const synced = list.filter(p => p.syncStatus === "synced").length;
    const pending = list.filter(p => p.syncStatus !== "synced").length;
    console.log(`📦 المنتجات: إجمالي ${list.length}, متزامن ${synced}, معلق ${pending}`);
    if (pending > 0) {
      console.log("📦 المنتجات غير المتزامنة:", list.filter(p => p.syncStatus !== "synced").map(p => `${p.name} (${p.syncStatus})`));
    }

    return result;
  }, [products, query]);

  const openNew = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm(p);
    setOpen(true);
  };

  const save = async () => {
    const parsed = productSchema.safeParse({
      name: form.name,
      sku: form.sku,
      model: form.model ?? "",
      brand: form.brand ?? "",
      costPrice: Number(form.costPrice ?? 0),
      salePrice: Number(form.salePrice ?? 0),
      stock: Number(form.stock ?? 0),
      minStock: Number(form.minStock ?? 0),
      unit: form.unit ?? "",
      notes: form.notes ?? "",
    });
    if (!parsed.success) {
      const first = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0];
      toast.error(first ?? "بيانات غير صالحة");
      return;
    }
    try {
      if (editing) {
        await updateProduct(editing.id, parsed.data as any);
        toast.success("تم تحديث المنتج");
      } else {
        await createProduct(parsed.data as any);
        toast.success("تمت إضافة المنتج");
      }
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر الحفظ");
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    await deleteProduct(toDelete.id);
    toast.success("تم حذف المنتج");
    setToDelete(null);
  };

  const doAdjust = async () => {
    if (!adjustOpen || !adjustQty) {
      setAdjustOpen(null);
      return;
    }
    try {
      await adjustStock(adjustOpen.id, Math.trunc(adjustQty), adjustNote || undefined);
      toast.success("تم تعديل المخزون");
      setAdjustOpen(null);
      setAdjustQty(0);
      setAdjustNote("");
    } catch (e: any) {
      toast.error(e?.message ?? "خطأ");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">المخزن والمنتجات</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            إدارة شاملة للمنتجات، الأسعار، والكميات
          </p>
        </div>
        <Button onClick={openNew} className="gradient-gold text-primary font-semibold">
          <Plus className="ml-2 h-4 w-4" />
          إضافة منتج جديد
        </Button>
      </div>

      <div className="surface-card p-4">
        <div className="relative mb-4">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="بحث بالاسم، الكود، الموديل، الماركة..."
            className="pr-10"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <PackageIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>لا توجد منتجات بعد</p>
            <Button variant="outline" onClick={openNew} className="mt-4">
              <Plus className="ml-2 h-4 w-4" /> أضف أول منتج
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-right">
                <tr>
                  <th className="py-3 px-3 font-semibold">المنتج</th>
                  <th className="py-3 px-3 font-semibold">الكود/الموديل</th>
                  <th className="py-3 px-3 font-semibold">الكلفة</th>
                  <th className="py-3 px-3 font-semibold">البيع</th>
                  <th className="py-3 px-3 font-semibold">المخزن</th>
                  <th className="py-3 px-3 font-semibold text-left">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const low = p.stock <= p.minStock;
                  return (
                    <tr
                      key={p.id}
                      className="border-t hover:bg-muted/30 transition-colors"
                    >
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="font-semibold">{p.name}</div>
                          {p.syncStatus === "synced" ? (
                            <span title="متزامن" className="inline-flex"><CheckCircle className="h-4 w-4 text-green-500" /></span>
                          ) : (
                            <span title="قيد المزامنة" className="inline-flex"><Loader className="h-4 w-4 text-blue-500 animate-spin" /></span>
                          )}
                        </div>
                        {p.brand && (
                          <div className="text-xs text-muted-foreground">{p.brand}</div>
                        )}
                      </td>
                      <td className="py-3 px-3 nums">
                        <div>{p.sku}</div>
                        {p.model && (
                          <div className="text-xs text-muted-foreground">{p.model}</div>
                        )}
                      </td>
                      <td className="py-3 px-3 nums">{fmtCurrency(p.costPrice)}</td>
                      <td className="py-3 px-3 nums font-semibold text-primary">
                        {fmtCurrency(p.salePrice)}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs nums ${
                            low
                              ? "bg-warning/15 text-warning font-semibold"
                              : "bg-muted"
                          }`}
                        >
                          {low && <AlertTriangle className="h-3 w-3" />}
                          {fmtNumber(p.stock)} {p.unit ?? ""}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setAdjustOpen(p)}
                            title="تعديل الكمية"
                          >
                            <ArrowDownUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(p)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => setToDelete(p)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل منتج" : "منتج جديد"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <Label>اسم المنتج *</Label>
              <Input
                value={form.name ?? ""}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                maxLength={120}
              />
            </div>
            <div>
              <Label>الكود / الباركود *</Label>
              <Input
                value={form.sku ?? ""}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                className="nums"
                maxLength={60}
              />
            </div>
            <div>
              <Label>الموديل</Label>
              <Input
                value={form.model ?? ""}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                maxLength={80}
              />
            </div>
            <div>
              <Label>الماركة</Label>
              <Input
                value={form.brand ?? ""}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                maxLength={80}
              />
            </div>
            <div>
              <Label>الوحدة</Label>
              <Input
                value={form.unit ?? ""}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                placeholder="قطعة، علبة..."
                maxLength={20}
              />
            </div>
            <div>
              <Label>سعر الكلفة</Label>
              <Input
                type="number"
                value={form.costPrice ?? 0}
                onChange={(e) => setForm({ ...form, costPrice: Number(e.target.value) })}
                className="nums"
              />
            </div>
            <div>
              <Label>سعر البيع *</Label>
              <Input
                type="number"
                value={form.salePrice ?? 0}
                onChange={(e) => setForm({ ...form, salePrice: Number(e.target.value) })}
                className="nums"
              />
            </div>
            <div>
              <Label>الكمية الحالية</Label>
              <Input
                type="number"
                value={form.stock ?? 0}
                onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
                className="nums"
                disabled={!!editing}
              />
              {editing && (
                <p className="text-xs text-muted-foreground mt-1">
                  استخدم زر تعديل الكمية في الجدول لتعديل المخزون مع تسجيل حركة.
                </p>
              )}
            </div>
            <div>
              <Label>حد التنبيه</Label>
              <Input
                type="number"
                value={form.minStock ?? 0}
                onChange={(e) => setForm({ ...form, minStock: Number(e.target.value) })}
                className="nums"
              />
            </div>
            <div className="md:col-span-2">
              <Label>ملاحظات</Label>
              <Textarea
                value={form.notes ?? ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                maxLength={500}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={save} className="gradient-gold text-primary font-semibold">
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust stock */}
      <Dialog open={!!adjustOpen} onOpenChange={(o) => !o && setAdjustOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعديل كمية: {adjustOpen?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              المتاح حالياً: <span className="nums font-semibold">{adjustOpen?.stock}</span>.
              أدخل قيمة موجبة للإضافة أو سالبة للخصم.
            </p>
            <div>
              <Label>الكمية</Label>
              <Input
                type="number"
                value={adjustQty}
                onChange={(e) => setAdjustQty(Number(e.target.value))}
                className="nums text-lg"
              />
            </div>
            <div>
              <Label>سبب التعديل (اختياري)</Label>
              <Input
                value={adjustNote}
                onChange={(e) => setAdjustNote(e.target.value.slice(0, 200))}
                placeholder="استلام بضاعة، تالف..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(null)}>
              إلغاء
            </Button>
            <Button onClick={doAdjust} className="gradient-gold text-primary font-semibold">
              تطبيق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف المنتج</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف "{toDelete?.name}"؟ لا يمكن التراجع.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Inventory;
