import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/features/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";

type Row = {
  id: number;
  created_at: string;
  action: string;
  entity: string;
  entity_id: string | null;
  user_id: string | null;
  tenant_id: number | null;
  after: any;
};

const ACTION_TONE: Record<string, string> = {
  login: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  logout: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300",
  create: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  update: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  delete: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
};

export default function AdminAuditLog() {
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-audit", actionFilter],
    queryFn: async () => {
      let q = supabase
        .from("audit_logs")
        .select("id, created_at, action, entity, entity_id, user_id, tenant_id, after")
        .order("created_at", { ascending: false })
        .limit(500);
      if (actionFilter !== "all") q = q.eq("action", actionFilter);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []) as Row[];

      const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean))) as string[];
      const tenantIds = Array.from(new Set(rows.map((r) => r.tenant_id).filter(Boolean))) as number[];

      const [profilesRes, tenantsRes] = await Promise.all([
        userIds.length
          ? supabase.from("profiles").select("id, full_name, login_id, email").in("id", userIds)
          : Promise.resolve({ data: [] as any[] }),
        tenantIds.length
          ? supabase.from("tenants").select("id, name").in("id", tenantIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const userMap = new Map((profilesRes.data ?? []).map((p: any) => [p.id, p]));
      const tenantMap = new Map((tenantsRes.data ?? []).map((t: any) => [t.id, t]));
      return { rows, userMap, tenantMap };
    },
  });

  const filtered = useMemo(() => {
    const rows = data?.rows ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => {
      const u = r.user_id ? data?.userMap.get(r.user_id) : null;
      const t = r.tenant_id ? data?.tenantMap.get(r.tenant_id) : null;
      return (
        r.action.toLowerCase().includes(term) ||
        r.entity.toLowerCase().includes(term) ||
        (u?.full_name ?? "").toLowerCase().includes(term) ||
        (u?.login_id ?? "").toLowerCase().includes(term) ||
        (u?.email ?? "").toLowerCase().includes(term) ||
        (t?.name ?? "").toLowerCase().includes(term)
      );
    });
  }, [data, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nhật ký truy cập"
        description="Theo dõi ai đã đăng nhập, thao tác gì, khi nào — phục vụ giám sát và bán gói."
      />

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              placeholder="Tìm theo người dùng, tenant, hành động…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả hành động</SelectItem>
                <SelectItem value="login">Đăng nhập</SelectItem>
                <SelectItem value="logout">Đăng xuất</SelectItem>
                <SelectItem value="create">Tạo mới</SelectItem>
                <SelectItem value="update">Cập nhật</SelectItem>
                <SelectItem value="delete">Xóa</SelectItem>
              </SelectContent>
            </Select>
            <div className="ml-auto text-xs text-muted-foreground">
              Hiển thị {filtered.length} / {data?.rows.length ?? 0} bản ghi gần nhất
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-44">Thời gian</TableHead>
                <TableHead>Người dùng</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Hành động</TableHead>
                <TableHead>Đối tượng</TableHead>
                <TableHead>Chi tiết</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Đang tải…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Chưa có bản ghi
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((r) => {
                const u = r.user_id ? data?.userMap.get(r.user_id) : null;
                const t = r.tenant_id ? data?.tenantMap.get(r.tenant_id) : null;
                const tone =
                  ACTION_TONE[r.action] ??
                  "bg-primary/15 text-primary";
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(r.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{u?.full_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {u?.email ?? (u?.login_id ? `@${u.login_id}` : "")}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{t?.name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge className={tone} variant="secondary">
                        {r.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.entity}
                      {r.entity_id ? (
                        <span className="text-xs text-muted-foreground"> #{r.entity_id}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="max-w-md">
                      {r.after ? (
                        <code className="block truncate rounded bg-muted px-2 py-1 text-[11px]">
                          {typeof r.after === "string" ? r.after : JSON.stringify(r.after)}
                        </code>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
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