import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Save, Check, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/features/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateTime } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/features/auth/AuthProvider";
import { FileList } from "@/components/FileList";
import type { StoredFile } from "@/lib/storage";

type AssignmentLite = {
  id: number;
  title: string;
  class_id: number;
  max_score: number;
  deadline: string | null;
  classes: { name: string; subject: string | null; grade_level: number | null } | null;
};

type SubmissionRow = {
  id: number;
  student_id: number;
  assignment_id: number;
  status: "draft" | "submitted" | "graded" | "returned";
  content: string | null;
  score: number | null;
  feedback: string | null;
  submitted_at: string;
  students: { profiles: { full_name: string; login_id: string } | null } | null;
  submission_files: {
    id: number;
    file_name: string;
    file_size: number;
    mime_type: string;
    storage_path: string;
  }[];
};

const STATUS_LABEL: Record<SubmissionRow["status"], string> = {
  draft: "Nháp",
  submitted: "Đã nộp",
  graded: "Đã chấm",
  returned: "Trả bài",
};

const STATUS_VARIANT: Record<SubmissionRow["status"], "default" | "secondary" | "outline"> = {
  draft: "outline",
  submitted: "secondary",
  graded: "default",
  returned: "default",
};

export default function SubmissionsPage() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const [classFilter, setClassFilter] = useState("all");
  const [assignmentFilter, setAssignmentFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [drafts, setDrafts] = useState<Record<number, { score: string; feedback: string }>>({});

  const classesQ = useQuery({
    queryKey: ["classes-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("id, name")
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return (data ?? []) as { id: number; name: string }[];
    },
  });

  const assignmentsQ = useQuery({
    queryKey: ["assignments-with-class", classFilter],
    queryFn: async () => {
      let q = supabase
        .from("assignments")
        .select("id, title, class_id, max_score, deadline, classes(name, subject, grade_level)")
        .is("deleted_at", null)
        .order("id", { ascending: false });
      if (classFilter !== "all") q = q.eq("class_id", Number(classFilter));
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as AssignmentLite[];
    },
  });

  const subsQ = useQuery({
    queryKey: ["all-submissions", classFilter, assignmentFilter, statusFilter],
    enabled: !!assignmentsQ.data,
    queryFn: async () => {
      const aIds = (assignmentsQ.data ?? []).map((a) => a.id);
      if (aIds.length === 0) return [] as SubmissionRow[];
      let q = supabase
        .from("submissions")
        .select(
          `id, student_id, assignment_id, status, content, score, feedback, submitted_at,
           students(profiles:profiles!students_user_id_fkey(full_name, login_id)),
           submission_files(id, file_name, file_size, mime_type, storage_path)`,
        )
        .in("assignment_id", aIds)
        .order("submitted_at", { ascending: false });
      if (assignmentFilter !== "all") q = q.eq("assignment_id", Number(assignmentFilter));
      if (statusFilter !== "all") q = q.eq("status", statusFilter as SubmissionRow["status"]);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as SubmissionRow[];
    },
  });

  const aMap = useMemo(() => {
    const m = new Map<number, AssignmentLite>();
    (assignmentsQ.data ?? []).forEach((a) => m.set(a.id, a));
    return m;
  }, [assignmentsQ.data]);

  const filtered = useMemo(() => {
    const list = subsQ.data ?? [];
    if (!q.trim()) return list;
    const k = q.toLowerCase();
    return list.filter(
      (s) =>
        s.students?.profiles?.full_name?.toLowerCase().includes(k) ||
        s.students?.profiles?.login_id?.toLowerCase().includes(k) ||
        aMap.get(s.assignment_id)?.title.toLowerCase().includes(k),
    );
  }, [subsQ.data, q, aMap]);

  const draftFor = (s: SubmissionRow) =>
    drafts[s.id] ?? {
      score: s.score != null ? String(s.score) : "",
      feedback: s.feedback ?? "",
    };

  const setDraft = (id: number, patch: Partial<{ score: string; feedback: string }>) =>
    setDrafts((cur) => ({ ...cur, [id]: { ...draftFor({ id, score: null, feedback: null } as any), ...cur[id], ...patch } }));

  const grade = async (s: SubmissionRow) => {
    if (!profile) return;
    const a = aMap.get(s.assignment_id);
    const draft = draftFor(s);
    const scoreN = draft.score === "" ? null : Number(draft.score);
    if (scoreN != null && a && (Number.isNaN(scoreN) || scoreN < 0 || scoreN > a.max_score)) {
      toast({
        title: "Điểm không hợp lệ",
        description: `Trong khoảng 0–${a.max_score}`,
        variant: "destructive",
      });
      return;
    }
    const { error } = await supabase
      .from("submissions")
      .update({
        score: scoreN,
        feedback: draft.feedback?.trim() || null,
        status: scoreN != null ? "graded" : s.status,
        graded_by: scoreN != null ? profile.id : null,
        graded_at: scoreN != null ? new Date().toISOString() : null,
      })
      .eq("id", s.id);
    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Đã lưu chấm" });
    setDrafts((cur) => {
      const c = { ...cur };
      delete c[s.id];
      return c;
    });
    qc.invalidateQueries({ queryKey: ["all-submissions"] });
  };

  const classes = classesQ.data ?? [];
  const assignments = assignmentsQ.data ?? [];

  const stats = useMemo(() => {
    const list = subsQ.data ?? [];
    return {
      total: list.length,
      submitted: list.filter((s) => s.status === "submitted").length,
      graded: list.filter((s) => s.status === "graded" || s.status === "returned").length,
    };
  }, [subsQ.data]);

  return (
    <div>
      <PageHeader
        title="Quản lý nộp bài"
        description="Xem, tải file học sinh nộp và chấm điểm tập trung."
      />

      <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-4">
        <Select value={classFilter} onValueChange={(v) => { setClassFilter(v); setAssignmentFilter("all"); }}>
          <SelectTrigger><SelectValue placeholder="Lớp" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả lớp</SelectItem>
            {classes.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={assignmentFilter} onValueChange={setAssignmentFilter}>
          <SelectTrigger><SelectValue placeholder="Bài tập" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả bài tập</SelectItem>
            {assignments.map((a) => (
              <SelectItem key={a.id} value={String(a.id)}>
                {a.title} — {a.classes?.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger><SelectValue placeholder="Trạng thái" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả trạng thái</SelectItem>
            <SelectItem value="submitted">Đã nộp — chưa chấm</SelectItem>
            <SelectItem value="graded">Đã chấm</SelectItem>
            <SelectItem value="returned">Trả bài</SelectItem>
            <SelectItem value="draft">Nháp</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 rounded-md border border-input px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm tên / login / bài…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-9 border-0 px-0 shadow-none focus-visible:ring-0"
          />
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <Badge variant="secondary">Tổng: {stats.total}</Badge>
        <Badge variant="secondary">Chờ chấm: {stats.submitted}</Badge>
        <Badge variant="secondary">Đã chấm: {stats.graded}</Badge>
      </div>

      {subsQ.isLoading && (
        <p className="py-8 text-center text-muted-foreground">Đang tải…</p>
      )}

      {!subsQ.isLoading && filtered.length === 0 && (
        <Card className="border-dashed border-border/80 bg-card/40">
          <CardContent className="py-12 text-center">
            <FileText className="mx-auto mb-2 h-10 w-10 text-muted-foreground" />
            <p className="font-display text-lg">Chưa có bài nộp</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Khi học sinh nộp bài, danh sách sẽ xuất hiện ở đây kèm file đính kèm.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {filtered.map((s) => {
          const a = aMap.get(s.assignment_id);
          const draft = draftFor(s);
          const lateClass = a?.deadline && new Date(s.submitted_at) > new Date(a.deadline);
          const files: StoredFile[] = (s.submission_files ?? []).map((f) => ({
            path: f.storage_path,
            name: f.file_name,
            size: f.file_size,
            mime: f.mime_type,
          }));
          return (
            <Card key={s.id} className="border-border/80">
              <CardContent className="space-y-3 py-3">
                <div className="flex flex-wrap items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{s.students?.profiles?.full_name ?? "—"}</span>
                      <span className="text-xs text-muted-foreground">
                        @{s.students?.profiles?.login_id}
                      </span>
                      <Badge variant={STATUS_VARIANT[s.status]}>{STATUS_LABEL[s.status]}</Badge>
                      {lateClass && <Badge variant="destructive">Nộp muộn</Badge>}
                    </div>
                    <div className="mt-0.5 text-sm">
                      <span className="font-display">{a?.title ?? `Bài #${s.assignment_id}`}</span>
                      {a?.classes && (
                        <span className="text-muted-foreground">
                          {" "}— {a.classes.name}
                          {a.classes.subject && ` · ${a.classes.subject}`}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Nộp: {formatDateTime(s.submitted_at)}
                      {a?.deadline && ` • Hạn: ${formatDateTime(a.deadline)}`}
                    </div>
                  </div>
                </div>

                {s.content && (
                  <div className="rounded-md border border-border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                    {s.content}
                  </div>
                )}

                <div>
                  <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    File học sinh nộp
                  </div>
                  <FileList
                    bucket="submission-files"
                    files={files}
                    emptyText="Học sinh chưa đính kèm file."
                  />
                </div>

                <div className="grid grid-cols-1 gap-2 md:grid-cols-[120px_1fr_auto]">
                  <Input
                    type="number"
                    step={0.1}
                    min={0}
                    max={a?.max_score}
                    value={draft.score}
                    onChange={(e) => setDraft(s.id, { score: e.target.value })}
                    placeholder={`/ ${a?.max_score ?? 10}`}
                  />
                  <Textarea
                    rows={1}
                    value={draft.feedback}
                    onChange={(e) => setDraft(s.id, { feedback: e.target.value })}
                    placeholder="Nhận xét cho học sinh"
                  />
                  <Button onClick={() => grade(s)} size="sm">
                    {draft.score ? <Check className="mr-1 h-4 w-4" /> : <Save className="mr-1 h-4 w-4" />}
                    {draft.score ? "Chấm" : "Lưu"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}