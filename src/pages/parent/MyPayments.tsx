import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/features/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
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
import { formatVND, formatDate } from "@/lib/format";
import { useAuth } from "@/features/auth/AuthProvider";

type Row = {
  id: number;
  student_id: number;
  month: string;
  session_count: number;
  attended_count: number;
  late_count: number;
  price_per_session: number;
  total_amount: number;
  paid_amount: number;
  status: "unpaid" | "partial" | "paid";
  paid_at: string | null;
  note: string | null;
  class_enrollments?: { classes?: { id: number; name: string; subject: string | null } | null } | null;
};

const STATUS_LABEL: Record<Row["status"], string> = {
  unpaid: "Chưa thanh toán",
  partial: "Một phần",
  paid: "Đã thanh toán",
};
const STATUS_VARIANT: Record<Row["status"], "default" | "secondary" | "destructive"> = {
  unpaid: "destructive",
  partial: "secondary",
  paid: "default",
};

function fmtMonth(iso: string) {
  const d = new Date(iso);
  return `Tháng ${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

const ATT_LABEL: Record<string, string> = { present: "Có mặt", late: "Đi muộn", absent: "Vắng", excused: "Có phép" };
const ATT_TONE: Record<string, string> = {
  present: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  late: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  absent: "bg-red-500/15 text-red-700 border-red-500/30",
  excused: "bg-sky-500/15 text-sky-700 border-sky-500/30",
};
const SESSION_TONE: Record<string, string> = {
  completed: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  cancelled: "bg-red-500/15 text-red-700 border-red-500/30",
  scheduled: "bg-muted text-muted-foreground border-border",
};
const SESSION_LABEL: Record<string, string> = { completed: "Đã học", cancelled: "Đã huỷ", scheduled: "Chưa diễn ra" };
function fmtDM(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function fmtHM(iso: string) {
  return new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function AttendanceBreakdown({ studentId, classId, month, children }: { studentId: number; classId: number; month: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ["my-payment-breakdown", studentId, classId, month],
    enabled: open && !!classId && !!studentId,
    queryFn: async () => {
      const d = new Date(month);
      const nextIso = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString().slice(0, 10);
      const { data: sessions, error } = await supabase
        .from("class_sessions")
        .select("id, starts_at, ends_at, status")
        .eq("class_id", classId)
        .gte("starts_at", month)
        .lt("starts_at", nextIso)
        .is("deleted_at", null)
        .order("starts_at");
      if (error) throw error;
      const ids = (sessions ?? []).map((s: any) => s.id);
      let atts: any[] = [];
      if (ids.length) {
        const { data } = await supabase
          .from("attendances")
          .select("session_id, status")
          .eq("student_id", studentId)
          .in("session_id", ids);
        atts = data ?? [];
      }
      const map = new Map(atts.map((a) => [a.session_id, a]));
      return (sessions ?? []).map((s: any) => ({ ...s, attendance: map.get(s.id) ?? null }));
    },
  });
  return (
    <HoverCard openDelay={120} closeDelay={80} onOpenChange={setOpen}>
      <HoverCardTrigger asChild>
        <button type="button" className="cursor-help text-inherit">{children}</button>
      </HoverCardTrigger>
      <HoverCardContent className="w-[340px] p-0" align="center">
        <div className="border-b px-3 py-2 text-xs font-semibold">Chi tiết buổi học</div>
        <div className="max-h-[280px] overflow-auto p-2">
          {q.isLoading ? (
            <div className="px-2 py-4 text-center text-xs text-muted-foreground">Đang tải...</div>
          ) : (q.data ?? []).length === 0 ? (
            <div className="px-2 py-4 text-center text-xs text-muted-foreground">Không có buổi học trong tháng.</div>
          ) : (
            <ul className="space-y-1">
              {q.data!.map((s: any) => {
                const isCancelled = s.status === "cancelled";
                const att = s.attendance?.status as string | undefined;
                const tone = isCancelled ? SESSION_TONE.cancelled : att ? ATT_TONE[att] ?? SESSION_TONE[s.status] : SESSION_TONE[s.status] ?? SESSION_TONE.scheduled;
                const label = isCancelled ? "Đã huỷ" : att ? ATT_LABEL[att] ?? att : SESSION_LABEL[s.status] ?? "—";
                return (
                  <li key={s.id} className={`flex items-center justify-between gap-2 rounded border px-2 py-1.5 text-xs ${tone}`}>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{fmtDM(s.starts_at)}</span>
                      <span className="opacity-70">{fmtHM(s.starts_at)}</span>
                    </div>
                    <span className="font-medium">{label}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="border-t px-3 py-2 text-[10px] text-muted-foreground">
          Có mặt / Muộn được tính học phí. Vắng / Có phép / Đã huỷ không tính.
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

export default function MyPaymentsPage() {
  const { user } = useAuth();
  const [childId, setChildId] = useState<string>("all");

  const parentQ = useQuery({
    queryKey: ["my-parent-id-pay", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("parents").select("id").eq("user_id", user!.id).maybeSingle();
      return data?.id ?? null;
    },
  });

  const childrenQ = useQuery({
    queryKey: ["my-children-pay", parentQ.data],
    enabled: !!parentQ.data,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, profiles(full_name)")
        .eq("parent_id", parentQ.data!)
        .is("deleted_at", null);
      if (error) throw error;
      return (data ?? []).map((s: any) => ({ id: s.id, name: s.profiles?.full_name ?? "—" }));
    },
  });

  useEffect(() => {
    // default first child
  }, [childrenQ.data]);

  const paymentsQ = useQuery({
    queryKey: ["my-payments", parentQ.data, childId],
    enabled: !!parentQ.data,
    queryFn: async () => {
      let q = supabase
        .from("payments")
        .select(
          "id, student_id, month, session_count, attended_count, late_count, absent_count, excused_count, price_per_session, total_amount, paid_amount, status, paid_at, note, class_enrollments(classes(id, name, subject))"
        )
        .order("month", { ascending: false });
      if (childId !== "all") q = q.eq("student_id", Number(childId));
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const totals = useMemo(() => {
    const list = paymentsQ.data ?? [];
    return {
      total: list.reduce((s, r) => s + r.total_amount, 0),
      paid: list.reduce((s, r) => s + r.paid_amount, 0),
      remaining: list.reduce((s, r) => s + Math.max(0, r.total_amount - r.paid_amount), 0),
    };
  }, [paymentsQ.data]);

  return (
    <div>
      <PageHeader title="Học phí" description="Theo dõi học phí từng tháng của con." />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card><CardContent className="py-4">
          <div className="text-xs text-muted-foreground">Tổng học phí</div>
          <div className="font-display text-2xl font-semibold">{formatVND(totals.total)}</div>
        </CardContent></Card>
        <Card><CardContent className="py-4">
          <div className="text-xs text-muted-foreground">Đã thanh toán</div>
          <div className="font-display text-2xl font-semibold text-emerald-600 dark:text-emerald-400">{formatVND(totals.paid)}</div>
        </CardContent></Card>
        <Card><CardContent className="py-4">
          <div className="text-xs text-muted-foreground">Còn nợ</div>
          <div className="font-display text-2xl font-semibold text-destructive">{formatVND(totals.remaining)}</div>
        </CardContent></Card>
      </div>

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center gap-3 py-4">
          <Wallet className="h-4 w-4 text-muted-foreground" />
          <Select value={childId} onValueChange={setChildId}>
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả các con</SelectItem>
              {(childrenQ.data ?? []).map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tháng</TableHead>
                <TableHead>Lớp</TableHead>
                <TableHead className="text-center">Buổi</TableHead>
                <TableHead className="text-right">Đơn giá</TableHead>
                <TableHead className="text-right">Tổng</TableHead>
                <TableHead className="text-right">Đã trả</TableHead>
                <TableHead>Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paymentsQ.isLoading ? (
                <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">Đang tải...</TableCell></TableRow>
              ) : (paymentsQ.data ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">Chưa có phiếu học phí.</TableCell></TableRow>
              ) : (
                (paymentsQ.data ?? []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{fmtMonth(r.month)}</TableCell>
                    <TableCell>
                      <div>{r.class_enrollments?.classes?.name ?? "—"}</div>
                      {r.class_enrollments?.classes?.subject && (
                        <div className="text-xs text-muted-foreground">{r.class_enrollments.classes.subject}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {r.class_enrollments?.classes?.id ? (
                        <AttendanceBreakdown studentId={r.student_id} classId={r.class_enrollments.classes.id} month={r.month}>
                          <span className="underline-offset-2 hover:underline">
                            <span className="font-medium">{r.attended_count + r.late_count}</span>
                            <span className="text-muted-foreground"> / {r.session_count}</span>
                          </span>
                        </AttendanceBreakdown>
                      ) : (
                        <>{r.attended_count + r.late_count} / {r.session_count}</>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{formatVND(r.price_per_session)}</TableCell>
                    <TableCell className="text-right font-medium">{formatVND(r.total_amount)}</TableCell>
                    <TableCell className="text-right">{formatVND(r.paid_amount)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                      {r.paid_at && (
                        <div className="mt-1 text-[11px] text-muted-foreground">{formatDate(r.paid_at)}</div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
