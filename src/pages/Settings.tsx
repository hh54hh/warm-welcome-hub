import { useEffect, useState } from "react";
import { Save, Trash2, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { db, ensureSettings, now } from "@/db/database";
import { toast } from "sonner";

const Settings = () => {
  const [shopName, setShopName] = useState("");
  const [currency, setCurrency] = useState("");
  const [pin, setPin] = useState("");
  const [footer, setFooter] = useState("");

  useEffect(() => {
    ensureSettings().then((s) => {
      setShopName(s.shopName);
      setCurrency(s.currency);
      setPin(s.pin);
      setFooter(s.footerNote ?? "");
    });
  }, []);

  const save = async () => {
    if (!shopName.trim()) return toast.error("اسم المحل مطلوب");
    if (!/^\d{3,8}$/.test(pin)) return toast.error("الرمز السري يجب أن يكون 3-8 أرقام");
    await db.settings.update("settings", {
      shopName: shopName.trim().slice(0, 80),
      currency: currency.trim().slice(0, 10) || "د.ع",
      pin,
      footerNote: footer.trim().slice(0, 200),
      updatedAt: now(),
    });
    toast.success("تم حفظ الإعدادات");
  };

  const wipe = async () => {
    await Promise.all([
      db.products.clear(),
      db.invoices.clear(),
      db.returns.clear(),
      db.movements.clear(),
      db.categories.clear(),
    ]);
    await db.settings.update("settings", {
      invoiceCounter: 0,
      returnCounter: 0,
      updatedAt: now(),
    });
    toast.success("تم مسح كل البيانات");
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">الإعدادات</h1>
        <p className="text-muted-foreground text-sm mt-1">إعدادات المحل والنظام</p>
      </div>

      <div className="surface-card p-5 space-y-4">
        <h2 className="font-semibold">معلومات المحل</h2>
        <div>
          <Label>اسم المحل</Label>
          <Input value={shopName} onChange={(e) => setShopName(e.target.value)} maxLength={80} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>رمز العملة</Label>
            <Input value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={10} />
          </div>
          <div>
            <Label>الرمز السري للقفل</Label>
            <Input
              type="text"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
              className="nums"
            />
          </div>
        </div>
        <div>
          <Label>تذييل الفاتورة</Label>
          <Textarea value={footer} onChange={(e) => setFooter(e.target.value)} rows={2} maxLength={200} />
        </div>
        <Button onClick={save} className="gradient-gold text-primary font-semibold">
          <Save className="ml-2 h-4 w-4" /> حفظ التغييرات
        </Button>
      </div>

      <div className="surface-card p-5">
        <h2 className="font-semibold mb-2 flex items-center gap-2">
          <Database className="h-4 w-4" /> البيانات
        </h2>
        <p className="text-sm text-muted-foreground mb-3">
          جميع بياناتك محفوظة محلياً على هذا الجهاز عبر IndexedDB.
          البنية جاهزة للمزامنة مع Lovable Cloud لاحقاً دون فقدان أي بيانات.
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <Trash2 className="ml-2 h-4 w-4" /> مسح كل البيانات
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>تأكيد المسح الكامل</AlertDialogTitle>
              <AlertDialogDescription>
                سيتم حذف كل المنتجات والفواتير والمرتجعات. هذه العملية لا يمكن التراجع عنها.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                onClick={wipe}
                className="bg-destructive text-destructive-foreground"
              >
                نعم، احذف
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default Settings;
