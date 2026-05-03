import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Clock, FileText, MessageSquare, ClipboardCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/features/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateTime } from "@/lib/format";
import { useAuth } from "@/features/auth/AuthProvider";
import { FileList } from "@/components/FileList";
import type { StoredFile } from "@/lib/storage";
import { MonthCalendar, type CalendarSession } from "@/features/sessions/MonthCalendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Child = {
  id: number;
  user_id: string;
  full_name: string;
  login_id: string;
};

const ATT_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  attended: { label: "Có mặt", variant: "default" },
  late: { label: "Đi muộn", variant: "secondary" },
  absent: { label: "Vắng", variant: "destructive" },
  absent_excused: { label: "Vắng có phép", variant: "outline" },
};

const WEEKDAYS = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];

function formatSessionRange(starts_at?: string, ends_at?: string) {
  if (!starts_at) return "—";
  const s = new Date(starts_at);
  const wd = WEEKDAYS[s.getDay()];
  const date = s.toLocaleDateString("vi-VN");
  const sh = s.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  if (!ends_at) return `${wd}, ${date} • ${sh}`;
  const e = new Date(ends_at);
  const eh = e.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  return `${wd}, ${date} • ${sh} → ${eh}`;
}

export default function MyChildrenPage() {
  const { user } = useAuth();
  const [childId, setChildId] = useState<string>("");
  const [month, setMonth] = useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [sessionDetail, setSessionDetail] = useState<any | null>(null);

  const parentQ = useQuery({
    queryKey: ["my-parent-id", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parents")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data?.id ?? null;
    },
  });

  const childrenQ = useQuery({
    queryKey: ["my-children", parentQ.data],
    enabled: !!parentQ.data,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, user_id, profiles(full_name, login_id)")
        .eq("parent_id", parentQ.data!)
        .is("deleted_at", null);
      if (error) throw error;
      return (data ?? []).map((s: any) => ({
        id: s.id,
        user_id: s.user_id,
        full_name: s.profiles?.full_name ?? "—",
        login_id: s.profiles?.login_id ?? "",
      })) as Child[];
    },
  });

  useEffect(() => {
    if (childrenQ.data && childrenQ.data.length > 0 && !childId) {
      setChildId(String(childrenQ.data[0].id));
    }
  }, [childrenQ.data, childId]);

  const selectedId = childId ? Number(childId) : null;

  const enrollQ = useQuery({
    queryKey: ["child-enrollments", selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("class_enrollments")
        .select("class_id, end_date, classes(id, name, subject, grade_level)")
        .eq("student_id", selectedId!)
        .is("deleted_at", null);
      if (error) throw error;
      return (data ?? []).filter((e: any) => !e.end_date || e.end_date >= today);
    },
  });

  const classIds = useMemo(
    () => (enrollQ.data ?? []).map((e: any) => e.class_id),
    [enrollQ.data],
  );

  const sessionsQ = useQuery({
    queryKey: ["child-sessions", selectedId, classIds, month.toISOString()],
    enabled: !!selectedId && classIds.length > 0,
    queryFn: async () => {
      const start = new Date(month.getFullYear(), month.getMonth() - 1, 1).toISOString();
      const end = new Date(month.getFullYear(), month.getMonth() + 2, 1).toISOString();
      const { data, error } = await supabase
        .from("class_sessions")
        .select("id, class_id, starts_at, ends_at, status, note")
        .in("class_id", classIds)
        .is("deleted_at", null)
        .gte("starts_at", start)
        .lt("starts_at", end)
        .neq("status", "cancelled")
        .order("starts_at", { ascending: true })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const assignmentsQ = useQuery({
    queryKey: ["child-assignments", selectedId, classIds],
    enabled: !!selectedId && classIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignments")
        .select("id, class_id, session_id, title, description, max_score, deadline, attachments, classes(name, subject), class_sessions:session_id(starts_at, ends_at)")
        .in("class_id", classIds)
        .is("deleted_at", null)
        .order("deadline", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        ...r,
        attachments: Array.isArray(r.attachments) ? (r.attachments as StoredFile[]) : [],
      }));
    },
  });

  const submissionsQ = useQuery({
    queryKey: ["child-submissions", selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("submissions")
        .select("id, assignment_id, status, score, feedback, content, submitted_at, returned_at, graded_at")
        .eq("student_id", selectedId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const subMap = useMemo(() => {
    const m = new Map<number, any>();
    (submissionsQ.data ?? []).forEach((s: any) => m.set(s.assignment_id, s));
    return m;
  }, [submissionsQ.data]);

  const submissionIds = useMemo(
    () => (submissionsQ.data ?? []).map((s: any) => s.id),
    [submissionsQ.data],
  );

  const subFilesQ = useQuery({
    queryKey: ["child-submission-files", submissionIds],
    enabled: submissionIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("submission_files")
        .select("id, submission_id, file_name, file_size, storage_path, mime_type")
        .in("submission_id", submissionIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const subFilesMap = useMemo(() => {
    const m = new Map<number, StoredFile[]>();
    (subFilesQ.data ?? []).forEach((f: any) => {
      const list = m.get(f.submission_id) ?? [];
      list.push({
        name: f.file_name,
        path: f.storage_path,
        size: f.file_size,
        mime: f.mime_type,
      });
      m.set(f.submission_id, list);
    });
    return m;
  }, [subFilesQ.data]);

  const feedbacksQ = useQuery({
    queryKey: ["child-feedbacks", selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feedbacks")
        .select("id, content, created_at, session_id, class_sessions(starts_at, ends_at, classes(name, subject))")
        .eq("student_id", selectedId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const attendanceQ = useQuery({
    queryKey: ["child-attendance", selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendances")
        .select("id, status, note, checked_in_at, class_sessions(starts_at, ends_at, classes(name, subject))")
        .eq("student_id", selectedId!)
        .order("id", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const children = childrenQ.data ?? [];

  if (parentQ.isFetched && !parentQ.data) {
    return (
      <div>
        <PageHeader title="Con của tôi" description="Theo dõi quá trình học tập." />
        <Card className="border-dashed border-border/80 bg-card/40">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Tài khoản chưa được liên kết với hồ sơ phụ huynh.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Con của tôi"
        description="Theo dõi lịch học, bài tập, điểm danh và nhận xét của con."
      />

      {children.length === 0 && childrenQ.isFetched && (
        <Card className="border-dashed border-border/80 bg-card/40">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Chưa có học sinh nào liên kết với tài khoản của bạn.
          </CardContent>
        </Card>
      )}

      {children.length > 0 && (
        <>
          <div className="mb-4 flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Chọn con:</span>
            <Select value={childId} onValueChange={setChildId}>
              <SelectTrigger className="w-[260px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {children.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.full_name} (@{c.login_id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Tabs defaultValue="schedule">
            <TabsList>
              <TabsTrigger value="schedule">
                <CalendarDays className="mr-1 h-4 w-4" /> Lịch học
              </TabsTrigger>
              <TabsTrigger value="assignments">
                <FileText className="mr-1 h-4 w-4" /> Bài tập
              </TabsTrigger>
              <TabsTrigger value="attendance">
                <ClipboardCheck className="mr-1 h-4 w-4" /> Điểm danh
              </TabsTrigger>
              <TabsTrigger value="feedback">
                <MessageSquare className="mr-1 h-4 w-4" /> Nhận xét
              </TabsTrigger>
            </TabsList>

            <TabsContent value="schedule" className="mt-4 space-y-4">
              <div>
                <h3 className="mb-2 font-display text-base">Lớp đang học</h3>
                <div className="grid gap-2 md:grid-cols-2">
                  {(enrollQ.data ?? []).map((e: any) => (
                    <Card key={e.class_id} className="border-border/80">
                      <CardContent className="flex flex-wrap items-center gap-2 py-3">
                        <span className="font-display">{e.classes?.name}</span>
                        {e.classes?.grade_level && (
                          <Badge variant="outline">Lớp {e.classes.grade_level}</Badge>
                        )}
                        {e.classes?.subject && (
                          <Badge variant="secondary">{e.classes.subject}</Badge>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="mb-2 font-display text-base">Lịch học theo tháng</h3>
                <MonthCalendar
                  month={month}
                  onMonthChange={setMonth}
                  sessions={((sessionsQ.data ?? []) as any[]).map((s) => {
                    const cls = (enrollQ.data ?? []).find(
                      (e: any) => e.class_id === s.class_id,
                    )?.classes;
                    return {
                      id: s.id,
                      class_id: s.class_id,
                      starts_at: s.starts_at,
                      ends_at: s.ends_at,
                      status: s.status,
                      className: cls?.name,
                      subject: cls?.subject ?? null,
                    } as CalendarSession;
                  })}
                  onSessionClick={(s) => {
                    const full = (sessionsQ.data ?? []).find((x: any) => x.id === s.id);
                    if (full) {
                      const cls = (enrollQ.data ?? []).find(
                        (e: any) => e.class_id === full.class_id,
                      )?.classes;
                      setSessionDetail({ ...full, _class: cls });
                    }
                  }}
                />
              </div>
            </TabsContent>

            <TabsContent value="assignments" className="mt-4 space-y-2">
              {(assignmentsQ.data ?? []).length === 0 && !assignmentsQ.isLoading && (
                <p className="text-sm text-muted-foreground">Chưa có bài tập nào.</p>
              )}
              {(assignmentsQ.data ?? []).map((a: any) => {
                const sub = subMap.get(a.id);
                return (
                  <Card key={a.id} className="border-border/80">
                    <CardContent className="space-y-2 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display">{a.title}</span>
                        <Badge variant="secondary">{a.classes?.name}</Badge>
                        {a.classes?.subject && (
                          <Badge variant="outline">{a.classes.subject}</Badge>
                        )}
                        {a.deadline && (
                          <Badge variant="outline">
                            Hạn: {formatDateTime(a.deadline)}
                          </Badge>
                        )}
                        {sub ? (
                          <Badge
                            variant={
                              sub.status === "graded" || sub.status === "returned"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {sub.status === "graded"
                              ? "Đã chấm"
                              : sub.status === "returned"
                                ? "Đã trả"
                                : "Đã nộp"}
                          </Badge>
                        ) : (
                          <Badge variant="destructive">Chưa nộp</Badge>
                        )}
                        {sub?.score != null && (
                          <Badge variant="default">
                            {sub.score}/{a.max_score}
                          </Badge>
                        )}
                      </div>
                      {a.class_sessions?.starts_at && (
                        <div className="text-xs text-muted-foreground">
                          <Clock className="mr-1 inline h-3 w-3" />
                          Buổi học: {formatSessionRange(a.class_sessions.starts_at, a.class_sessions.ends_at)}
                        </div>
                      )}
                      {a.description && (
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {a.description}
                        </p>
                      )}
                      {a.attachments?.length > 0 && (
                        <FileList
                          bucket="assignment-attachments"
                          files={a.attachments}
                          compact
                        />
                      )}
                      {sub?.feedback && (
                        <div className="rounded-md border border-primary/30 bg-primary/5 p-2 text-sm">
                          <div className="text-xs font-medium uppercase tracking-wide text-primary">
                            Nhận xét
                          </div>
                          <p className="whitespace-pre-wrap">{sub.feedback}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>

            <TabsContent value="attendance" className="mt-4 space-y-2">
              {(attendanceQ.data ?? []).length === 0 && !attendanceQ.isLoading && (
                <p className="text-sm text-muted-foreground">Chưa có dữ liệu điểm danh.</p>
              )}
              {(attendanceQ.data ?? []).map((a: any) => {
                const meta = ATT_LABEL[a.status] ?? { label: a.status, variant: "outline" as const };
                const cls = a.class_sessions?.classes;
                return (
                  <Card key={a.id} className="border-border/80">
                    <CardContent className="flex flex-wrap items-start gap-3 px-4 py-3">
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{cls?.name ?? "—"}</span>
                          {cls?.subject && (
                            <Badge variant="secondary">{cls.subject}</Badge>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          <Clock className="mr-1 inline h-3 w-3" />
                          {formatSessionRange(a.class_sessions?.starts_at, a.class_sessions?.ends_at)}
                        </div>
                        {a.note && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            Ghi chú: {a.note}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>

            <TabsContent value="feedback" className="mt-4 space-y-2">
              {(feedbacksQ.data ?? []).length === 0 && !feedbacksQ.isLoading && (
                <p className="text-sm text-muted-foreground">Chưa có nhận xét nào.</p>
              )}
              {(feedbacksQ.data ?? []).map((f: any) => {
                const cls = f.class_sessions?.classes;
                return (
                  <Card key={f.id} className="border-border/80">
                    <CardContent className="space-y-2 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{cls?.name ?? "—"}</span>
                        {cls?.subject && (
                          <Badge variant="secondary">{cls.subject}</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <Clock className="mr-1 inline h-3 w-3" />
                        Buổi học: {formatSessionRange(f.class_sessions?.starts_at, f.class_sessions?.ends_at)}
                      </div>
                      <p className="whitespace-pre-wrap rounded-md border border-primary/30 bg-primary/5 p-2 text-sm">
                        {f.content}
                      </p>
                      <div className="text-[10px] text-muted-foreground">
                        Giáo viên gửi {formatDateTime(f.created_at)}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>
          </Tabs>
        </>
      )}

      <Dialog open={!!sessionDetail} onOpenChange={(v) => !v && setSessionDetail(null)}>
        <DialogContent>
          {sessionDetail && (
            <>
              <DialogHeader>
                <DialogTitle>{sessionDetail._class?.name ?? `Lớp #${sessionDetail.class_id}`}</DialogTitle>
                <DialogDescription className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {formatSessionRange(sessionDetail.starts_at, sessionDetail.ends_at)}
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-wrap gap-2">
                {sessionDetail._class?.subject && (
                  <Badge variant="secondary">{sessionDetail._class.subject}</Badge>
                )}
                {sessionDetail._class?.grade_level && (
                  <Badge variant="outline">Lớp {sessionDetail._class.grade_level}</Badge>
                )}
              </div>
              {sessionDetail.note && (
                <p className="text-sm text-muted-foreground">Ghi chú: {sessionDetail.note}</p>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}