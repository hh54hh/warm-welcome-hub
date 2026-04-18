import { useEffect, useState } from "react";
import { Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Invoice } from "@/db/types";
import { fmtCurrency, fmtDateTime } from "@/lib/format";
import { ensureSettings } from "@/db/database";

interface Props {
  invoice: Invoice;
  onClose: () => void;
}

const InvoicePrint = ({ invoice, onClose }: Props) => {
  const [shopName, setShopName] = useState("مركز البدر");
  const [footer, setFooter] = useState("شكراً لتعاملكم مع مركز البدر");

  useEffect(() => {
    ensureSettings().then((s) => {
      setShopName(s.shopName);
      setFooter(s.footerNote ?? "");
    });
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto no-print">
      <div className="bg-card rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-3 border-b flex items-center justify-between">
          <h3 className="font-semibold">معاينة الفاتورة</h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="print-area p-5 text-sm">
          <div className="text-center mb-4">
            <h1 className="text-xl font-bold">{shopName}</h1>
            <p className="text-xs text-muted-foreground mt-1">فاتورة بيع</p>
          </div>
          <div className="flex justify-between text-xs mb-3 nums">
            <span>رقم: {invoice.number}</span>
            <span>{fmtDateTime(invoice.createdAt)}</span>
          </div>
          {(invoice.customerName || invoice.customerPhone) && (
            <div className="text-xs mb-3 border-y py-2">
              {invoice.customerName && <div>الزبون: {invoice.customerName}</div>}
              {invoice.customerPhone && (
                <div className="nums">الهاتف: {invoice.customerPhone}</div>
              )}
            </div>
          )}

          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                <th className="text-right py-1">الصنف</th>
                <th className="text-center py-1">كمية</th>
                <th className="text-center py-1">سعر</th>
                <th className="text-left py-1">إجمالي</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((i) => (
                <tr key={i.productId} className="border-b border-dashed">
                  <td className="py-1">{i.name}</td>
                  <td className="text-center nums py-1">{i.quantity}</td>
                  <td className="text-center nums py-1">{i.unitPrice.toLocaleString()}</td>
                  <td className="text-left nums py-1">{i.total.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-3 space-y-1 text-xs">
            <div className="flex justify-between">
              <span>المجموع</span>
              <span className="nums">{fmtCurrency(invoice.subtotal)}</span>
            </div>
            {invoice.discount > 0 && (
              <div className="flex justify-between">
                <span>الخصم</span>
                <span className="nums">- {fmtCurrency(invoice.discount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base border-t pt-1">
              <span>الإجمالي</span>
              <span className="nums">{fmtCurrency(invoice.total)}</span>
            </div>
            <div className="flex justify-between">
              <span>المدفوع</span>
              <span className="nums">{fmtCurrency(invoice.paid)}</span>
            </div>
            {/* حساب رصيد الزبون المتبقي (total - paid) */}
            <div className="flex justify-between">
              <span>الباقي</span>
              <span className={`nums ${invoice.total - invoice.paid > 0 ? "text-destructive" : "text-success"}`}>
                {fmtCurrency(invoice.total - invoice.paid)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>طريقة الدفع</span>
              <span className="nums">{invoice.paymentMethod === "credit" ? "آجل" : invoice.paymentMethod === "cash" ? "نقداً" : invoice.paymentMethod === "card" ? "بطاقة" : "تحويل"}</span>
            </div>
          </div>

          {footer && (
            <p className="text-center text-xs text-muted-foreground mt-5 border-t pt-3">
              {footer}
            </p>
          )}
        </div>

        <div className="p-3 border-t flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>
            إغلاق
          </Button>
          <Button className="gradient-gold text-primary font-semibold" onClick={() => window.print()}>
            <Printer className="ml-2 h-4 w-4" />
            طباعة
          </Button>
        </div>
      </div>
    </div>
  );
};

export default InvoicePrint;
