import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
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

  const enQ = useQuery({
    queryKey: ["enrollments", classId],
    enabled: !!classId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_enrollments")
        .select("id, student_id, start_date, end_date, price_per_session, students(profiles(full_name, login_id))")
        .eq("class_id", classId!)
        .is("deleted_at", null)
        .order("id", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as any[]).map<Enrollment>((r) => ({
        id: r.id,
        student_id: r.student_id,
        start_date: r.start_date,
        end_date: r.end_date,
        price_per_session: r.price_per_session,
        full_name: r.students?.profiles?.full_name ?? "—",
        login_id: r.students?.profiles?.login_id ?? "",
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

  const enrolled = useMemo(() => new Set((enQ.data ?? []).map((e) => e.student_id)), [enQ.data]);
  const available = useMemo(
    () => (studentsQ.data ?? []).filter((s) => !enrolled.has(s.id)),
    [studentsQ.data, enrolled],
  );

  const [studentId, setStudentId] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [price, setPrice] = useState<string>("100000");

  useEffect(() => {
    if (!open) return;
    setStudentId("");
    setStartDate(new Date().toISOString().slice(0, 10));
    setPrice("100000");
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
  };

  const remove = async (id: number) => {
    const { error } = await supabase
      .from("class_enrollments")
      .update({ deleted_at: new Date().toISOString(), end_date: new Date().toISOString().slice(0, 10) })
      .eq("id", id);
    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Đã gỡ khỏi lớp" });
    qc.invalidateQueries({ queryKey: ["enrollments", classId] });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Học sinh — {className}</DialogTitle>
          <DialogDescription>Thêm/gỡ học sinh và đặt học phí mỗi buổi.</DialogDescription>
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

        <div className="mt-2 max-h-[50vh] overflow-y-auto">
          {enQ.isLoading && <p className="text-center text-sm text-muted-foreground">Đang tải…</p>}
          {!enQ.isLoading && (enQ.data ?? []).length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Chưa có học sinh trong lớp.</p>
          )}
          <div className="divide-y divide-border">
            {(enQ.data ?? []).map((e) => (
              <div key={e.id} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{e.full_name}</div>
                  <div className="text-xs text-muted-foreground">
                    @{e.login_id} • Từ {formatDate(e.start_date)} • {formatVND(e.price_per_session)}/buổi
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => remove(e.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}