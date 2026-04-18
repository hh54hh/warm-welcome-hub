import { useMemo, useState } from "react";
import { Search, Eye, Printer, Undo2 as UndoIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import type { Invoice } from "@/db/types";
import { fmtCurrency, fmtDateTime } from "@/lib/format";
import InvoicePrint from "@/components/InvoicePrint";

const statusLabel: Record<Invoice["status"], { label: string; className: string }> = {
  completed: { label: "مكتملة", className: "bg-success/15 text-success" },
  partially_returned: { label: "إرجاع جزئي", className: "bg-warning/15 text-warning" },
  returned: { label: "مرتجعة", className: "bg-destructive/15 text-destructive" },
};

const Invoices = () => {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [printing, setPrinting] = useState<Invoice | null>(null);

  const invoices = useLiveQuery(() =>
    db.invoices.orderBy("createdAt").reverse().toArray(),
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return invoices ?? [];
    return (invoices ?? []).filter(
      (i) =>
        i.number.toLowerCase().includes(term) ||
        (i.customerName?.toLowerCase().includes(term) ?? false) ||
        (i.customerPhone?.includes(term) ?? false),
    );
  }, [invoices, query]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">الفواتير</h1>
        <p className="text-muted-foreground text-sm mt-1">
          سجل كامل لجميع عمليات البيع
        </p>
      </div>

      <div className="surface-card p-4">
        <div className="relative mb-4">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="بحث برقم الفاتورة أو اسم/هاتف الزبون..."
            className="pr-10"
          />
        </div>

        {filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">لا توجد فواتير</p>
        ) : (
          <div className="overflow-x-auto -mx-4">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-right">
                <tr>
                  <th className="py-3 px-3 font-semibold">الرقم</th>
                  <th className="py-3 px-3 font-semibold">التاريخ</th>
                  <th className="py-3 px-3 font-semibold">الزبون</th>
                  <th className="py-3 px-3 font-semibold">الإجمالي</th>
                  <th className="py-3 px-3 font-semibold">الحالة</th>
                  <th className="py-3 px-3 text-left font-semibold">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((i) => (
                  <tr
                    key={i.id}
                    className="border-t hover:bg-muted/30 transition-colors"
                  >
                    <td className="py-3 px-3 nums font-semibold">{i.number}</td>
                    <td className="py-3 px-3 nums text-muted-foreground">
                      {fmtDateTime(i.createdAt)}
                    </td>
                    <td className="py-3 px-3">{i.customerName ?? "—"}</td>
                    <td className="py-3 px-3 nums font-bold text-primary">
                      {fmtCurrency(i.total)}
                    </td>
                    <td className="py-3 px-3">
                      {(() => {
                        const status = statusLabel[i.status] ?? {
                          label: "غير معروف",
                          className: "bg-muted/15 text-muted-foreground",
                        };
                        return (
                          <Badge className={status.className}>
                            {status.label}
                          </Badge>
                        );
                      })()}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setSelected(i)}
                          title="عرض"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setPrinting(i)}
                          title="طباعة"
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                        {i.status !== "returned" && (
                          <Button
                            asChild
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            title="إرجاع"
                          >
                            <Link to={`/returns/new/${i.id}`}>
                              <UndoIcon className="h-4 w-4" />
                            </Link>
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* تفاصيل */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>فاتورة {selected?.number}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">التاريخ: </span>
                  <span className="nums">{fmtDateTime(selected.createdAt)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">الحالة: </span>
                  {(() => {
                    const status = statusLabel[selected.status] ?? {
                      label: "غير معروف",
                      className: "bg-muted/15 text-muted-foreground",
                    };
                    return (
                      <Badge className={status.className}>
                        {status.label}
                      </Badge>
                    );
                  })()}
                </div>
                {selected.customerName && (
                  <div>
                    <span className="text-muted-foreground">الزبون: </span>
                    {selected.customerName}
                  </div>
                )}
                {selected.customerPhone && (
                  <div>
                    <span className="text-muted-foreground">الهاتف: </span>
                    <span className="nums">{selected.customerPhone}</span>
                  </div>
                )}
              </div>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr className="text-right">
                      <th className="p-2">الصنف</th>
                      <th className="p-2">السعر</th>
                      <th className="p-2">الكمية</th>
                      <th className="p-2 text-left">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.items.map((it) => (
                      <tr key={it.productId} className="border-t">
                        <td className="p-2">{it.name}</td>
                        <td className="p-2 nums">{fmtCurrency(it.unitPrice)}</td>
                        <td className="p-2 nums">{it.quantity}</td>
                        <td className="p-2 nums text-left">{fmtCurrency(it.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between text-base font-bold pt-2 border-t">
                <span>الإجمالي</span>
                <span className="nums text-primary">{fmtCurrency(selected.total)}</span>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={() => setPrinting(selected)}>
                  <Printer className="ml-2 h-4 w-4" /> طباعة
                </Button>
                {selected.status !== "returned" && (
                  <Button asChild className="gradient-gold text-primary font-semibold">
                    <Link to={`/returns/new/${selected.id}`}>
                      <UndoIcon className="ml-2 h-4 w-4" /> إنشاء مرتجع
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {printing && (
        <InvoicePrint invoice={printing} onClose={() => setPrinting(null)} />
      )}
    </div>
  );
};

export default Invoices;
