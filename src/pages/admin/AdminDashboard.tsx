import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/features/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, GraduationCap, UserSquare2, Building2, BookOpen, Wallet } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatVND } from "@/lib/format";

type TenantRow = {
  id: number;
  name: string;
  is_platform: boolean;
  created_at: string;
};

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
            <div className="font-display text-2xl font-semibold">{value}</div>
            {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const [tenantsRes, rolesRes, studentsRes, parentsRes, classesRes, paymentsRes] =
        await Promise.all([
          supabase.from("tenants").select("id, name, is_platform, created_at").order("created_at", { ascending: false }),
          supabase.from("user_roles").select("user_id, role, tenant_id"),
          supabase.from("students").select("id, tenant_id").is("deleted_at", null),
          supabase.from("parents").select("id, tenant_id").is("deleted_at", null),
          supabase.from("classes").select("id, tenant_id").is("deleted_at", null),
          supabase.from("payments").select("tenant_id, total_amount, paid_amount, status"),
        ]);
      if (tenantsRes.error) throw tenantsRes.error;
      const tenants = (tenantsRes.data ?? []) as TenantRow[];
      const roles = rolesRes.data ?? [];
      const students = studentsRes.data ?? [];
      const parents = parentsRes.data ?? [];
      const classes = classesRes.data ?? [];
      const payments = paymentsRes.data ?? [];

      const customerTenants = tenants.filter((t) => !t.is_platform);

      const byTenant = new Map<
        number,
        {
          teachers: number;
          students: number;
          parents: number;
          classes: number;
          revenue: number;
          paid: number;
          unpaid: number;
        }
      >();
      customerTenants.forEach((t) =>
        byTenant.set(t.id, { teachers: 0, students: 0, parents: 0, classes: 0, revenue: 0, paid: 0, unpaid: 0 }),
      );
      roles.forEach((r: any) => {
        if (r.role === "teacher") {
          const b = byTenant.get(r.tenant_id);
          if (b) b.teachers += 1;
        }
      });
      students.forEach((s: any) => {
        const b = byTenant.get(s.tenant_id);
        if (b) b.students += 1;
      });
      parents.forEach((p: any) => {
        const b = byTenant.get(p.tenant_id);
        if (b) b.parents += 1;
      });
      classes.forEach((c: any) => {
        const b = byTenant.get(c.tenant_id);
        if (b) b.classes += 1;
      });
      payments.forEach((p: any) => {
        const b = byTenant.get(p.tenant_id);
        if (b) {
          b.revenue += p.total_amount ?? 0;
          b.paid += p.paid_amount ?? 0;
          b.unpaid += Math.max(0, (p.total_amount ?? 0) - (p.paid_amount ?? 0));
        }
      });

      const totals = {
        tenants: customerTenants.length,
        teachers: roles.filter((r: any) => r.role === "teacher" && byTenant.has(r.tenant_id)).length,
        students: students.filter((s: any) => byTenant.has(s.tenant_id)).length,
        parents: parents.filter((p: any) => byTenant.has(p.tenant_id)).length,
        classes: classes.filter((c: any) => byTenant.has(c.tenant_id)).length,
        revenue: Array.from(byTenant.values()).reduce((a, b) => a + b.revenue, 0),
        unpaid: Array.from(byTenant.values()).reduce((a, b) => a + b.unpaid, 0),
      };

      return {
        tenants: customerTenants,
        byTenant,
        totals,
      };
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quản trị nền tảng"
        description="Tổng quan toàn bộ tài khoản giáo viên, học sinh và phụ huynh trong hệ thống"
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Stat icon={Building2} label="Tenants" value={data?.totals.tenants ?? 0} />
        <Stat icon={GraduationCap} label="Giáo viên" value={data?.totals.teachers ?? 0} />
        <Stat icon={Users} label="Học sinh" value={data?.totals.students ?? 0} />
        <Stat icon={UserSquare2} label="Phụ huynh" value={data?.totals.parents ?? 0} />
        <Stat icon={BookOpen} label="Lớp học" value={data?.totals.classes ?? 0} />
        <Stat
          icon={Wallet}
          label="Doanh thu"
          value={formatVND(data?.totals.revenue ?? 0)}
          hint={`Còn nợ: ${formatVND(data?.totals.unpaid ?? 0)}`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display">Chi tiết theo tenant</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên tenant</TableHead>
                <TableHead className="text-right">Giáo viên</TableHead>
                <TableHead className="text-right">Học sinh</TableHead>
                <TableHead className="text-right">Phụ huynh</TableHead>
                <TableHead className="text-right">Lớp</TableHead>
                <TableHead className="text-right">Doanh thu</TableHead>
                <TableHead className="text-right">Còn nợ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Đang tải…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && (data?.tenants.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Chưa có tenant nào
                  </TableCell>
                </TableRow>
              )}
              {data?.tenants.map((t) => {
                const b = data.byTenant.get(t.id)!;
                return (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div className="font-medium">{t.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Tạo: {new Date(t.created_at).toLocaleDateString("vi-VN")}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary">{b.teachers}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{b.students}</TableCell>
                    <TableCell className="text-right">{b.parents}</TableCell>
                    <TableCell className="text-right">{b.classes}</TableCell>
                    <TableCell className="text-right">{formatVND(b.revenue)}</TableCell>
                    <TableCell className="text-right text-destructive">
                      {b.unpaid > 0 ? formatVND(b.unpaid) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}