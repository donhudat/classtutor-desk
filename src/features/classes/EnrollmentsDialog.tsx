import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/features/auth/AuthProvider";
import { formatVND, formatDate } from "@/lib/format";

type Enrollment = {
  id: number;
  student_id: number;
  start_date: string;
  end_date: string | null;
  price_per_session: number;
  full_name: string;
  login_id: string;
  parent_name: string | null;
  parent_phone: string | null;
  attended_count: number;
};

export function EnrollmentsDialog({
  open,
  onOpenChange,
  classId,
  className,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  classId: number | null;
  className: string;
}) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editEnd, setEditEnd] = useState("");

  const enQ = useQuery({
    queryKey: ["enrollments", classId],
    enabled: !!classId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_enrollments")
        .select(
          `id, student_id, start_date, end_date, price_per_session,
           students(
             profiles(full_name, login_id),
             parents(phone, profiles(full_name))
           )`,
        )
        .eq("class_id", classId!)
        .is("deleted_at", null)
        .order("id", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as any[];

      // Đếm buổi đã có mặt / muộn cho mỗi học sinh trong lớp
      const studentIds = rows.map((r) => r.student_id);
      const attMap = new Map<number, number>();
      if (studentIds.length) {
        const { data: atts } = await supabase
          .from("attendances")
          .select("student_id, status, class_sessions!inner(class_id)")
          .in("student_id", studentIds)
          .eq("class_sessions.class_id", classId!)
          .in("status", ["attended", "late"]);
        (atts ?? []).forEach((a: any) => {
          attMap.set(a.student_id, (attMap.get(a.student_id) ?? 0) + 1);
        });
      }

      return rows.map<Enrollment>((r) => ({
        id: r.id,
        student_id: r.student_id,
        start_date: r.start_date,
        end_date: r.end_date,
        price_per_session: r.price_per_session,
        full_name: r.students?.profiles?.full_name ?? "—",
        login_id: r.students?.profiles?.login_id ?? "",
        parent_name: r.students?.parents?.profiles?.full_name ?? null,
        parent_phone: r.students?.parents?.phone ?? null,
        attended_count: attMap.get(r.student_id) ?? 0,
      }));
    },
  });

  const studentsQ = useQuery({
    queryKey: ["students-min"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, profiles(full_name, login_id)")
        .is("deleted_at", null);
      if (error) throw error;
      return ((data ?? []) as any[]).map((s) => ({
        id: s.id as number,
        full_name: s.profiles?.full_name ?? "—",
        login_id: s.profiles?.login_id ?? "",
      }));
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const activeEnrolled = useMemo(
    () =>
      new Set(
        (enQ.data ?? [])
          .filter((e) => !e.end_date || e.end_date >= today)
          .map((e) => e.student_id),
      ),
    [enQ.data, today],
  );
  const available = useMemo(
    () => (studentsQ.data ?? []).filter((s) => !activeEnrolled.has(s.id)),
    [studentsQ.data, activeEnrolled],
  );

  const [studentId, setStudentId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [price, setPrice] = useState("100000");

  useEffect(() => {
    if (!open) return;
    setStudentId("");
    setStartDate(new Date().toISOString().slice(0, 10));
    setPrice("100000");
    setEditingId(null);
  }, [open]);

  const add = async () => {
    if (!classId || !profile) return;
    if (!studentId) {
      toast({ title: "Chọn học sinh", variant: "destructive" });
      return;
    }
    const priceN = Number(price);
    if (!Number.isFinite(priceN) || priceN < 0) {
      toast({ title: "Học phí không hợp lệ", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("class_enrollments").insert({
      tenant_id: profile.tenant_id,
      class_id: classId,
      student_id: Number(studentId),
      start_date: startDate,
      price_per_session: priceN,
    });
    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Đã thêm học sinh vào lớp" });
    setStudentId("");
    qc.invalidateQueries({ queryKey: ["enrollments", classId] });
    qc.invalidateQueries({ queryKey: ["classes"] });
  };

  const startEdit = (e: Enrollment) => {
    setEditingId(e.id);
    setEditPrice(String(e.price_per_session));
    setEditEnd(e.end_date ?? "");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const priceN = Number(editPrice);
    if (!Number.isFinite(priceN) || priceN < 0) {
      toast({ title: "Học phí không hợp lệ", variant: "destructive" });
      return;
    }
    const { error } = await supabase
      .from("class_enrollments")
      .update({
        price_per_session: priceN,
        end_date: editEnd || null,
      })
      .eq("id", editingId);
    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Đã lưu" });
    setEditingId(null);
    qc.invalidateQueries({ queryKey: ["enrollments", classId] });
    qc.invalidateQueries({ queryKey: ["classes"] });
  };

  const remove = async (id: number) => {
    const { error } = await supabase
      .from("class_enrollments")
      .update({
        deleted_at: new Date().toISOString(),
        end_date: new Date().toISOString().slice(0, 10),
      })
      .eq("id", id);
    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Đã gỡ khỏi lớp" });
    qc.invalidateQueries({ queryKey: ["enrollments", classId] });
    qc.invalidateQueries({ queryKey: ["classes"] });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Học sinh — {className}</DialogTitle>
          <DialogDescription>
            Thêm học sinh, gắn phụ huynh, đặt học phí mỗi buổi và theo dõi số buổi đã học.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-border bg-card/40 p-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_140px_140px_auto]">
            <div>
              <Label>Học sinh</Label>
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger>
                  <SelectValue placeholder={available.length ? "Chọn học sinh" : "Hết học sinh để thêm"} />
                </SelectTrigger>
                <SelectContent>
                  {available.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.full_name} (@{s.login_id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Bắt đầu</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label>Giá / buổi (VND)</Label>
              <Input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button onClick={add} disabled={!available.length}>
                <Plus className="mr-1 h-4 w-4" /> Thêm
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-2 max-h-[55vh] overflow-y-auto">
          {enQ.isLoading && <p className="text-center text-sm text-muted-foreground">Đang tải…</p>}
          {!enQ.isLoading && (enQ.data ?? []).length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Chưa có học sinh trong lớp.</p>
          )}
          <div className="divide-y divide-border">
            {(enQ.data ?? []).map((e) => {
              const isEditing = editingId === e.id;
              const inactive = e.end_date && e.end_date < today;
              return (
                <div key={e.id} className="space-y-2 py-3">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{e.full_name}</span>
                        <span className="text-xs text-muted-foreground">@{e.login_id}</span>
                        {inactive && <Badge variant="outline">Đã rời lớp</Badge>}
                        <Badge variant="secondary" className="text-xs">
                          {e.attended_count} buổi đã học
                        </Badge>
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {e.parent_name ? (
                          <>
                            Phụ huynh: <span className="text-foreground">{e.parent_name}</span>
                            {e.parent_phone && ` • ${e.parent_phone}`}
                          </>
                        ) : (
                          <span className="italic">Chưa gắn phụ huynh</span>
                        )}
                      </div>
                      {!isEditing && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Từ {formatDate(e.start_date)}
                          {e.end_date && ` → ${formatDate(e.end_date)}`}
                          {" • "}
                          <span className="font-medium text-foreground">
                            {formatVND(e.price_per_session)}/buổi
                          </span>
                        </div>
                      )}
                    </div>
                    {!isEditing ? (
                      <div className="flex shrink-0 gap-1">
                        <Button variant="ghost" size="sm" className="h-8" onClick={() => startEdit(e)}>
                          Sửa
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => remove(e.id)}
                          title="Gỡ khỏi lớp"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex shrink-0 gap-1">
                        <Button size="sm" className="h-8" onClick={saveEdit}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditingId(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  {isEditing && (
                    <div className="grid grid-cols-2 gap-2 rounded-md border border-border bg-muted/30 p-2">
                      <div>
                        <Label className="text-xs">Giá / buổi (VND)</Label>
                        <Input
                          type="number"
                          min={0}
                          value={editPrice}
                          onChange={(ev) => setEditPrice(ev.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Ngày kết thúc (để trống = đang học)</Label>
                        <Input
                          type="date"
                          value={editEnd}
                          onChange={(ev) => setEditEnd(ev.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
