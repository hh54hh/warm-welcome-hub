import { useEffect, useState } from "react";
import { Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Invoice } from "@/db/types";
import { fmtCurrency, fmtDateTime } from "@/lib/format";
import { ensureSettings } from "@/db/database";

interface Props {
  customerName?: string;
  customerPhone?: string;
  invoices: Invoice[];
  onClose: () => void;
}

const CustomerStatementPrint = ({ customerName, customerPhone, invoices, onClose }: Props) => {
  const [shopName, setShopName] = useState("مركز البدر");
  const [footer, setFooter] = useState("شكراً لتعاملكم معنا");

  useEffect(() => {
    ensureSettings().then((s) => {
      setShopName(s.shopName);
      setFooter(s.footerNote ?? "");
    });
  }, []);

  const total = invoices.reduce((sum, inv) => sum + inv.total, 0);
  const paid = invoices.reduce((sum, inv) => sum + inv.paid, 0);
  const balance = total - paid;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto no-print">
      <div className="bg-card rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-3 border-b flex items-center justify-between">
          <h3 className="font-semibold">كشف حساب الزبون</h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="print-area p-5 text-sm">
          <div className="text-center mb-4">
            <h1 className="text-xl font-bold">{shopName}</h1>
            <p className="text-xs text-muted-foreground mt-1">كشف حساب زبون</p>
          </div>

          <div className="flex flex-col gap-1 text-xs mb-4 nums">
            <div className="flex justify-between">
              <span>الزبون</span>
              <span>{customerName ?? "زبون"}</span>
            </div>
            {customerPhone && (
              <div className="flex justify-between">
                <span>الهاتف</span>
                <span>{customerPhone}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>تاريخ الطباعة</span>
              <span>{fmtDateTime(Date.now())}</span>
            </div>
          </div>

          <div className="border-t border-b py-3 mb-4 text-xs">
            <div className="flex justify-between">
              <span>إجمالي المبيعات</span>
              <span className="font-bold nums">{fmtCurrency(total)}</span>
            </div>
            <div className="flex justify-between">
              <span>المبلغ المدفوع</span>
              <span className="font-bold nums">{fmtCurrency(paid)}</span>
            </div>
            <div className="flex justify-between">
              <span>الرصيد</span>
              <span className={`font-bold nums ${balance > 0 ? "text-destructive" : "text-success"}`}>{fmtCurrency(balance)}</span>
            </div>
          </div>

          {invoices.map((inv) => (
            <div key={inv.id} className="mb-4">
              <div className="text-xs font-semibold mb-2 flex justify-between items-center">
                <span>فاتورة {inv.number}</span>
                <span>{fmtDateTime(inv.createdAt)}</span>
              </div>
              <table className="w-full text-xs border border-muted border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-right py-2 px-1">الصنف</th>
                    <th className="text-center py-2 px-1">كمية</th>
                    <th className="text-center py-2 px-1">السعر</th>
                    <th className="text-left py-2 px-1">إجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {inv.items.map((item) => (
                    <tr key={item.productId} className="border-b">
                      <td className="py-2 px-1">{item.name}</td>
                      <td className="text-center py-2 px-1 nums">{item.quantity}</td>
                      <td className="text-center py-2 px-1 nums">{fmtCurrency(item.unitPrice)}</td>
                      <td className="text-left py-2 px-1 nums">{fmtCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-2 text-xs">
                <div className="flex justify-between">
                  <span>الإجمالي</span>
                  <span className="nums">{fmtCurrency(inv.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span>المدفوع</span>
                  <span className="nums">{fmtCurrency(inv.paid)}</span>
                </div>
                <div className="flex justify-between">
                  <span>الباقي</span>
                  <span className={`nums ${inv.total - inv.paid > 0 ? "text-destructive" : "text-success"}`}>{fmtCurrency(inv.total - inv.paid)}</span>
                </div>
              </div>
            </div>
          ))}

          {footer && <p className="text-center text-xs text-muted-foreground mt-5 border-t pt-3">{footer}</p>}
        </div>

        <div className="p-3 border-t flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>إغلاق</Button>
          <Button className="gradient-gold text-primary font-semibold" onClick={() => window.print()}>
            <Printer className="ml-2 h-4 w-4" /> طباعة
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CustomerStatementPrint;
