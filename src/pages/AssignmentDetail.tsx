import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/features/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/features/auth/AuthProvider";
import { FileList } from "@/components/FileList";
import type { StoredFile } from "@/lib/storage";

type Assignment = {
  id: number;
  class_id: number;
  title: string;
  description: string | null;
  max_score: number;
  deadline: string | null;
  attachments: StoredFile[] | null;
  classes?: { name: string } | null;
};

type SubRow = {
  student_id: number;
  full_name: string;
  login_id: string;
  submissionId?: number;
  status: "draft" | "submitted" | "graded" | "returned" | null;
  submitted_at?: string | null;
  content: string | null;
  score: string;
  feedback: string;
  dirty: boolean;
};

const STATUS_LABEL: Record<NonNullable<SubRow["status"]>, string> = {
  draft: "Nháp",
  submitted: "Đã nộp",
  graded: "Đã chấm",
  returned: "Trả bài",
};

export default function AssignmentDetailPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const aid = Number(assignmentId);
  const nav = useNavigate();
  const qc = useQueryClient();
  const { profile } = useAuth();
  const [rows, setRows] = useState<SubRow[]>([]);

  const aQ = useQuery({
    queryKey: ["assignment", aid],
    enabled: !!aid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignments")
        .select("id, class_id, title, description, max_score, deadline, attachments, classes(name)")
        .eq("id", aid)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        ...(data as any),
        attachments: Array.isArray((data as any).attachments)
          ? ((data as any).attachments as StoredFile[])
          : [],
      } as Assignment;
    },
  });

  const dataQ = useQuery({
    queryKey: ["assignment-subs", aid],
    enabled: !!aQ.data,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const classId = aQ.data!.class_id;
      const { data: enrolls, error: enErr } = await supabase
        .from("class_enrollments")
        .select("student_id, end_date, students(profiles(full_name, login_id))")
        .eq("class_id", classId)
        .is("deleted_at", null);
      if (enErr) throw enErr;
      const active = (enrolls ?? []).filter((e: any) => !e.end_date || e.end_date >= today);

      const { data: subs, error: sErr } = await supabase
        .from("submissions")
        .select("id, student_id, status, content, score, feedback, submitted_at")
        .eq("assignment_id", aid);
      if (sErr) throw sErr;
      const subMap = new Map<number, any>();
      (subs ?? []).forEach((s) => subMap.set(s.student_id, s));

      return active
        .map((e: any) => {
          const s = subMap.get(e.student_id);
          return {
            student_id: e.student_id,
            full_name: e.students?.profiles?.full_name ?? "—",
            login_id: e.students?.profiles?.login_id ?? "",
            submissionId: s?.id,
            status: s?.status ?? null,
            submitted_at: s?.submitted_at ?? null,
            content: s?.content ?? null,
            score: s?.score != null ? String(s.score) : "",
            feedback: s?.feedback ?? "",
            dirty: false,
          } as SubRow;
        })
        .sort((a, b) => a.full_name.localeCompare(b.full_name, "vi"));
    },
  });

  useEffect(() => {
    if (dataQ.data) setRows(dataQ.data);
  }, [dataQ.data]);

  const stats = useMemo(() => {
    const c = { total: rows.length, submitted: 0, graded: 0 };
    rows.forEach((r) => {
      if (r.status === "submitted" || r.status === "graded" || r.status === "returned") c.submitted++;
      if (r.status === "graded" || r.status === "returned") c.graded++;
    });
    return c;
  }, [rows]);

  const update = (sid: number, patch: Partial<SubRow>) =>
    setRows((cur) => cur.map((r) => (r.student_id === sid ? { ...r, ...patch, dirty: true } : r)));

  const grade = async (r: SubRow) => {
    if (!profile || !aQ.data) return;
    const scoreN = r.score === "" ? null : Number(r.score);
    if (scoreN != null && (Number.isNaN(scoreN) || scoreN < 0 || scoreN > aQ.data.max_score)) {
      toast({ title: "Điểm không hợp lệ", description: `Trong khoảng 0–${aQ.data.max_score}`, variant: "destructive" });
      return;
    }
    const payload = {
      assignment_id: aid,
      student_id: r.student_id,
      tenant_id: profile.tenant_id,
      status: (scoreN != null ? "graded" : "submitted") as SubRow["status"],
      content: r.content,
      score: scoreN,
      feedback: r.feedback?.trim() || null,
      graded_by: scoreN != null ? profile.id : null,
      graded_at: scoreN != null ? new Date().toISOString() : null,
    };
    let error;
    if (r.submissionId) {
      ({ error } = await supabase.from("submissions").update(payload).eq("id", r.submissionId));
    } else {
      ({ error } = await supabase.from("submissions").insert(payload));
    }
    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Đã lưu" });
    qc.invalidateQueries({ queryKey: ["assignment-subs", aid] });
  };

  if (!aid || Number.isNaN(aid)) return <p className="text-muted-foreground">Bài không hợp lệ.</p>;

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => nav(-1)} className="mb-2">
        <ArrowLeft className="mr-1 h-4 w-4" /> Quay lại
      </Button>
      <PageHeader
        title={aQ.data?.title ?? "Đang tải…"}
        description={
          aQ.data ? (
            <span>
              Lớp: <Link to="/classes" className="underline">{aQ.data.classes?.name}</Link>
              {aQ.data.deadline && ` • Hạn: ${formatDateTime(aQ.data.deadline)}`}
              {` • Tối đa: ${aQ.data.max_score} điểm`}
            </span>
          ) : ""
        }
      />

      {aQ.data?.description && (
        <Card className="mb-4 border-border/80">
          <CardContent className="whitespace-pre-wrap py-4 text-sm">
            {aQ.data.description}
          </CardContent>
        </Card>
      )}

      {aQ.data?.attachments && aQ.data.attachments.length > 0 && (
        <Card className="mb-4 border-border/80">
          <CardContent className="space-y-2 py-3">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              File giáo viên gửi
            </div>
            <FileList bucket="assignment-attachments" files={aQ.data.attachments} />
          </CardContent>
        </Card>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <Badge variant="secondary">Học sinh: {stats.total}</Badge>
        <Badge variant="secondary">Đã nộp: {stats.submitted}</Badge>
        <Badge variant="secondary">Đã chấm: {stats.graded}</Badge>
      </div>

      {dataQ.isLoading && <p className="text-center text-muted-foreground">Đang tải…</p>}
      {!dataQ.isLoading && rows.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Lớp chưa có học sinh nào đăng ký.
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {rows.map((r) => (
          <Card key={r.student_id} className="border-border/80">
            <CardContent className="space-y-3 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{r.full_name}</div>
                  <div className="text-xs text-muted-foreground">@{r.login_id}</div>
                </div>
                {r.status && <Badge variant={r.status === "graded" ? "default" : "secondary"}>{STATUS_LABEL[r.status]}</Badge>}
                {r.submitted_at && (
                  <span className="text-xs text-muted-foreground">Nộp: {formatDateTime(r.submitted_at)}</span>
                )}
              </div>
              {r.content && (
                <div className="rounded-md border border-border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                  {r.content}
                </div>
              )}
              <div className="grid grid-cols-1 gap-2 md:grid-cols-[120px_1fr_auto]">
                <Input
                  type="number"
                  step={0.1}
                  min={0}
                  max={aQ.data?.max_score}
                  value={r.score}
                  onChange={(e) => update(r.student_id, { score: e.target.value })}
                  placeholder={`/ ${aQ.data?.max_score ?? 10}`}
                />
                <Textarea
                  rows={1}
                  value={r.feedback}
                  onChange={(e) => update(r.student_id, { feedback: e.target.value })}
                  placeholder="Nhận xét"
                />
                <Button onClick={() => grade(r)} size="sm">
                  {r.score ? <Check className="mr-1 h-4 w-4" /> : <Save className="mr-1 h-4 w-4" />}
                  {r.score ? "Chấm" : "Lưu"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}