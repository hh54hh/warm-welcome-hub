import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  ReceiptText,
  Undo2,
  Settings as SettingsIcon,
  Lock,
  Crown,
  Users,
} from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const items = [
  { title: "لوحة التحكم", url: "/", icon: LayoutDashboard },
  { title: "نقطة البيع", url: "/pos", icon: ShoppingCart },
  { title: "الزبائن", url: "/customers", icon: Users },
  { title: "المخزن والمنتجات", url: "/inventory", icon: Package },
  { title: "الفواتير", url: "/invoices", icon: ReceiptText },
  { title: "المرتجعات", url: "/returns", icon: Undo2 },
  { title: "الإعدادات", url: "/settings", icon: SettingsIcon },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();

  const handleLock = () => {
    sessionStorage.removeItem("badr_unlocked");
    navigate("/lock");
  };

  return (
    <Sidebar collapsible="icon" side="right">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg gradient-gold shadow-gold">
            <Crown className="h-5 w-5 text-primary" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-base font-bold text-sidebar-primary">مركز البدر</span>
              <span className="text-[11px] text-sidebar-foreground/70">إدارة المبيعات والمخزن</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>القوائم الرئيسية</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active =
                  item.url === "/"
                    ? location.pathname === "/"
                    : location.pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        className={cn(
                          "flex items-center gap-3 rounded-md transition-colors",
                          active
                            ? "bg-sidebar-accent text-sidebar-primary font-semibold"
                            : "hover:bg-sidebar-accent/50",
                        )}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLock}
          className="justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-primary"
        >
          <Lock className="h-4 w-4" />
          {!collapsed && <span>قفل الشاشة</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
