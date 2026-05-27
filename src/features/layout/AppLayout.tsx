import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";

export function AppLayout() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/60 bg-background/70 px-6 backdrop-blur-xl">
            <SidebarTrigger className="rounded-full hover:bg-secondary/60" />
            <div className="ml-1 font-display text-sm font-medium text-muted-foreground">
              Bảng điều khiển
            </div>
          </header>
          <main className="flex-1 overflow-auto px-6 py-8 md:px-10 md:py-10 animate-fade-in">
            <div className="mx-auto w-full max-w-7xl">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
