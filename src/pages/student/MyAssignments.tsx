import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Upload, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/features/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { useAuth } from "@/features/auth/AuthProvider";
import { FileList } from "@/components/FileList";
import type { StoredFile } from "@/lib/storage";
import { SubmitAssignmentDialog } from "@/features/student/SubmitAssignmentDialog";

type AssignmentRow = {
  id: number;
  class_id: number;
  title: string;
  description: string | null;
  max_score: number;
  deadline: string | null;
  attachments: StoredFile[];
  classes?: { name: string; subject: string | null } | null;
};

type SubRow = {
  id: number;
  assignment_id: number;
  status: "draft" | "submitted" | "graded" | "returned";
  score: number | null;
  feedback: string | null;
  submitted_at: string | null;
  returned_at: string | null;
};

const STATUS_LABEL: Record<SubRow["status"], string> = {
  draft: "Nháp",
  submitted: "Đã nộp",
  graded: "Đã chấm",
  returned: "Đã trả",
};

export default function MyAssignmentsPage() {
  const { user } = useAuth();
  const [active, setActive] = useState<AssignmentRow | null>(null);

  const studentQ = useQuery({
    queryKey: ["my-student-id", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data?.id ?? null;
    },
  });

  const aQ = useQuery({
    queryKey: ["my-assignments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignments")
        .select(
          "id, class_id, title, description, max_score, deadline, attachments, classes(name, subject)",
        )
        .is("deleted_at", null)
        .order("deadline", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        ...r,
        attachments: Array.isArray(r.attachments) ? (r.attachments as StoredFile[]) : [],
      })) as AssignmentRow[];
    },
  });

  const subsQ = useQuery({
    queryKey: ["my-submissions", studentQ.data],
    enabled: !!studentQ.data,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("submissions")
        .select("id, assignment_id, status, score, feedback, submitted_at, returned_at")
        .eq("student_id", studentQ.data!);
      if (error) throw error;
      return (data ?? []) as SubRow[];
    },
  });

  const subMap = useMemo(() => {
    const m = new Map<number, SubRow>();
    (subsQ.data ?? []).forEach((s) => m.set(s.assignment_id, s));
    return m;
  }, [subsQ.data]);

  const list = aQ.data ?? [];

  return (
    <div>
      <PageHeader
        title="Bài tập"
        description="Tải đề, làm bài và nộp lại cho giáo viên."
      />

      {studentQ.isFetched && !studentQ.data && (
        <Card className="border-dashed border-border/80 bg-card/40">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Tài khoản chưa được liên kết với hồ sơ học sinh.
          </CardContent>
        </Card>
      )}

      {!aQ.isLoading && list.length === 0 && (
        <Card className="border-dashed border-border/80 bg-card/40">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Chưa có bài tập nào.
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {list.map((a) => {
          const sub = subMap.get(a.id);
          const overdue = a.deadline && new Date(a.deadline) < new Date() && !sub;
          return (
            <Card key={a.id} className="border-border/80">
              <CardContent className="space-y-3 py-4">
                <div className="flex flex-wrap items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-base">{a.title}</span>
                      <Badge variant="secondary">
                        {a.classes?.name ?? `Lớp #${a.class_id}`}
                      </Badge>
                      {a.classes?.subject && (
                        <Badge variant="outline">{a.classes.subject}</Badge>
                      )}
                      <Badge variant="outline">Tối đa {a.max_score}</Badge>
                      {a.deadline && (
                        <Badge variant={overdue ? "destructive" : "outline"}>
                          Hạn: {formatDateTime(a.deadline)}
                        </Badge>
                      )}
                    </div>
                    {a.description && (
                      <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">
                        {a.description}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {sub ? (
                      <Badge
                        variant={sub.status === "graded" || sub.status === "returned" ? "default" : "secondary"}
                        className="gap-1"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        {STATUS_LABEL[sub.status]}
                      </Badge>
                    ) : (
                      overdue && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertCircle className="h-3 w-3" /> Quá hạn
                        </Badge>
                      )
                    )}
                    {sub?.score != null && (
                      <span className="font-display text-lg">
                        {sub.score}
                        <span className="text-sm text-muted-foreground">
                          /{a.max_score}
                        </span>
                      </span>
                    )}
                  </div>
                </div>

                {a.attachments.length > 0 && (
                  <div>
                    <div className="mb-1 flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <FileText className="h-3 w-3" /> File đề bài
                    </div>
                    <FileList
                      bucket="assignment-attachments"
                      files={a.attachments}
                      compact
                    />
                  </div>
                )}

                {sub?.feedback && (
                  <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
                    <div className="mb-1 text-xs font-medium uppercase tracking-wide text-primary">
                      Nhận xét của giáo viên
                    </div>
                    <p className="whitespace-pre-wrap">{sub.feedback}</p>
                    {sub.returned_at && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Trả bài: {formatDateTime(sub.returned_at)}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2">
                  <span className="text-xs text-muted-foreground">
                    {sub?.submitted_at
                      ? `Đã nộp: ${formatDateTime(sub.submitted_at)}`
                      : "Chưa nộp"}
                  </span>
                  <Button
                    size="sm"
                    variant={sub ? "outline" : "default"}
                    disabled={!studentQ.data || sub?.status === "graded" || sub?.status === "returned"}
                    onClick={() => setActive(a)}
                  >
                    <Upload className="mr-1 h-4 w-4" />
                    {sub ? "Nộp lại / Xem" : "Nộp bài"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {active && studentQ.data && (
        <SubmitAssignmentDialog
          open={!!active}
          onOpenChange={(v) => !v && setActive(null)}
          assignmentId={active.id}
          studentId={studentQ.data}
          assignmentTitle={active.title}
        />
      )}
    </div>
  );
}