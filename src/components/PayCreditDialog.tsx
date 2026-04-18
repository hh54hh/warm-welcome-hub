import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { fmtCurrency } from "@/lib/format";
import { payCustomerCredit } from "@/db/services";
import { toast } from "sonner";
import type { PaymentMethod } from "@/db/types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customerId?: string;
  customerName?: string;
  balance: number;
  onPaid?: () => void;
}

const PayCreditDialog = ({ open, onOpenChange, customerId, customerName, balance, onPaid }: Props) => {
  const [amount, setAmount] = useState<string>("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount(String(Math.max(0, Math.round(balance))));
      setMethod("cash");
      setNote("");
    }
  }, [open, balance]);

  const numAmount = Math.max(0, Math.round(Number(amount) || 0));
  const isOver = numAmount > balance;
  const remainingAfter = Math.max(0, balance - numAmount);

  const submit = async () => {
    if (!customerId) {
      toast.error("لا يمكن تسديد دين زبون غير مسجّل");
      return;
    }
    if (numAmount <= 0) {
      toast.error("أدخل مبلغاً صحيحاً");
      return;
    }
    setLoading(true);
    try {
      const res = await payCustomerCredit({
        customerId,
        amount: numAmount,
        method,
        note: note || undefined,
      });
      if (res.applied <= 0) {
        toast.error("لا توجد ديون مفتوحة لهذا الزبون");
      } else {
        toast.success(
          `تم تسديد ${fmtCurrency(res.applied)}${
            res.closedCount > 0 ? ` — أُغلق ${res.closedCount} دين` : ""
          }`,
        );
        onPaid?.();
        onOpenChange(false);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "تعذّر التسديد");
    } finally {
      setLoading(false);
    }
  };

  const setQuick = (pct: number) => {
    setAmount(String(Math.max(0, Math.round(balance * pct))));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تسديد دين {customerName ?? "الزبون"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border p-3 bg-muted/30 flex justify-between text-sm">
            <span>الدين الحالي</span>
            <span className="font-bold nums text-destructive">{fmtCurrency(balance)}</span>
          </div>

          <div>
            <Label>المبلغ المدفوع</Label>
            <Input
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="nums"
            />
            <div className="flex gap-2 mt-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setQuick(0.25)}>25%</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setQuick(0.5)}>50%</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setQuick(1)}>كل المبلغ</Button>
            </div>
            {isOver && (
              <p className="text-xs text-destructive mt-1">
                المبلغ أكبر من الدين — سيتم تسديد {fmtCurrency(balance)} فقط
              </p>
            )}
          </div>

          <div>
            <Label>طريقة الدفع</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">نقدي</SelectItem>
                <SelectItem value="card">بطاقة</SelectItem>
                <SelectItem value="transfer">تحويل</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>ملاحظة (اختياري)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 200))} rows={2} />
          </div>

          <div className="rounded-lg border p-3 bg-muted/30 space-y-1 text-sm">
            <div className="flex justify-between">
              <span>المسدد الآن</span>
              <span className="nums font-semibold">{fmtCurrency(Math.min(numAmount, balance))}</span>
            </div>
            <div className="flex justify-between border-t pt-1">
              <span>الدين المتبقي بعد التسديد</span>
              <span className={`nums font-bold ${remainingAfter > 0 ? "text-destructive" : "text-success"}`}>
                {fmtCurrency(remainingAfter)}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            إلغاء
          </Button>
          <Button
            className="gradient-gold text-primary font-bold"
            onClick={submit}
            disabled={loading || numAmount <= 0 || !customerId}
          >
            {loading ? "جارٍ التسديد..." : "تأكيد التسديد"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PayCreditDialog;
