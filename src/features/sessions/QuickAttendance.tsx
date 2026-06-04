import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/features/auth/AuthProvider";
import { cn } from "@/lib/utils";

type Status = "attended" | "late" | "absent" | "absent_excused";

const STATUS_BUTTONS: { v: Status; label: string; cls: string }[] = [
  { v: "attended", label: "Có mặt", cls: "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600" },
  { v: "late", label: "Trễ", cls: "bg-amber-500 hover:bg-amber-600 text-white border-amber-500" },
  { v: "absent", label: "Vắng", cls: "bg-rose-600 hover:bg-rose-700 text-white border-rose-600" },
  { v: "absent_excused", label: "Có phép", cls: "bg-slate-500 hover:bg-slate-600 text-white border-slate-500" },
];

type Row = {
  student_id: number;
  full_name: string;
  login_id: string;
  status: Status | null;
};

export function QuickAttendance({
  sessionId,
  classId,
  sessionDate,
  onSaved,
}: {
  sessionId: number;
  classId: number;
  sessionDate: string; // YYYY-MM-DD
  onSaved?: () => void;
}) {
  const { profile } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);

  const q = useQuery({
    queryKey: ["quick-att", sessionId],
    queryFn: async () => {
      const { data: enrolls, error: enErr } = await supabase
        .from("class_enrollments")
        .select("student_id, end_date, students(id, profiles(full_name, login_id))")
        .eq("class_id", classId)
        .is("deleted_at", null);
      if (enErr) throw enErr;
      const filtered = (enrolls ?? []).filter((e: any) => !e.end_date || e.end_date >= sessionDate);

      const { data: atts, error: aErr } = await supabase
        .from("attendances")
        .select("student_id, status")
        .eq("session_id", sessionId);
      if (aErr) throw aErr;
      const m = new Map<number, Status>();
      (atts ?? []).forEach((a: any) => m.set(a.student_id, a.status));

      const result: Row[] = filtered
        .map((e: any) => ({
          student_id: e.student_id,
          full_name: e.students?.profiles?.full_name ?? "—",
          login_id: e.students?.profiles?.login_id ?? "",
          status: m.get(e.student_id) ?? null,
        }))
        .sort((a, b) => a.full_name.localeCompare(b.full_name, "vi"));
      return result;
    },
  });

  useEffect(() => {
    if (q.data) setRows(q.data);
  }, [q.data]);

  const setStatus = (sid: number, status: Status) =>
    setRows((cur) => cur.map((r) => (r.student_id === sid ? { ...r, status } : r)));
  const markAll = (status: Status) =>
    setRows((cur) => cur.map((r) => ({ ...r, status })));

  const save = async () => {
    if (!profile) return;
    const toUpsert = rows
      .filter((r) => r.status)
      .map((r) => ({
        tenant_id: profile.tenant_id,
        session_id: sessionId,
        student_id: r.student_id,
        status: r.status as Status,
        recorded_by: profile.id,
      }));
    if (toUpsert.length === 0) {
      toast({ title: "Chưa có ai được đánh dấu", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("attendances")
      .upsert(toUpsert, { onConflict: "session_id,student_id" });
    if (error) {
      setSaving(false);
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
      return;
    }
    await supabase
      .from("class_sessions")
      .update({ attendance_taken_at: new Date().toISOString(), status: "completed" })
      .eq("id", sessionId);
    setSaving(false);
    toast({ title: "Đã lưu điểm danh" });
    onSaved?.();
  };

  if (q.isLoading) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Đang tải học sinh…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="px-4 py-3 text-sm text-muted-foreground">
        Lớp này chưa có học sinh.
      </div>
    );
  }

  return (
    <div className="space-y-2 border-t border-border/60 bg-muted/20 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-medium text-muted-foreground">
          Điểm danh nhanh — {rows.length} học sinh
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => markAll("attended")}>
            Tất cả có mặt
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            <Save className="mr-1 h-3.5 w-3.5" /> {saving ? "Đang lưu…" : "Lưu"}
          </Button>
        </div>
      </div>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div
            key={r.student_id}
            className="flex flex-wrap items-center gap-2 rounded-lg bg-background px-3 py-2"
          >
            <div className="min-w-[160px] flex-1">
              <div className="text-sm font-medium">{r.full_name}</div>
              <div className="text-[11px] text-muted-foreground">@{r.login_id}</div>
            </div>
            <div className="flex flex-wrap gap-1">
              {STATUS_BUTTONS.map((b) => {
                const active = r.status === b.v;
                return (
                  <button
                    key={b.v}
                    type="button"
                    onClick={() => setStatus(r.student_id, b.v)}
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                      active ? b.cls : "border-border bg-background hover:bg-muted",
                    )}
                  >
                    {b.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}