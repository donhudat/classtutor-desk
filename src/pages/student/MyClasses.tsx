import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/features/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDateTime } from "@/lib/format";

type ClassRow = {
  id: number;
  name: string;
  subject: string | null;
  grade_level: number | null;
  start_date: string;
  end_date: string | null;
};

type SessionRow = {
  id: number;
  class_id: number;
  starts_at: string;
  ends_at: string;
  status: "scheduled" | "completed" | "cancelled";
  note: string | null;
};

const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export default function MyClassesPage() {
  const classesQ = useQuery({
    queryKey: ["my-classes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("id, name, subject, grade_level, start_date, end_date")
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return (data ?? []) as ClassRow[];
    },
  });

  const sessionsQ = useQuery({
    queryKey: ["my-upcoming-sessions"],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("class_sessions")
        .select("id, class_id, starts_at, ends_at, status, note")
        .is("deleted_at", null)
        .gte("ends_at", now)
        .neq("status", "cancelled")
        .order("starts_at", { ascending: true })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as SessionRow[];
    },
  });

  const classes = classesQ.data ?? [];
  const sessions = sessionsQ.data ?? [];
  const classMap = new Map(classes.map((c) => [c.id, c]));

  return (
    <div>
      <PageHeader
        title="Lớp của tôi"
        description="Các lớp đang theo học và lịch buổi sắp tới."
      />

      <h2 className="mb-3 font-display text-lg">Lịch sắp tới</h2>
      {sessionsQ.isLoading && (
        <p className="text-sm text-muted-foreground">Đang tải…</p>
      )}
      {!sessionsQ.isLoading && sessions.length === 0 && (
        <Card className="mb-6 border-dashed border-border/80 bg-card/40">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Chưa có buổi học nào sắp tới.
          </CardContent>
        </Card>
      )}
      <div className="mb-8 space-y-2">
        {sessions.map((s) => {
          const cls = classMap.get(s.class_id);
          const starts = new Date(s.starts_at);
          const ends = new Date(s.ends_at);
          return (
            <Card key={s.id} className="border-border/80">
              <CardContent className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-md bg-primary/10 text-primary">
                  <span className="text-[10px] font-medium uppercase">
                    {WEEKDAYS[starts.getDay()]}
                  </span>
                  <span className="font-display text-lg leading-none">
                    {starts.getDate()}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-base">
                      {cls?.name ?? `Lớp #${s.class_id}`}
                    </span>
                    {cls?.subject && <Badge variant="secondary">{cls.subject}</Badge>}
                    {cls?.grade_level && (
                      <Badge variant="outline">Lớp {cls.grade_level}</Badge>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {formatDateTime(s.starts_at)} →{" "}
                    {ends.toLocaleTimeString("vi-VN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                  {s.note && (
                    <p className="mt-1 text-xs text-muted-foreground">{s.note}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <h2 className="mb-3 font-display text-lg">Danh sách lớp</h2>
      {!classesQ.isLoading && classes.length === 0 && (
        <Card className="border-dashed border-border/80 bg-card/40">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Bạn chưa được thêm vào lớp nào.
          </CardContent>
        </Card>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {classes.map((c) => (
          <Card key={c.id} className="border-border/80">
            <CardContent className="space-y-2 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <span className="font-display text-base">{c.name}</span>
                {c.grade_level && (
                  <Badge variant="outline">Lớp {c.grade_level}</Badge>
                )}
                {c.subject && <Badge variant="secondary">{c.subject}</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">
                Bắt đầu {formatDate(c.start_date)}
                {c.end_date && ` • Kết thúc ${formatDate(c.end_date)}`}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}