import { Outlet, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ensureSettings } from "@/db/database";
import { checkOnlineStatus, manualSync } from "@/db/services";
import { Button } from "@/components/ui/button";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const AppLayout = () => {
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    ensureSettings();
    const unlocked = sessionStorage.getItem("badr_unlocked");
    if (!unlocked) navigate("/lock", { replace: true });
  }, [navigate]);

  const handleManualSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      const result = await manualSync();
      if (result.success) {
        toast.success(`تم مزامنة ${result.syncedRecords || 0} سجل`);
      } else {
        toast.error("فشلت المزامنة: " + (result.errors?.join(", ") || "خطأ غير معروف"));
      }
    } catch (error) {
      toast.error("خطأ في المزامنة");
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    // تحقق من حالة الاتصال ثم موجّه المزامنة عند إعادة الاتصال
    const updateStatus = async () => {
      const online = await checkOnlineStatus();
      setIsOnline(online);
    };

    const handleOnline = async () => {
      setIsOnline(true);
      await handleManualSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    updateStatus();
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    const interval = setInterval(updateStatus, 60000); // كل دقيقة

    return () => {
      clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [handleManualSync]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-3 border-b bg-card/60 backdrop-blur px-4 sticky top-0 z-30">
            <SidebarTrigger />
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              {isOnline ? (
                <div className="flex items-center gap-1 text-green-600">
                  <Wifi className="h-4 w-4" />
                  <span className="text-sm hidden md:inline">متصل</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-orange-600">
                  <WifiOff className="h-4 w-4" />
                  <span className="text-sm hidden md:inline">غير متصل</span>
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleManualSync}
                disabled={isSyncing || !isOnline}
                className="h-8 w-8 p-0"
              >
                <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            <span className="text-sm text-muted-foreground hidden lg:inline">
              نظام مركز البدر
            </span>
          </header>
          <main className="flex-1 p-4 md:p-6 animate-fade-in">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AppLayout;
