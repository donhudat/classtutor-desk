import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Calculator, Wallet, CheckCircle2, Search, X, ChevronDown, ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/features/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { formatVND, formatDate } from "@/lib/format";
import { toast } from "@/hooks/use-toast";

type PaymentRow = {
  id: number;
  student_id: number;
  class_enrollment_id: number;
  month: string;
  session_count: number;
  attended_count: number;
  late_count: number;
  absent_count: number;
  excused_count: number;
  price_per_session: number;
  total_amount: number;
  paid_amount: number;
  status: "unpaid" | "partial" | "paid";
  paid_at: string | null;
  note: string | null;
  students?: { profiles?: { full_name: string; login_id: string } } | null;
  class_enrollments?: { classes?: { id: number; name: string; subject: string | null } | null } | null;
};

const STATUS_LABEL: Record<PaymentRow["status"], string> = {
  unpaid: "Chưa thanh toán",
  partial: "Thanh toán một phần",
  paid: "Đã thanh toán",
};

const STATUS_VARIANT: Record<PaymentRow["status"], "default" | "secondary" | "destructive" | "outline"> = {
  unpaid: "destructive",
  partial: "secondary",
  paid: "default",
};

function monthOptions(count = 12): string[] {
  const arr: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    arr.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
  }
  return arr;
}

function formatMonthLabel(iso: string) {
  const d = new Date(iso);
  return `Tháng ${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function toMonthInput(iso: string) {
  // "YYYY-MM-01" -> "YYYY-MM"
  return iso.slice(0, 7);
}
function fromMonthInput(v: string) {
  // "YYYY-MM" -> "YYYY-MM-01"
  return `${v}-01`;
}
function monthsBetween(fromIso: string, toIso: string): string[] {
  const out: string[] = [];
  const a = new Date(fromIso);
  const b = new Date(toIso);
  let y = a.getFullYear(), m = a.getMonth();
  const ey = b.getFullYear(), em = b.getMonth();
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m + 1).padStart(2, "0")}-01`);
    m++; if (m > 11) { m = 0; y++; }
  }
  return out;
}

