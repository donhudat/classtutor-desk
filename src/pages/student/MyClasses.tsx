import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/features/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDateTime } from "@/lib/format";
import { MonthCalendar, type CalendarSession } from "@/features/sessions/MonthCalendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const [month, setMonth] = useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [detail, setDetail] = useState<SessionRow | null>(null);

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
    queryKey: ["my-month-sessions", month.toISOString()],
    queryFn: async () => {
      const start = new Date(month.getFullYear(), month.getMonth() - 1, 1).toISOString();
      const end = new Date(month.getFullYear(), month.getMonth() + 2, 1).toISOString();
      const { data, error } = await supabase
        .from("class_sessions")
        .select("id, class_id, starts_at, ends_at, status, note")
        .is("deleted_at", null)
        .gte("starts_at", start)
        .lt("starts_at", end)
        .neq("status", "cancelled")
        .order("starts_at", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as SessionRow[];
    },
  });

  const classes = classesQ.data ?? [];
  const sessions = sessionsQ.data ?? [];
  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);
  const calSessions: CalendarSession[] = sessions.map((s) => {
    const cls = classMap.get(s.class_id);
    return {
      id: s.id,
      class_id: s.class_id,
      starts_at: s.starts_at,
      ends_at: s.ends_at,
      status: s.status,
      className: cls?.name,
      subject: cls?.subject ?? null,
    };
  });

  const detailCls = detail ? classMap.get(detail.class_id) : null;

  return (
    <div>
      <PageHeader
        title="Lớp của tôi"
        description="Lịch học hằng tháng và các lớp bạn đang theo học."
      />

      <div className="mb-6">
        <MonthCalendar
          month={month}
          onMonthChange={setMonth}
          sessions={calSessions}
          onSessionClick={(s) => {
            const full = sessions.find((x) => x.id === s.id);
            if (full) setDetail(full);
          }}
        />
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

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent>
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle>{detailCls?.name ?? `Lớp #${detail.class_id}`}</DialogTitle>
                <DialogDescription className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {WEEKDAYS[new Date(detail.starts_at).getDay()]} •{" "}
                  {formatDateTime(detail.starts_at)} →{" "}
                  {new Date(detail.ends_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-wrap gap-2">
                {detailCls?.subject && <Badge variant="secondary">{detailCls.subject}</Badge>}
                {detailCls?.grade_level && <Badge variant="outline">Lớp {detailCls.grade_level}</Badge>}
              </div>
              {detail.note && <p className="text-sm text-muted-foreground">Ghi chú: {detail.note}</p>}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}