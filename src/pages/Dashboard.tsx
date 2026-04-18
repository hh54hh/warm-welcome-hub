import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ShoppingCart,
  Package,
  ReceiptText,
  AlertTriangle,
  TrendingUp,
  Wallet,
  Undo2,
  Plus,
} from "lucide-react";
import { dashboardStats } from "@/db/services";
import { fmtCurrency, fmtNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";

const StatCard = ({
  title,
  value,
  icon: Icon,
  tint,
}: {
  title: string;
  value: string;
  icon: any;
  tint: string;
}) => (
  <div className="surface-card p-5 hover:shadow-elegant transition-shadow">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-2xl font-bold mt-2 nums">{value}</p>
      </div>
      <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${tint}`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </div>
);

const Dashboard = () => {
  const [stats, setStats] = useState({
    todaySales: 0,
    todayInvoiceCount: 0,
    todayReturns: 0,
    lowStock: 0,
    totalProducts: 0,
    stockValue: 0,
    totalInvoices: 0,
  });

  // refresh when underlying tables change
  const tick = useLiveQuery(async () => {
    const a = await db.invoices.count();
    const b = await db.products.count();
    const c = await db.returns.count();
    return a + b + c;
  });

  useEffect(() => {
    dashboardStats().then(setStats);
  }, [tick]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">لوحة التحكم</h1>
          <p className="text-muted-foreground mt-1">نظرة سريعة على أداء مركز البدر اليوم</p>
        </div>
        <div className="flex gap-2">
          <Button asChild className="gradient-gold text-primary font-semibold hover:opacity-90">
            <Link to="/pos">
              <ShoppingCart className="ml-2 h-4 w-4" />
              بيع جديد
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/inventory">
              <Plus className="ml-2 h-4 w-4" />
              إضافة منتج
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="مبيعات اليوم"
          value={fmtCurrency(stats.todaySales)}
          icon={TrendingUp}
          tint="bg-success/10 text-success"
        />
        <StatCard
          title="فواتير اليوم"
          value={fmtNumber(stats.todayInvoiceCount)}
          icon={ReceiptText}
          tint="bg-primary/10 text-primary"
        />
        <StatCard
          title="مرتجعات اليوم"
          value={fmtCurrency(stats.todayReturns)}
          icon={Undo2}
          tint="bg-destructive/10 text-destructive"
        />
        <StatCard
          title="منتجات تحتاج تجديد"
          value={fmtNumber(stats.lowStock)}
          icon={AlertTriangle}
          tint="bg-warning/10 text-warning"
        />
        <StatCard
          title="إجمالي المنتجات"
          value={fmtNumber(stats.totalProducts)}
          icon={Package}
          tint="bg-secondary/20 text-primary"
        />
        <StatCard
          title="قيمة المخزون (كلفة)"
          value={fmtCurrency(stats.stockValue)}
          icon={Wallet}
          tint="bg-accent/20 text-primary"
        />
        <StatCard
          title="إجمالي الفواتير"
          value={fmtNumber(stats.totalInvoices)}
          icon={ReceiptText}
          tint="bg-muted text-foreground"
        />
      </div>

      <div className="surface-card p-6">
        <h2 className="text-lg font-semibold mb-2">مرحباً بك في مركز البدر</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          النظام يعمل بالكامل على جهازك دون الحاجة للإنترنت. كل البيانات محفوظة محلياً بشكل آمن.
          البنية جاهزة للاتصال بالسحابة لاحقاً عند الحاجة دون فقدان أي بيانات.
        </p>
      </div>
    </div>
  );
};

export default Dashboard;