export default function PaymentsPage() {
  const qc = useQueryClient();
  const months = useMemo(() => monthOptions(12), []);
  const [fromMonth, setFromMonth] = useState<string>(months[0]);
  const [toMonth, setToMonth] = useState<string>(months[0]);
  const [classId, setClassId] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [studentIds, setStudentIds] = useState<number[]>([]);
  const [parentIds, setParentIds] = useState<number[]>([]);
  const [computing, setComputing] = useState(false);
  const [editing, setEditing] = useState<PaymentRow | null>(null);

  const classesQ = useQuery({
    queryKey: ["classes-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("id, name, subject")
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const studentsQ = useQuery({
    queryKey: ["students-min-pay"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, parent_id, profiles(full_name, login_id)")
        .is("deleted_at", null);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const parentsQ = useQuery({
    queryKey: ["parents-min-pay"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parents")
        .select("id, profiles(full_name)")
        .is("deleted_at", null);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // Effective student id filter combining direct student picks + parent picks
  const effectiveStudentIds = useMemo<number[] | null>(() => {
    const set = new Set<number>();
    let any = false;
    if (studentIds.length) {
      any = true;
      studentIds.forEach((id) => set.add(id));
    }
    if (parentIds.length) {
      any = true;
      const ps = new Set(parentIds);
      (studentsQ.data ?? []).forEach((s: any) => {
        if (s.parent_id && ps.has(s.parent_id)) set.add(s.id);
      });
    }
    return any ? Array.from(set) : null;
  }, [studentIds, parentIds, studentsQ.data]);

  const paymentsQ = useQuery({
    queryKey: ["payments", fromMonth, toMonth, classId, status, effectiveStudentIds?.join(",") ?? ""],
    queryFn: async () => {
      // Ensure from <= to
      const lo = fromMonth <= toMonth ? fromMonth : toMonth;
      const hi = fromMonth <= toMonth ? toMonth : fromMonth;
      let q = supabase
        .from("payments")
        .select(
          "id, student_id, class_enrollment_id, month, session_count, attended_count, late_count, absent_count, excused_count, price_per_session, total_amount, paid_amount, status, paid_at, note, students(profiles(full_name, login_id)), class_enrollments(classes(id, name, subject))"
        )
        .gte("month", lo)
        .lte("month", hi)
        .order("month", { ascending: false })
        .order("id", { ascending: false });
      if (status !== "all") q = q.eq("status", status as PaymentRow["status"]);
      if (effectiveStudentIds && effectiveStudentIds.length > 0) {
        q = q.in("student_id", effectiveStudentIds);
      } else if (effectiveStudentIds && effectiveStudentIds.length === 0) {
        return [] as PaymentRow[];
      }
      const { data, error } = await q;
      if (error) throw error;
      let rows = (data ?? []) as unknown as PaymentRow[];
      if (classId !== "all") {
        const cid = Number(classId);
        rows = rows.filter((r) => r.class_enrollments?.classes?.id === cid);
      }
      return rows;
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return paymentsQ.data ?? [];
    const s = search.toLowerCase();
    return (paymentsQ.data ?? []).filter(
      (r) =>
        r.students?.profiles?.full_name?.toLowerCase().includes(s) ||
        r.students?.profiles?.login_id?.toLowerCase().includes(s)
    );
  }, [paymentsQ.data, search]);

  const totals = useMemo(() => {
    const list = filtered;
    return {
      total: list.reduce((s, r) => s + r.total_amount, 0),
      paid: list.reduce((s, r) => s + r.paid_amount, 0),
      remaining: list.reduce((s, r) => s + Math.max(0, r.total_amount - r.paid_amount), 0),
      count: list.length,
    };
  }, [filtered]);

  const handleCompute = async () => {
    setComputing(true);
    try {
      const lo = fromMonth <= toMonth ? fromMonth : toMonth;
      const hi = fromMonth <= toMonth ? toMonth : fromMonth;
      const list = monthsBetween(lo, hi);
      let total = 0;
      for (const m of list) {
        const { data, error } = await supabase.rpc("compute_tuition_for_tenant_month", { _month: m });
        if (error) throw error;
        total += data ?? 0;
      }
      toast({
        title: "Đã tính học phí",
        description: `Cập nhật ${total} phiếu cho ${list.length} tháng (${formatMonthLabel(lo)} → ${formatMonthLabel(hi)})`,
      });
      qc.invalidateQueries({ queryKey: ["payments"] });
    } catch (err: any) {
      toast({ title: "Lỗi", description: err.message, variant: "destructive" });
    } finally {
      setComputing(false);
    }
  };

  const toggleStudent = (id: number) =>
    setStudentIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const toggleParent = (id: number) =>
    setParentIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <div>
      <PageHeader
        title="Học phí"
        description="Tính học phí theo khoảng tháng và ghi nhận thanh toán."
        actions={
          <Button onClick={handleCompute} disabled={computing}>
            <Calculator className="mr-2 h-4 w-4" />
            {computing ? "Đang tính..." : "Tính lại học phí"}
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="py-4">
          <div className="text-xs text-muted-foreground">Số phiếu</div>
          <div className="font-display text-2xl font-semibold">{totals.count}</div>
        </CardContent></Card>
        <Card><CardContent className="py-4">
          <div className="text-xs text-muted-foreground">Tổng học phí</div>
          <div className="font-display text-2xl font-semibold">{formatVND(totals.total)}</div>
        </CardContent></Card>
        <Card><CardContent className="py-4">
          <div className="text-xs text-muted-foreground">Đã thu</div>
          <div className="font-display text-2xl font-semibold text-emerald-600 dark:text-emerald-400">{formatVND(totals.paid)}</div>
        </CardContent></Card>
        <Card><CardContent className="py-4">
          <div className="text-xs text-muted-foreground">Còn lại</div>
          <div className="font-display text-2xl font-semibold text-destructive">{formatVND(totals.remaining)}</div>
        </CardContent></Card>
      </div>

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Từ tháng</Label>
            <Input
              type="month"
              value={toMonthInput(fromMonth)}
              onChange={(e) => e.target.value && setFromMonth(fromMonthInput(e.target.value))}
              className="w-[160px]"
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Đến tháng</Label>
            <Input
              type="month"
              value={toMonthInput(toMonth)}
              onChange={(e) => e.target.value && setToMonth(fromMonthInput(e.target.value))}
              className="w-[160px]"
            />
          </div>
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Lớp" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả lớp</SelectItem>
              {(classesQ.data ?? []).map((c: any) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả trạng thái</SelectItem>
              <SelectItem value="unpaid">Chưa thanh toán</SelectItem>
              <SelectItem value="partial">Thanh toán một phần</SelectItem>
              <SelectItem value="paid">Đã thanh toán</SelectItem>
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-start">
                Học sinh{studentIds.length ? ` (${studentIds.length})` : ""}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-2" align="start">
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-xs text-muted-foreground">Chọn học sinh</span>
                {studentIds.length > 0 && (
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setStudentIds([])}>
                    <X className="mr-1 h-3 w-3" /> Bỏ chọn
                  </Button>
                )}
              </div>
              <div className="max-h-64 overflow-auto pr-1">
                {(studentsQ.data ?? []).map((s: any) => {
                  const id = s.id as number;
                  const checked = studentIds.includes(id);
                  return (
                    <label key={id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-muted">
                      <Checkbox checked={checked} onCheckedChange={() => toggleStudent(id)} />
                      <span className="text-sm">{s.profiles?.full_name ?? "—"}</span>
                      <span className="ml-auto text-[11px] text-muted-foreground">@{s.profiles?.login_id}</span>
                    </label>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-start">
                Phụ huynh{parentIds.length ? ` (${parentIds.length})` : ""}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-2" align="start">
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-xs text-muted-foreground">Chọn phụ huynh</span>
                {parentIds.length > 0 && (
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setParentIds([])}>
                    <X className="mr-1 h-3 w-3" /> Bỏ chọn
                  </Button>
                )}
              </div>
              <div className="max-h-64 overflow-auto pr-1">
                {(parentsQ.data ?? []).map((p: any) => {
                  const id = p.id as number;
                  const checked = parentIds.includes(id);
                  return (
                    <label key={id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-muted">
                      <Checkbox checked={checked} onCheckedChange={() => toggleParent(id)} />
                      <span className="text-sm">{p.profiles?.full_name ?? "—"}</span>
                    </label>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>

          <div className="relative ml-auto w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên / mã HS"
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tháng</TableHead>
                <TableHead>Học sinh</TableHead>
                <TableHead>Lớp</TableHead>
                <TableHead className="text-center">Buổi đã học</TableHead>
                <TableHead className="text-right">Đơn giá</TableHead>
                <TableHead className="text-right">Tổng</TableHead>
                <TableHead className="text-right">Đã trả</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paymentsQ.isLoading ? (
                <TableRow><TableCell colSpan={9} className="py-10 text-center text-muted-foreground">Đang tải...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                  Chưa có phiếu nào. Bấm "Tính lại học phí" để tạo.
                </TableCell></TableRow>
              ) : (
                filtered.map((r) => {
                  const remaining = Math.max(0, r.total_amount - r.paid_amount);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-sm">{formatMonthLabel(r.month)}</TableCell>
                      <TableCell>
                        <div className="font-medium">{r.students?.profiles?.full_name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">@{r.students?.profiles?.login_id}</div>
                      </TableCell>
                      <TableCell>
                        <div>{r.class_enrollments?.classes?.name ?? "—"}</div>
                        {r.class_enrollments?.classes?.subject && (
                          <div className="text-xs text-muted-foreground">{r.class_enrollments.classes.subject}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-medium">{r.attended_count + r.late_count}</span>
                        <span className="text-muted-foreground"> / {r.session_count}</span>
                        {r.late_count > 0 && (
                          <div className="text-[11px] text-muted-foreground">muộn {r.late_count}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{formatVND(r.price_per_session)}</TableCell>
                      <TableCell className="text-right font-medium">{formatVND(r.total_amount)}</TableCell>
                      <TableCell className="text-right">
                        <div>{formatVND(r.paid_amount)}</div>
                        {remaining > 0 && r.paid_amount > 0 && (
                          <div className="text-xs text-destructive">Thiếu {formatVND(remaining)}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                        {r.paid_at && (
                          <div className="mt-1 text-[11px] text-muted-foreground">{formatDate(r.paid_at)}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => setEditing(r)}>
                          <Wallet className="mr-1 h-3.5 w-3.5" /> Thanh toán
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <PaymentDialog payment={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function PaymentDialog({ payment, onClose }: { payment: PaymentRow | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [paid, setPaid] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useMemo(() => {
    if (payment) {
      setPaid(String(payment.paid_amount ?? 0));
      setNote(payment.note ?? "");
    }
  }, [payment]);

  if (!payment) return null;

  const save = async (markFullPaid = false) => {
    setSaving(true);
    try {
      const paidAmount = markFullPaid ? payment.total_amount : Math.max(0, Math.floor(Number(paid) || 0));
      const newStatus: PaymentRow["status"] =
        payment.total_amount === 0 || paidAmount >= payment.total_amount
          ? "paid"
          : paidAmount > 0
          ? "partial"
          : "unpaid";
      const { error } = await supabase
        .from("payments")
        .update({
          paid_amount: paidAmount,
          status: newStatus,
          note: note || null,
          paid_at: newStatus === "paid" ? new Date().toISOString() : null,
        })
        .eq("id", payment.id);
      if (error) throw error;
      toast({ title: "Đã cập nhật thanh toán" });
      qc.invalidateQueries({ queryKey: ["payments"] });
      onClose();
    } catch (err: any) {
      toast({ title: "Lỗi", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remaining = Math.max(0, payment.total_amount - (Number(paid) || 0));

  return (
    <Dialog open={!!payment} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ghi nhận thanh toán</DialogTitle>
          <DialogDescription>
            {payment.students?.profiles?.full_name} — {payment.class_enrollments?.classes?.name} — {formatMonthLabel(payment.month)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
            <div><div className="text-xs text-muted-foreground">Buổi đã học</div><div className="font-medium">{payment.attended_count + payment.late_count} / {payment.session_count}</div></div>
            <div><div className="text-xs text-muted-foreground">Đơn giá</div><div className="font-medium">{formatVND(payment.price_per_session)}</div></div>
            <div><div className="text-xs text-muted-foreground">Tổng</div><div className="font-medium">{formatVND(payment.total_amount)}</div></div>
            <div><div className="text-xs text-muted-foreground">Còn lại</div><div className="font-medium text-destructive">{formatVND(remaining)}</div></div>
          </div>
          <div>
            <Label>Số tiền đã trả (VND)</Label>
            <Input
              type="number"
              min={0}
              value={paid}
              onChange={(e) => setPaid(e.target.value)}
            />
          </div>
          <div>
            <Label>Ghi chú</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Tuỳ chọn" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Huỷ</Button>
          <Button variant="secondary" onClick={() => save(true)} disabled={saving}>
            <CheckCircle2 className="mr-1 h-4 w-4" /> Đánh dấu đã thanh toán đủ
          </Button>
          <Button onClick={() => save(false)} disabled={saving}>Lưu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
