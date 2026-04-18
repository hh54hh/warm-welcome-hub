import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Plus, Minus, X, ShoppingCart, Printer, CreditCard, Banknote } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import type { InvoiceItem, PaymentMethod, Product, Invoice } from "@/db/types";
import { createInvoice } from "@/db/services";
import { fmtCurrency } from "@/lib/format";
import { toast } from "sonner";
import InvoicePrint from "@/components/InvoicePrint";

const PaymentLabel: Record<PaymentMethod, string> = {
  cash: "نقداً",
  card: "بطاقة",
  transfer: "تحويل",
  credit: "آجل",
};

const POS = () => {
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<InvoiceItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [paid, setPaid] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [printInvoice, setPrintInvoice] = useState<Invoice | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const products = useLiveQuery(async () => {
    const all = await db.products.toArray();
    return all.sort((a, b) => b.updatedAt - a.updatedAt);
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return products ?? [];
    return (products ?? []).filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.sku.toLowerCase().includes(term) ||
        (p.model?.toLowerCase().includes(term) ?? false) ||
        (p.brand?.toLowerCase().includes(term) ?? false),
    );
  }, [products, query]);

  const subtotal = cart.reduce((s, i) => s + i.total, 0);
  const total = Math.max(0, subtotal - discount);
  const change = Math.max(0, paid - total);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const addProduct = (p: Product) => {
    if (p.stock <= 0) {
      toast.error(`${p.name} غير متوفر في المخزن`);
      return;
    }
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === p.id);
      if (existing) {
        if (existing.quantity + 1 > p.stock) {
          toast.error(`المتاح فقط ${p.stock} من ${p.name}`);
          return prev;
        }
        return prev.map((i) =>
          i.productId === p.id
            ? {
                ...i,
                quantity: i.quantity + 1,
                total: (i.quantity + 1) * i.unitPrice - i.discount,
              }
            : i,
        );
      }
      return [
        ...prev,
        {
          productId: p.id,
          name: p.name,
          sku: p.sku,
          unitPrice: p.salePrice,
          quantity: 1,
          discount: 0,
          total: p.salePrice,
        },
      ];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.productId !== productId) return i;
          const newQ = i.quantity + delta;
          if (newQ <= 0) return null as any;
          const product = products?.find((p) => p.id === productId);
          if (product && newQ > product.stock) {
            toast.error(`المتاح فقط ${product.stock} من ${i.name}`);
            return i;
          }
          return { ...i, quantity: newQ, total: newQ * i.unitPrice - i.discount };
        })
        .filter(Boolean) as InvoiceItem[],
    );
  };

  const removeItem = (productId: string) =>
    setCart((prev) => prev.filter((i) => i.productId !== productId));

  const updateUnitPrice = (productId: string, price: number) => {
    setCart((prev) =>
      prev.map((i) =>
        i.productId === productId
          ? { ...i, unitPrice: price, total: i.quantity * price - i.discount }
          : i,
      ),
    );
  };

  const resetForm = () => {
    setCart([]);
    setDiscount(0);
    setPaid(0);
    setMethod("cash");
    setCustomerName("");
    setCustomerPhone("");
    setQuery("");
  };

  const handleConfirm = async () => {
    try {
      const finalPaid = method === "credit" ? 0 : paid > 0 ? paid : total;
      const inv = await createInvoice({
        items: cart,
        discount,
        paid: finalPaid,
        paymentMethod: method,
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
      });
      toast.success(`تم حفظ الفاتورة ${inv.number}`);
      setConfirmOpen(false);
      resetForm();
      setPrintInvoice(inv);
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر حفظ الفاتورة");
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 h-[calc(100vh-7rem)]">
      {/* قائمة المنتجات */}
      <div className="lg:col-span-3 surface-card p-4 flex flex-col min-h-0">
        <div className="relative mb-3">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث بالاسم، الباركود، الموديل أو الماركة..."
            className="pr-10 h-11"
          />
        </div>

        <div className="flex-1 overflow-y-auto -mx-2 px-2">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-12">
              <ShoppingCart className="h-12 w-12 mb-3 opacity-30" />
              <p>لا توجد منتجات. أضف منتجات من قسم المخزن.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addProduct(p)}
                  className="text-right surface-card p-3 hover:border-primary hover:shadow-elegant transition-all hover:-translate-y-0.5 group"
                >
                  <div className="text-sm font-semibold line-clamp-2 min-h-[2.5rem]">
                    {p.name}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 nums">{p.sku}</div>
                  {p.model && (
                    <div className="text-xs text-muted-foreground">موديل: {p.model}</div>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-base font-bold text-primary nums">
                      {fmtCurrency(p.salePrice)}
                    </span>
                    <span
                      className={`text-xs nums px-2 py-0.5 rounded ${
                        p.stock <= p.minStock
                          ? "bg-warning/15 text-warning"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      المتاح: {p.stock}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* السلة */}
      <div className="lg:col-span-2 surface-card flex flex-col min-h-0">
        <div className="p-4 border-b flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">سلة البيع</h2>
          <span className="text-xs text-muted-foreground mr-auto nums">
            {cart.length} صنف
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="text-center text-muted-foreground py-12 text-sm">
              السلة فارغة. اختر منتجاً للبدء.
            </div>
          ) : (
            cart.map((i) => (
              <div key={i.productId} className="rounded-lg border p-3 bg-card">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{i.name}</div>
                    <div className="text-xs text-muted-foreground nums">{i.sku}</div>
                  </div>
                  <button
                    onClick={() => removeItem(i.productId)}
                    className="text-muted-foreground hover:text-destructive p-1"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center gap-1 border rounded-md">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => updateQty(i.productId, -1)}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center text-sm font-semibold nums">
                      {i.quantity}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => updateQty(i.productId, 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <Input
                    type="number"
                    value={i.unitPrice}
                    onChange={(e) =>
                      updateUnitPrice(i.productId, Number(e.target.value) || 0)
                    }
                    className="h-8 text-sm nums flex-1"
                  />
                  <div className="text-sm font-bold text-primary nums whitespace-nowrap">
                    {fmtCurrency(i.total)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t p-4 space-y-3 bg-muted/30">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">الخصم</Label>
              <Input
                type="number"
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                className="h-9 nums"
              />
            </div>
            <div>
              <Label className="text-xs">طريقة الدفع</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">
                    <span className="flex items-center gap-2">
                      <Banknote className="h-4 w-4" /> نقداً
                    </span>
                  </SelectItem>
                  <SelectItem value="card">
                    <span className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4" /> بطاقة
                    </span>
                  </SelectItem>
                  <SelectItem value="transfer">تحويل</SelectItem>
                  <SelectItem value="credit">آجل</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">المجموع الفرعي</span>
              <span className="nums">{fmtCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">الخصم</span>
              <span className="nums text-destructive">- {fmtCurrency(discount)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold pt-1 border-t">
              <span>الإجمالي</span>
              <span className="nums text-primary">{fmtCurrency(total)}</span>
            </div>
          </div>

          <Button
            disabled={cart.length === 0}
            onClick={() => {
              setPaid(total);
              setConfirmOpen(true);
            }}
            className="w-full h-12 text-base gradient-gold text-primary font-bold hover:opacity-90"
          >
            إتمام البيع
          </Button>
        </div>
      </div>

      {/* تأكيد الدفع */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تأكيد الفاتورة</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>اسم الزبون (اختياري)</Label>
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value.slice(0, 80))}
                />
              </div>
              <div>
                <Label>الهاتف (اختياري)</Label>
                <Input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value.slice(0, 20))}
                  className="nums"
                />
              </div>
            </div>
            {method !== "credit" && (
              <div>
                <Label>المبلغ المدفوع</Label>
                <Input
                  type="number"
                  value={paid}
                  onChange={(e) => setPaid(Number(e.target.value) || 0)}
                  className="text-lg nums h-11"
                />
              </div>
            )}
            <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span>الإجمالي</span>
                <span className="font-bold nums">{fmtCurrency(total)}</span>
              </div>
              <div className="flex justify-between">
                <span>طريقة الدفع</span>
                <span>{PaymentLabel[method]}</span>
              </div>
              {method !== "credit" && (
                <div className="flex justify-between">
                  <span>الباقي</span>
                  <span className="font-bold nums text-success">{fmtCurrency(change)}</span>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              إلغاء
            </Button>
            <Button
              className="gradient-gold text-primary font-semibold"
              onClick={handleConfirm}
            >
              <Printer className="ml-2 h-4 w-4" />
              حفظ وطباعة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {printInvoice && (
        <InvoicePrint invoice={printInvoice} onClose={() => setPrintInvoice(null)} />
      )}
    </div>
  );
};

export default POS;
