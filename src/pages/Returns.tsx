import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Undo2 as UndoIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import type { Invoice, ReturnItem } from "@/db/types";
import { createReturn, returnsForInvoice } from "@/db/services";
import { fmtCurrency, fmtDateTime } from "@/lib/format";
import { toast } from "sonner";

const Returns = () => {
  const { invoiceId } = useParams();
  const navigate = useNavigate();

  // قائمة بكل المرتجعات
  const allReturns = useLiveQuery(() =>
    db.returns.orderBy("createdAt").reverse().toArray(),
  );

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [alreadyReturned, setAlreadyReturned] = useState<Map<string, number>>(new Map());
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!invoiceId) return;
    db.invoices.get(invoiceId).then((inv) => {
      if (!inv) {
        toast.error("فاتورة غير موجودة");
        navigate("/returns");
        return;
      }
      setInvoice(inv);
      setQtyMap({});
      returnsForInvoice(invoiceId).then((rets) => {
        const map = new Map<string, number>();
        for (const r of rets) {
          for (const it of r.items) {
            map.set(it.productId, (map.get(it.productId) ?? 0) + it.quantity);
          }
        }
        setAlreadyReturned(map);
      });
    });
  }, [invoiceId, navigate]);

  const items: ReturnItem[] = useMemo(() => {
    if (!invoice) return [];
    return invoice.items
      .filter((i) => (qtyMap[i.productId] ?? 0) > 0)
      .map((i) => {
        const q = qtyMap[i.productId];
        return {
          productId: i.productId,
          name: i.name,
          unitPrice: i.unitPrice,
          quantity: q,
          total: q * i.unitPrice,
        };
      });
  }, [invoice, qtyMap]);

  const total = items.reduce((s, i) => s + i.total, 0);

  const submit = async () => {
    if (!invoice || items.length === 0) {
      toast.error("اختر منتجاً للإرجاع");
      return;
    }
    try {
      const rec = await createReturn({
        invoiceId: invoice.id,
        items,
        reason: reason || undefined,
      });
      toast.success(`تم إنشاء المرتجع ${rec.number}`);
      navigate("/returns");
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر إنشاء المرتجع");
    }
  };

  // ============ صفحة قائمة المرتجعات ============
  if (!invoiceId) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">المرتجعات</h1>
          <p className="text-muted-foreground text-sm mt-1">سجل كامل للإرجاعات</p>
        </div>

        <div className="surface-card p-4">
          {(allReturns?.length ?? 0) === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <UndoIcon className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>لا توجد مرتجعات</p>
              <p className="text-xs mt-2">
                يمكنك إنشاء مرتجع من{" "}
                <Link to="/invoices" className="text-primary underline">
                  صفحة الفواتير
                </Link>
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-right">
                  <tr>
                    <th className="py-3 px-3 font-semibold">رقم المرتجع</th>
                    <th className="py-3 px-3 font-semibold">الفاتورة</th>
                    <th className="py-3 px-3 font-semibold">التاريخ</th>
                    <th className="py-3 px-3 font-semibold">عدد الأصناف</th>
                    <th className="py-3 px-3 font-semibold">الإجمالي</th>
                    <th className="py-3 px-3 font-semibold">السبب</th>
                  </tr>
                </thead>
                <tbody>
                  {allReturns!.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="py-3 px-3 nums font-semibold">{r.number}</td>
                      <td className="py-3 px-3 nums">{r.invoiceNumber}</td>
                      <td className="py-3 px-3 nums text-muted-foreground">
                        {fmtDateTime(r.createdAt)}
                      </td>
                      <td className="py-3 px-3 nums">{r.items.length}</td>
                      <td className="py-3 px-3 nums font-bold text-destructive">
                        {fmtCurrency(r.total)}
                      </td>
                      <td className="py-3 px-3 text-muted-foreground">{r.reason ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============ نموذج إنشاء مرتجع ============
  if (!invoice) return <p className="text-center py-12">جارٍ التحميل...</p>;

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/invoices">
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">إنشاء مرتجع</h1>
          <p className="text-sm text-muted-foreground nums">
            من فاتورة: {invoice.number} — {fmtDateTime(invoice.createdAt)}
          </p>
        </div>
      </div>

      <div className="surface-card p-4">
        <h2 className="font-semibold mb-3">حدد الكميات المراد إرجاعها</h2>
        <div className="overflow-x-auto -mx-4">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-right">
              <tr>
                <th className="py-3 px-3 font-semibold">الصنف</th>
                <th className="py-3 px-3 font-semibold">السعر</th>
                <th className="py-3 px-3 font-semibold">الكمية بالفاتورة</th>
                <th className="py-3 px-3 font-semibold">سبق إرجاعه</th>
                <th className="py-3 px-3 font-semibold">كمية الإرجاع</th>
                <th className="py-3 px-3 text-left font-semibold">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((it) => {
                const prev = alreadyReturned.get(it.productId) ?? 0;
                const max = it.quantity - prev;
                const q = qtyMap[it.productId] ?? 0;
                return (
                  <tr key={it.productId} className="border-t">
                    <td className="py-3 px-3">{it.name}</td>
                    <td className="py-3 px-3 nums">{fmtCurrency(it.unitPrice)}</td>
                    <td className="py-3 px-3 nums">{it.quantity}</td>
                    <td className="py-3 px-3 nums text-muted-foreground">{prev}</td>
                    <td className="py-3 px-3">
                      <Input
                        type="number"
                        min={0}
                        max={max}
                        value={q}
                        onChange={(e) => {
                          const v = Math.max(0, Math.min(max, Number(e.target.value) || 0));
                          setQtyMap({ ...qtyMap, [it.productId]: v });
                        }}
                        className="h-8 w-20 nums"
                        disabled={max === 0}
                      />
                    </td>
                    <td className="py-3 px-3 nums text-left font-semibold">
                      {fmtCurrency(q * it.unitPrice)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mt-4">
          <div>
            <Label>سبب الإرجاع (اختياري)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 300))}
              rows={3}
            />
          </div>
          <div className="flex flex-col justify-end gap-3">
            <div className="rounded-lg border p-4 bg-muted/30 space-y-1 text-sm">
              <div className="flex justify-between">
                <span>عدد الأصناف</span>
                <span className="nums font-semibold">{items.length}</span>
              </div>
              <div className="flex justify-between text-base font-bold border-t pt-2">
                <span>إجمالي الإرجاع</span>
                <span className="nums text-destructive">{fmtCurrency(total)}</span>
              </div>
            </div>
            <Button
              onClick={submit}
              disabled={items.length === 0}
              className="gradient-gold text-primary font-bold h-11"
            >
              تأكيد الإرجاع
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Returns;
