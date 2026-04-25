import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/features/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/features/auth/AuthProvider";

type Status = "attended" | "late" | "absent" | "absent_excused";

const STATUS_BUTTONS: { v: Status; label: string; cls: string }[] = [
  { v: "attended", label: "Có mặt", cls: "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600" },
  { v: "late", label: "Trễ", cls: "bg-amber-500 hover:bg-amber-600 text-white border-amber-500" },
  { v: "absent", label: "Vắng", cls: "bg-rose-600 hover:bg-rose-700 text-white border-rose-600" },
  { v: "absent_excused", label: "Vắng có phép", cls: "bg-slate-500 hover:bg-slate-600 text-white border-slate-500" },
];

type Row = {
  student_id: number;
  full_name: string;
  login_id: string;
  status: Status | null;
  note: string;
  attendanceId?: number;
};

export default function AttendancePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const sid = Number(sessionId);
  const nav = useNavigate();
  const qc = useQueryClient();
  const { profile } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);

  const sessionQ = useQuery({
    queryKey: ["session", sid],
    enabled: !!sid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_sessions")
        .select("id, class_id, starts_at, ends_at, status, attendance_taken_at, classes(name)")
        .eq("id", sid)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const dataQ = useQuery({
    queryKey: ["attendance-data", sid],
    enabled: !!sessionQ.data,
    queryFn: async () => {
      const classId = sessionQ.data!.class_id as number;
      const sessionDate = (sessionQ.data!.starts_at as string).slice(0, 10);

      // Active enrollments cho lớp
      const { data: enrolls, error: enErr } = await supabase
        .from("class_enrollments")
        .select("student_id, start_date, end_date, students(id, user_id, profiles(full_name, login_id))")
        .eq("class_id", classId)
        .is("deleted_at", null)
        .lte("start_date", sessionDate);
      if (enErr) throw enErr;

      const filtered = (enrolls ?? []).filter(
        (e) => !e.end_date || e.end_date >= sessionDate,
      );

      const { data: atts, error: aErr } = await supabase
        .from("attendances")
        .select("id, student_id, status, note")
        .eq("session_id", sid);
      if (aErr) throw aErr;

      const attMap = new Map<number, { id: number; status: Status; note: string | null }>();
      (atts ?? []).forEach((a) => attMap.set(a.student_id, a as any));

      const result: Row[] = filtered
        .map((e: any) => {
          const prof = e.students?.profiles;
          const att = attMap.get(e.student_id);
          return {
            student_id: e.student_id,
            full_name: prof?.full_name ?? "—",
            login_id: prof?.login_id ?? "",
            status: att?.status ?? null,
            note: att?.note ?? "",
            attendanceId: att?.id,
          };
        })
        .sort((a, b) => a.full_name.localeCompare(b.full_name, "vi"));
      return result;
    },
  });

  useEffect(() => {
    if (dataQ.data) setRows(dataQ.data);
  }, [dataQ.data]);

  const setStatus = (sid: number, status: Status) =>
    setRows((cur) => cur.map((r) => (r.student_id === sid ? { ...r, status } : r)));
  const setNote = (sid: number, note: string) =>
    setRows((cur) => cur.map((r) => (r.student_id === sid ? { ...r, note } : r)));
  const markAll = (status: Status) =>
    setRows((cur) => cur.map((r) => ({ ...r, status })));

  const counts = useMemo(() => {
    const c = { attended: 0, late: 0, absent: 0, absent_excused: 0, pending: 0 };
    rows.forEach((r) => {
      if (!r.status) c.pending++;
      else c[r.status]++;
    });
    return c;
  }, [rows]);

  const save = async () => {
    if (!profile || !sessionQ.data) return;
    const toUpsert = rows
      .filter((r) => r.status)
      .map((r) => ({
        tenant_id: profile.tenant_id,
        session_id: sid,
        student_id: r.student_id,
        status: r.status as Status,
        note: r.note?.trim() || null,
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
    // mark session
    await supabase
      .from("class_sessions")
      .update({ attendance_taken_at: new Date().toISOString(), status: "completed" })
      .eq("id", sid);
    setSaving(false);
    toast({ title: "Đã lưu điểm danh" });
    qc.invalidateQueries({ queryKey: ["attendance-data", sid] });
    qc.invalidateQueries({ queryKey: ["session", sid] });
    qc.invalidateQueries({ queryKey: ["sessions"] });
  };

  if (!sid || Number.isNaN(sid)) {
    return <p className="text-muted-foreground">Buổi không hợp lệ.</p>;
  }

  const className = (sessionQ.data as any)?.classes?.name ?? "Lớp";

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => nav(-1)} className="mb-2">
        <ArrowLeft className="mr-1 h-4 w-4" /> Quay lại
      </Button>
      <PageHeader
        title={`Điểm danh — ${className}`}
        description={
          sessionQ.data ? formatDateTime((sessionQ.data as any).starts_at) : "Đang tải…"
        }
        actions={
          <Button onClick={save} disabled={saving || rows.length === 0}>
            <Save className="mr-2 h-4 w-4" /> {saving ? "Đang lưu…" : "Lưu điểm danh"}
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Badge variant="secondary">Có mặt: {counts.attended}</Badge>
        <Badge variant="secondary">Trễ: {counts.late}</Badge>
        <Badge variant="secondary">Vắng: {counts.absent}</Badge>
        <Badge variant="secondary">Vắng có phép: {counts.absent_excused}</Badge>
        <Badge variant="outline">Chưa đánh dấu: {counts.pending}</Badge>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={() => markAll("attended")}>
            Tất cả có mặt
          </Button>
          <Button size="sm" variant="outline" onClick={() => markAll("absent")}>
            Tất cả vắng
          </Button>
        </div>
      </div>

      {dataQ.isLoading && <p className="text-center text-muted-foreground">Đang tải…</p>}

      {!dataQ.isLoading && rows.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <p className="font-display text-xl">Chưa có học sinh trong lớp</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              Thêm học sinh vào lớp ở trang{" "}
              <Link to="/classes" className="underline">
                Lớp học
              </Link>{" "}
              trước khi điểm danh.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {rows.map((r) => (
          <Card key={r.student_id} className="border-border/80">
            <CardContent className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-[180px] flex-1">
                <div className="font-medium">{r.full_name}</div>
                <div className="text-xs text-muted-foreground">@{r.login_id}</div>
              </div>
              <div className="flex flex-wrap gap-1">
                {STATUS_BUTTONS.map((b) => {
                  const active = r.status === b.v;
                  return (
                    <button
                      key={b.v}
                      type="button"
                      onClick={() => setStatus(r.student_id, b.v)}
                      className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                        active ? b.cls : "border-border bg-background hover:bg-muted"
                      }`}
                    >
                      {b.label}
                    </button>
                  );
                })}
              </div>
              <Textarea
                value={r.note}
                onChange={(e) => setNote(r.student_id, e.target.value)}
                placeholder="Ghi chú (tuỳ chọn)"
                rows={1}
                className="w-full md:w-[220px]"
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}