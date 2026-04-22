import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";

export function AppLayout() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <header className="flex h-14 items-center gap-2 border-b border-border bg-card/60 px-4 backdrop-blur">
            <SidebarTrigger />
            <div className="ml-2 font-display text-base font-medium">
              Bảng điều khiển
            </div>
          </header>
          <main className="flex-1 overflow-auto px-6 py-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
