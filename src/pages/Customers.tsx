import { Fragment, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, now } from "@/db/database";
import { deleteCustomer as deleteCustomerService } from "@/db/services";
import { fmtCurrency, fmtDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import CustomerStatementPrint from "@/components/CustomerStatementPrint";
import { CheckCircle, Loader } from "lucide-react";

interface CustomerSummary {
  id: string; // derived id (name|phone or customer id)
  recordId?: string;
  name?: string;
  phone?: string;
  total: number;
  paid: number;
  balance: number;
  invoices: any[];
  credits?: any[];
  syncStatus?: string;
}

const Customers = () => {
  const [active, setActive] = useState<CustomerSummary | null>(null);
  const [printStatement, setPrintStatement] = useState<CustomerSummary | null>(null);

  const customers = useLiveQuery(
    () => db.customers.orderBy("name").toArray().then((list) => list.filter((c) => !c.deletedAt && c.syncStatus !== "deleted")),
    []
  );
  const invoices = useLiveQuery(() => db.invoices.toArray(), []);
  const customerCredits = useLiveQuery(() => db.customer_credits.toArray(), []);

  const deleteCustomer = async (c: CustomerSummary) => {
    const ok = window.confirm("هل أنت متأكد أنك تريد حذف هذا الزبون؟ سيتم حذفه نهائياً من جميع الأماكن.");
    if (!ok) return;

    // أغلق الكشف فوراً وأظهر إشعاراً مباشراً
    setActive(null);

    try {
      if (c.recordId) {
        await deleteCustomerService(c.recordId);
        toast.success("تم حذف الزبون بنجاح");
      } else {
        await db.transaction('rw', db.invoices, async () => {
          for (const inv of c.invoices) {
            await db.invoices.update(inv.id, { customerName: undefined, customerPhone: undefined, updatedAt: now() });
          }
        });
        toast.success("تم حذف بيانات الزبون من الفواتير");
      }
    } catch (e: any) {
      console.error(e);
      toast.error("خطأ أثناء حذف الزبون");
    }
  };

  const groups = useMemo(() => {
    const invoiceList = invoices ?? [];
    const customerList = customers ?? [];
    const creditList = customerCredits ?? [];

    if (customerList.length > 0) {
      const result = customerList
        .map((customer) => {
          const customerInvoices = invoiceList.filter((inv) => inv.customerId === customer.id);
          const invoicesTotal = customerInvoices.reduce((sum, inv) => sum + inv.total, 0);
          const invoicesPaid = customerInvoices.reduce((sum, inv) => sum + inv.paid, 0);
          const customerCreditRecords = creditList.filter((credit) => credit.customer_id?.toString() === customer.id);
          const remainingCredit = customerCreditRecords.reduce((sum, credit) => sum + (credit.remaining_amount || 0), 0);
          const balance = customerCreditRecords.length > 0 ? remainingCredit : invoicesTotal - invoicesPaid;

          return {
            id: customer.id,
            recordId: customer.id,
            name: customer.name,
            phone: customer.phone,
            total: invoicesTotal,
            paid: invoicesPaid,
            balance,
            invoices: customerInvoices,
            credits: customerCreditRecords,
            syncStatus: customer.syncStatus,
          };
        })
        .sort((a, b) => b.balance - a.balance);

      // طباعة معلومات المزامنة للزبائن
      const synced = result.filter(c => c.syncStatus === "synced").length;
      const pending = result.filter(c => c.syncStatus !== "synced").length;
      console.log(`👥 الزبائن المسجلين: إجمالي ${result.length}, متزامن ${synced}, معلق ${pending}`);
      if (pending > 0) {
        console.log("👥 الزبائن غير المتزامنين:", result.filter(c => c.syncStatus !== "synced").map(c => `${c.name} (${c.syncStatus})`));
      }

      return result;
    }

    const map = new Map<string, CustomerSummary>();
    for (const inv of invoiceList) {
      const name = inv.customerName?.trim() || "";
      const phone = inv.customerPhone?.trim() || "";
      if (!name && !phone) continue;
      const id = `${name}||${phone}`;
      const cur = map.get(id) ?? {
        id,
        name: name || undefined,
        phone: phone || undefined,
        total: 0,
        paid: 0,
        balance: 0,
        invoices: [],
        syncStatus: "local",
      };
      cur.total += inv.total;
      cur.paid += inv.paid;
      cur.balance = cur.total - cur.paid;
      cur.invoices.push(inv);
      map.set(id, cur);
    }
    const result = Array.from(map.values()).sort((a, b) => b.balance - a.balance);

    // طباعة معلومات الزبائن من الفواتير
    console.log(`🧾 الزبائن من الفواتير: ${result.length}`);
    if (result.length > 0) {
      console.log("🧾 الزبائن من الفواتير:", result.map(c => `${c.name} (${c.syncStatus})`));
    }

    return result;
  }, [customers, invoices, customerCredits]);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">الزبائن</h2>
        <div className="text-sm text-muted-foreground">قائمة الزبائن وكشوف الحساب</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {(groups ?? []).map((c) => (
          <div key={c.id} className="surface-card p-3 rounded-lg flex items-center justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="font-semibold truncate">{c.name ?? "زبون"}</div>
                {c.syncStatus === "synced" ? (
                  <span title="متزامن" className="inline-flex"><CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" /></span>
                ) : (
                  <span title="قيد المزامنة" className="inline-flex"><Loader className="h-4 w-4 text-blue-500 animate-spin flex-shrink-0" /></span>
                )}
              </div>
              {c.phone && <div className="text-xs text-muted-foreground nums">{c.phone}</div>}
            </div>
            <div className="text-right flex flex-col items-end gap-2">
              <div className={`font-bold nums ${c.balance > 0 ? "text-destructive" : "text-success"}`}>
                {fmtCurrency(c.balance)}
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => setActive(c)}>
                  عرض الكشف
                </Button>
                <Button size="sm" variant="outline" className="text-destructive" onClick={() => deleteCustomer(c)}>
                  حذف
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!active} onOpenChange={() => setActive(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>كشف حساب الزبون</DialogTitle>
          </DialogHeader>
          {active && (
            <div className="p-2">
              <div className="mb-2">
                <div className="font-semibold">{active.name ?? "زبون"}</div>
                {active.phone && <div className="text-xs text-muted-foreground nums">{active.phone}</div>}
                <div className="mt-2">الرصيد الحالي: <span className={`font-bold nums ${active.balance > 0 ? "text-destructive" : "text-success"}`}>{fmtCurrency(active.balance)}</span></div>
              </div>

              <div className="overflow-y-auto max-h-[50vh]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground">
                      <th className="text-right">التاريخ</th>
                      <th className="text-center">رقم</th>
                      <th className="text-center">الإجمالي</th>
                      <th className="text-center">المدفوع</th>
                      <th className="text-left">الباقي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {active.invoices.map((inv) => (
                      <Fragment key={inv.id}>
                        <tr className="border-t">
                          <td className="text-right text-xs nums">{fmtDateTime(inv.createdAt)}</td>
                          <td className="text-center nums">{inv.number}</td>
                          <td className="text-center nums">{fmtCurrency(inv.total)}</td>
                          <td className="text-center nums">{fmtCurrency(inv.paid)}</td>
                          <td className="text-left nums">{fmtCurrency(inv.total - inv.paid)}</td>
                        </tr>
                        <tr>
                          <td colSpan={5} className="text-xs text-muted-foreground px-2 py-1">
                            <div className="grid gap-1">
                              {inv.items.map((it: any) => (
                                <div key={it.productId} className="flex justify-between">
                                  <div className="truncate">{it.name} x{it.quantity} ({it.unitPrice?.toLocaleString?.() ?? it.unitPrice})</div>
                                  <div className="nums">{fmtCurrency(it.total)}</div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <DialogFooter className="justify-between">
            <Button variant="outline" onClick={() => setActive(null)}>إغلاق</Button>
            <Button
              className="gradient-gold text-primary font-semibold"
              onClick={() => active && setPrintStatement(active)}
            >
              طباعة الكشف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {printStatement && (
        <CustomerStatementPrint
          customerName={printStatement.name}
          customerPhone={printStatement.phone}
          invoices={printStatement.invoices}
          onClose={() => setPrintStatement(null)}
        />
      )}
    </div>
  );
};

export default Customers;
