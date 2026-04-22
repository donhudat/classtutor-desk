import { useQuery } from "@tanstack/react-query";
import { Users, GraduationCap, UserSquare2, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/features/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth, useRole } from "@/features/auth/AuthProvider";

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
  const { isTeacher } = useRole();

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
        <Card className="border-border/80">
          <CardContent className="py-12 text-center text-muted-foreground">
            Tính năng dành cho học sinh/phụ huynh sẽ ra mắt ở bản tiếp theo.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
