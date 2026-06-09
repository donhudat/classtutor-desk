import { useQuery } from "@tanstack/react-query";
import { Link, Navigate } from "react-router-dom";
import {
  Users,
  GraduationCap,
  UserSquare2,
  CalendarDays,
  BookOpen,
  Clock,
  CheckCircle2,
  Wallet,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/features/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth, useRole } from "@/features/auth/AuthProvider";
import { formatDateTime, formatVND } from "@/lib/format";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";

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
  const { isTeacher, isStudent, isParent, isSuperAdmin } = useRole();

  if (isSuperAdmin) return <Navigate to="/admin" replace />;

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

  const monthly = useQuery({
    enabled: isTeacher,
    queryKey: ["dashboard-monthly"],
    queryFn: async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const monthStartIso = monthStart.toISOString();
      const monthEndIso = monthEnd.toISOString();
      const nowIso = now.toISOString();

      // All sessions of the month (not cancelled)
      const { data: sessions } = await supabase
        .from("class_sessions")
        .select("id, class_id, starts_at, ends_at, status")
        .is("deleted_at", null)
        .neq("status", "cancelled")
        .gte("starts_at", monthStartIso)
        .lt("starts_at", monthEndIso)
        .limit(2000);

      const allSessions = sessions ?? [];
      const distinctClasses = new Set(allSessions.map((s: any) => s.class_id));
      const sessionIds = allSessions.map((s: any) => s.id);

      // Sessions that have at least 1 attendance record => counted as taught
      let taughtSessionIds = new Set<number>();
      if (sessionIds.length) {
        const { data: atts } = await supabase
          .from("attendances")
          .select("session_id")
          .in("session_id", sessionIds)
          .limit(5000);
        (atts ?? []).forEach((a: any) => taughtSessionIds.add(a.session_id));
      }

      // Estimated tuition: every (non-cancelled) session in month * sum(price_per_session) of active enrollments per class
      // Earned-to-date tuition: only sessions already taught (has attendance) up to now, count attended/late students * price
      const classIds = Array.from(distinctClasses);
      let enrollmentsByClass = new Map<number, { student_id: number; price: number }[]>();
      if (classIds.length) {
        const { data: enrolls } = await supabase
          .from("class_enrollments")
          .select("class_id, student_id, price_per_session, start_date, end_date")
          .in("class_id", classIds)
          .is("deleted_at", null)
          .limit(5000);
        (enrolls ?? []).forEach((e: any) => {
          const arr = enrollmentsByClass.get(e.class_id) ?? [];
          arr.push({ student_id: e.student_id, price: Number(e.price_per_session) || 0 });
          enrollmentsByClass.set(e.class_id, arr);
        });
      }

      let estimated = 0;
      let taughtCount = 0;
      for (const s of allSessions) {
        const enrolls = enrollmentsByClass.get(s.class_id) ?? [];
        const sumPrice = enrolls.reduce((acc, e) => acc + e.price, 0);
        estimated += sumPrice;
        if (taughtSessionIds.has(s.id)) taughtCount += 1;
      }

      // Earned tuition to date: sum of (attended + late) * price across attendances of this month
      let earned = 0;
      const earnedBySession = new Map<number, number>();
      if (sessionIds.length) {
        const { data: paidAtts } = await supabase
          .from("attendances")
          .select("session_id, student_id, status")
          .in("session_id", sessionIds)
          .in("status", ["attended", "late"])
          .limit(10000);
        // Build price map per (class_id, student_id)
        const priceMap = new Map<string, number>();
        enrollmentsByClass.forEach((list, classId) => {
          list.forEach((e) => priceMap.set(`${classId}:${e.student_id}`, e.price));
        });
        const sessionClass = new Map<number, number>();
        allSessions.forEach((s: any) => sessionClass.set(s.id, s.class_id));
        (paidAtts ?? []).forEach((a: any) => {
          const cid = sessionClass.get(a.session_id);
          const p = priceMap.get(`${cid}:${a.student_id}`) ?? 0;
          earned += p;
          earnedBySession.set(a.session_id, (earnedBySession.get(a.session_id) ?? 0) + p);
        });
      }

      // Build weekly cumulative trend (split month into weeks by ISO-ish: week 1 = days 1-7, etc.)
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const weekBoundaries: { label: string; endDay: number }[] = [];
      for (let start = 1; start <= lastDay; start += 7) {
        const end = Math.min(start + 6, lastDay);
        weekBoundaries.push({ label: `Tuần ${weekBoundaries.length + 1} (${start}-${end})`, endDay: end });
      }
      const todayDay = now.getDate();
      let cumEst = 0;
      let cumEarned = 0;
      const weekly = weekBoundaries.map((wb) => {
        for (const s of allSessions) {
          const d = new Date(s.starts_at).getDate();
          if (d > wb.endDay) continue;
          // only count if not already counted in previous weeks: sessions are accumulated linearly,
          // so add those whose day falls in this week range (between previous endDay+1 and endDay)
        }
        // Recompute using ranges to keep it simple
        return wb;
      });
      // Proper cumulative computation
      const weeklyData = weekBoundaries.map((wb) => {
        let estUpTo = 0;
        let earnedUpTo = 0;
        for (const s of allSessions) {
          const d = new Date(s.starts_at).getDate();
          if (d <= wb.endDay) {
            const enrolls = enrollmentsByClass.get(s.class_id) ?? [];
            estUpTo += enrolls.reduce((acc, e) => acc + e.price, 0);
            if (d <= todayDay) {
              earnedUpTo += earnedBySession.get(s.id) ?? 0;
            }
          }
        }
        return {
          week: wb.label,
          estimated: estUpTo,
          earned: earnedUpTo,
        };
      });

      return {
        plannedClasses: distinctClasses.size,
        plannedSessions: allSessions.length,
        taughtSessions: taughtCount,
        estimatedTuition: estimated,
        earnedTuition: earned,
        weekly: weeklyData,
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
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={GraduationCap} label="Lớp đang hoạt động" value={stats.data?.classes ?? 0} loading={stats.isLoading} />
            <StatCard icon={Users} label="Học sinh" value={stats.data?.students ?? 0} loading={stats.isLoading} />
            <StatCard icon={UserSquare2} label="Phụ huynh" value={stats.data?.parents ?? 0} loading={stats.isLoading} />
            <StatCard
              icon={CalendarDays}
              label="Lớp dự kiến trong tháng"
              value={monthly.data?.plannedClasses ?? 0}
              loading={monthly.isLoading}
            />
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
              Thống kê tháng {new Date().getMonth() + 1}/{new Date().getFullYear()}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                icon={CalendarDays}
                label="Buổi dự kiến"
                value={monthly.data?.plannedSessions ?? 0}
                loading={monthly.isLoading}
              />
              <StatCard
                icon={CheckCircle2}
                label="Buổi đã dạy"
                value={`${monthly.data?.taughtSessions ?? 0} / ${monthly.data?.plannedSessions ?? 0}`}
                loading={monthly.isLoading}
              />
              <StatCard
                icon={TrendingUp}
                label="Học phí ước tính (cả tháng)"
                value={formatVND(monthly.data?.estimatedTuition ?? 0)}
                loading={monthly.isLoading}
              />
              <StatCard
                icon={Wallet}
                label="Học phí tới hiện tại"
                value={formatVND(monthly.data?.earnedTuition ?? 0)}
                loading={monthly.isLoading}
              />
            </div>
          </div>

          <Card className="border-border/80">
            <CardHeader>
              <CardTitle className="text-base">Xu hướng học phí theo tuần</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  estimated: { label: "Ước tính (luỹ kế)", color: "hsl(var(--primary))" },
                  earned: { label: "Đã đạt (luỹ kế)", color: "hsl(var(--accent-foreground))" },
                } satisfies ChartConfig}
                className="aspect-[16/6] w-full"
              >
                <AreaChart data={monthly.data?.weekly ?? []} margin={{ left: 8, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="fillEstimated" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-estimated)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="var(--color-estimated)" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="fillEarned" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-earned)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="var(--color-earned)" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="week" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    fontSize={11}
                    tickFormatter={(v) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}tr` : `${(v / 1000).toFixed(0)}k`)}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name) => (
                          <div className="flex w-full items-center justify-between gap-3">
                            <span className="text-muted-foreground">
                              {name === "estimated" ? "Ước tính" : "Đã đạt"}
                            </span>
                            <span className="font-mono font-medium tabular-nums">
                              {formatVND(Number(value))}
                            </span>
                          </div>
                        )}
                      />
                    }
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Area
                    type="monotone"
                    dataKey="estimated"
                    stroke="var(--color-estimated)"
                    fill="url(#fillEstimated)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="earned"
                    stroke="var(--color-earned)"
                    fill="url(#fillEarned)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>
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
