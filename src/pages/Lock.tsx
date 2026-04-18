import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Crown, Lock as LockIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ensureSettings } from "@/db/database";
import { toast } from "sonner";

const Lock = () => {
  const [pin, setPin] = useState("");
  const [storedPin, setStoredPin] = useState("1234");
  const navigate = useNavigate();

  useEffect(() => {
    ensureSettings().then((s) => setStoredPin(s.pin));
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === storedPin) {
      sessionStorage.setItem("badr_unlocked", "1");
      toast.success("مرحباً بك في مركز البدر");
      navigate("/", { replace: true });
    } else {
      toast.error("الرمز السري غير صحيح");
      setPin("");
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center gradient-primary p-4">
      <div className="w-full max-w-md">
        <div className="surface-card p-8 shadow-elegant animate-scale-in">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="h-16 w-16 rounded-2xl gradient-gold flex items-center justify-center shadow-gold mb-4">
              <Crown className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">مركز البدر</h1>
            <p className="text-sm text-muted-foreground mt-1">
              نظام إدارة المبيعات والمخزن
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <LockIcon className="h-4 w-4" />
                الرمز السري
              </label>
              <Input
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                className="text-center text-2xl tracking-widest nums h-14"
                autoFocus
              />
              <p className="text-xs text-muted-foreground text-center">
                الرمز الافتراضي: <span className="nums font-mono">1234</span> — يمكن تغييره من الإعدادات
              </p>
            </div>
            <Button type="submit" className="w-full h-12 text-base gradient-gold text-primary font-semibold hover:opacity-90">
              دخول
            </Button>
          </form>
        </div>
        <p className="text-center text-xs text-primary-foreground/70 mt-4">
          البيانات محفوظة محلياً على هذا الجهاز
        </p>
      </div>
    </div>
  );
};

export default Lock;
