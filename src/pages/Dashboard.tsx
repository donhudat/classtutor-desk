import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Users,
  GraduationCap,
  UserSquare2,
  CalendarDays,
  BookOpen,
  Clock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/features/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth, useRole } from "@/features/auth/AuthProvider";
import { formatDateTime } from "@/lib/format";

function StatCard({
  icon: Icon,
  label,
  value,
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  loading?: boolean;
}) {
  return (
    <Card className="border-border/80">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="font-display text-3xl font-semibold">
          {loading ? "—" : value}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { profile } = useAuth();
  const { isTeacher, isStudent, isParent } = useRole();

  const stats = useQuery({
    enabled: isTeacher,
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [students, parents, classes] = await Promise.all([
        supabase.from("students").select("*", { count: "exact", head: true }).is("deleted_at", null),
        supabase.from("parents").select("*", { count: "exact", head: true }).is("deleted_at", null),
        supabase.from("classes").select("*", { count: "exact", head: true }).is("deleted_at", null),
      ]);
      return {
        students: students.count ?? 0,
        parents: parents.count ?? 0,
        classes: classes.count ?? 0,
      };
    },
  });

  const upcoming = useQuery({
    enabled: isStudent || isParent,
    queryKey: ["dashboard-upcoming"],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from("class_sessions")
        .select("id, starts_at, ends_at, classes(name, subject)")
        .is("deleted_at", null)
        .gte("ends_at", now)
        .neq("status", "cancelled")
        .order("starts_at", { ascending: true })
        .limit(5);
      return data ?? [];
    },
  });

  const studentAssignments = useQuery({
    enabled: isStudent,
    queryKey: ["dashboard-assignments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("assignments")
        .select("id, title, deadline, classes(name)")
        .is("deleted_at", null)
        .order("deadline", { ascending: true, nullsFirst: false })
        .limit(5);
      return data ?? [];
    },
  });

  return (
    <div>
      <PageHeader
        title={`Xin chào, ${profile?.full_name?.split(" ").slice(-1)[0] ?? ""}`}
        description={
          isTeacher
            ? `Mã tenant của bạn là #${profile?.tenant_id} — chia sẻ cho học sinh & phụ huynh để họ đăng nhập.`
            : "Tổng quan hoạt động học tập của bạn."
        }
      />

      {isTeacher ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={GraduationCap} label="Lớp đang hoạt động" value={stats.data?.classes ?? 0} loading={stats.isLoading} />
          <StatCard icon={Users} label="Học sinh" value={stats.data?.students ?? 0} loading={stats.isLoading} />
          <StatCard icon={UserSquare2} label="Phụ huynh" value={stats.data?.parents ?? 0} loading={stats.isLoading} />
          <StatCard icon={CalendarDays} label="Buổi học tuần này" value="—" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-border/80">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Buổi học sắp tới
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-2">
              {(upcoming.data ?? []).length === 0 && !upcoming.isLoading && (
                <p className="text-sm text-muted-foreground">Chưa có buổi sắp tới.</p>
              )}
              {(upcoming.data ?? []).map((s: any) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border bg-card/50 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {s.classes?.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDateTime(s.starts_at)}
                    </div>
                  </div>
                  {s.classes?.subject && (
                    <Badge variant="secondary">{s.classes.subject}</Badge>
                  )}
                </div>
              ))}
              <Button asChild variant="ghost" size="sm" className="mt-2 w-full">
                <Link to={isStudent ? "/my-classes" : "/my-children"}>
                  Xem tất cả
                </Link>
              </Button>
            </CardContent>
          </Card>

          {isStudent && (
            <Card className="border-border/80">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Bài tập gần đây
                </CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="space-y-2">
                {(studentAssignments.data ?? []).length === 0 &&
                  !studentAssignments.isLoading && (
                    <p className="text-sm text-muted-foreground">
                      Chưa có bài tập.
                    </p>
                  )}
                {(studentAssignments.data ?? []).map((a: any) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border bg-card/50 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{a.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {a.classes?.name}
                        {a.deadline && ` • Hạn ${formatDateTime(a.deadline)}`}
                      </div>
                    </div>
                  </div>
                ))}
                <Button asChild variant="ghost" size="sm" className="mt-2 w-full">
                  <Link to="/my-assignments">Xem tất cả</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {isParent && (
            <Card className="border-border/80">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Theo dõi con
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-sm text-muted-foreground">
                  Xem lịch học, bài tập, điểm danh và nhận xét của con.
                </p>
                <Button asChild size="sm">
                  <Link to="/my-children">Mở trang</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
