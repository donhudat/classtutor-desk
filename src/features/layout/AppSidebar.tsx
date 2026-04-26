import {
  LayoutDashboard,
  Users,
  UserSquare2,
  GraduationCap,
  CalendarDays,
  ClipboardCheck,
  BookOpen,
  FileCheck2,
  Wallet,
  Settings,
  LogOut,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth, useRole } from "@/features/auth/AuthProvider";
import { Button } from "@/components/ui/button";

type Item = { title: string; url: string; icon: React.ComponentType<{ className?: string }> };

const teacherItems: Item[] = [
  { title: "Tổng quan", url: "/", icon: LayoutDashboard },
  { title: "Lớp học", url: "/classes", icon: GraduationCap },
  { title: "Buổi học", url: "/sessions", icon: CalendarDays },
  { title: "Điểm danh", url: "/attendance", icon: ClipboardCheck },
  { title: "Bài tập", url: "/assignments", icon: BookOpen },
  { title: "Bài nộp", url: "/submissions", icon: FileCheck2 },
  { title: "Học sinh", url: "/students", icon: Users },
  { title: "Phụ huynh", url: "/parents", icon: UserSquare2 },
  { title: "Học phí", url: "/payments", icon: Wallet },
];

const studentItems: Item[] = [
  { title: "Tổng quan", url: "/", icon: LayoutDashboard },
  { title: "Lớp của tôi", url: "/my-classes", icon: GraduationCap },
  { title: "Bài tập", url: "/my-assignments", icon: BookOpen },
];

const parentItems: Item[] = [
  { title: "Tổng quan", url: "/", icon: LayoutDashboard },
  { title: "Con của tôi", url: "/my-children", icon: Users },
  { title: "Học phí", url: "/my-payments", icon: Wallet },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { profile, signOut } = useAuth();
  const { isTeacher, isStudent, isParent } = useRole();

  const items = isTeacher
    ? teacherItems
    : isStudent
    ? studentItems
    : isParent
    ? parentItems
    : [];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground font-display text-lg font-semibold">
            L
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="font-display text-base font-semibold text-sidebar-foreground">
                Lớp Học
              </span>
              <span className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60">
                {isTeacher ? "Giáo viên" : isStudent ? "Học sinh" : "Phụ huynh"}
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Điều hướng</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-sidebar-accent/60"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isTeacher && (
          <SidebarGroup>
            {!collapsed && <SidebarGroupLabel>Hệ thống</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Cài đặt">
                    <NavLink
                      to="/settings"
                      className="hover:bg-sidebar-accent/60"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <Settings className="h-4 w-4" />
                      {!collapsed && <span>Cài đặt</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-accent-foreground text-xs font-medium">
            {profile?.full_name?.[0]?.toUpperCase() ?? "?"}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-sidebar-foreground">
                {profile?.full_name}
              </div>
              <div className="truncate text-[11px] text-sidebar-foreground/60">
                @{profile?.login_id}
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={signOut}
            className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
            title="Đăng xuất"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
