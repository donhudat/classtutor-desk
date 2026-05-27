import { Outlet, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Bell, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const ROUTE_LABELS: Record<string, string> = {
  "/": "Tổng quan",
  "/classes": "Lớp học",
  "/sessions": "Buổi học",
  "/attendance": "Điểm danh",
  "/assignments": "Bài tập",
  "/submissions": "Bài nộp",
  "/students": "Học sinh",
  "/parents": "Phụ huynh",
  "/payments": "Học phí",
  "/seo-keywords": "SEO từ khóa",
  "/settings": "Cài đặt",
  "/my-classes": "Lớp của tôi",
  "/my-assignments": "Bài tập",
  "/my-children": "Con của tôi",
  "/my-payments": "Học phí",
};

export function AppLayout() {
  const { pathname } = useLocation();
  const label =
    ROUTE_LABELS[pathname] ??
    Object.entries(ROUTE_LABELS).find(([k]) => k !== "/" && pathname.startsWith(k))?.[1] ??
    "Bảng điều khiển";

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex flex-1 flex-col min-w-0">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/50 bg-background/60 px-4 backdrop-blur-xl md:px-8">
            <SidebarTrigger className="h-9 w-9 rounded-xl hover:bg-secondary/60" />
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground/60">Lớp Học</span>
              <span className="text-muted-foreground/40">/</span>
              <span className="font-medium text-foreground">{label}</span>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <div className="hidden md:flex h-9 items-center gap-2 rounded-full border border-border/70 bg-card/70 px-3.5 text-xs text-muted-foreground shadow-sm">
                <Search className="h-3.5 w-3.5" />
                <span>Tìm kiếm…</span>
                <kbd className="ml-2 rounded-md border border-border/80 bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/80">
                  ⌘K
                </kbd>
              </div>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl">
                <Bell className="h-[18px] w-[18px]" />
              </Button>
              <Button size="sm" className="hidden sm:inline-flex h-9 gap-1.5 bg-gradient-to-r from-primary to-accent shadow-md shadow-primary/20">
                <Sparkles className="h-3.5 w-3.5" />
                Nâng cấp
              </Button>
            </div>
          </header>
          <main className="flex-1 overflow-auto px-4 py-8 md:px-10 md:py-10 animate-fade-in">
            <div className="mx-auto w-full max-w-[1400px]">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
