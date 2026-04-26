import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Wand2, ClipboardCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { SessionFormDialog, SessionEditing } from "@/features/sessions/SessionFormDialog";
import { GenerateSessionsDialog } from "@/features/sessions/GenerateSessionsDialog";

type ClassRow = {
  id: number;
  name: string;
  subject: string | null;
  grade_level: number | null;
  start_date: string;
  end_date: string | null;
  schedule: { weekday: number; start: string; end: string }[] | null;
};

type SessionRow = {
  id: number;
  class_id: number;
  starts_at: string;
  ends_at: string;
  status: "scheduled" | "completed" | "cancelled";
  note: string | null;
  attendance_taken_at: string | null;
};

const STATUS_LABEL: Record<SessionRow["status"], string> = {
  scheduled: "Đã lên lịch",
  completed: "Đã diễn ra",
  cancelled: "Đã huỷ",
};

const STATUS_VARIANT: Record<SessionRow["status"], "default" | "secondary" | "outline"> = {
  scheduled: "secondary",
  completed: "default",
  cancelled: "outline",
};

export default function SessionsPage() {
  const qc = useQueryClient();
  const [classFilter, setClassFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [genOpen, setGenOpen] = useState(false);
  const [editing, setEditing] = useState<SessionEditing | null>(null);

  const classesQ = useQuery({
    queryKey: ["classes-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("id, name, subject, grade_level, start_date, end_date, schedule")
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as ClassRow[];
    },
  });

  const sessionsQ = useQuery({
    queryKey: ["sessions", classFilter],
    queryFn: async () => {
      let q = supabase
        .from("class_sessions")
        .select("id, class_id, starts_at, ends_at, status, note, attendance_taken_at")
        .is("deleted_at", null)
        .order("starts_at", { ascending: false })
        .limit(200);
      if (classFilter !== "all") q = q.eq("class_id", Number(classFilter));
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as SessionRow[];
    },
  });

  const classMap = useMemo(() => {
    const m = new Map<number, ClassRow>();
    (classesQ.data ?? []).forEach((c) => m.set(c.id, c));
    return m;
  }, [classesQ.data]);

  const softDelete = async (id: number) => {
    const { error } = await supabase
      .from("class_sessions")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Đã xoá buổi" });
    qc.invalidateQueries({ queryKey: ["sessions"] });
  };

  const list = sessionsQ.data ?? [];
  const classes = classesQ.data ?? [];

  return (
    <div>
      <PageHeader
        title="Buổi học"
        description="Quản lý các buổi học và mở điểm danh."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setGenOpen(true)} disabled={classes.length === 0}>
              <Wand2 className="mr-2 h-4 w-4" /> Sinh từ lịch
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
              disabled={classes.length === 0}
            >
              <Plus className="mr-2 h-4 w-4" /> Tạo buổi
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Lọc theo lớp:</span>
        <Select value={classFilter} onValueChange={setClassFilter}>
          <SelectTrigger className="w-[260px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả lớp</SelectItem>
            {classes.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {classes.length === 0 && (
        <Card className="border-dashed border-border/80 bg-card/40">
          <CardContent className="py-12 text-center">
            <p className="font-display text-xl">Chưa có lớp học</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              Tạo lớp trước rồi quay lại đây để xếp buổi.
            </p>
          </CardContent>
        </Card>
      )}

      {classes.length > 0 && list.length === 0 && !sessionsQ.isLoading && (
        <Card className="border-dashed border-border/80 bg-card/40">
          <CardContent className="py-12 text-center">
            <p className="font-display text-xl">Chưa có buổi học nào</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              Bấm "Sinh từ lịch" để tự động tạo theo lịch cố định trong tuần.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {list.map((s) => (
          <Card key={s.id} className="border-border/80">
            <CardContent className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {(() => {
                    const cls = classMap.get(s.class_id);
                    return (
                      <>
                        <span className="font-display text-base">
                          {cls?.name ?? `Lớp #${s.class_id}`}
                        </span>
                        {cls?.grade_level && (
                          <Badge variant="outline">Lớp {cls.grade_level}</Badge>
                        )}
                        {cls?.subject && (
                          <Badge variant="secondary">{cls.subject}</Badge>
                        )}
                      </>
                    );
                  })()}
                  <Badge variant={STATUS_VARIANT[s.status]}>{STATUS_LABEL[s.status]}</Badge>
                  {s.attendance_taken_at && (
                    <Badge variant="outline" className="border-primary/40 text-primary">
                      Đã điểm danh
                    </Badge>
                  )}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {formatDateTime(s.starts_at)} → {formatDateTime(s.ends_at).split(" ")[0]}
                </div>
                {s.note && <div className="mt-1 text-xs text-muted-foreground">{s.note}</div>}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button asChild variant="outline" size="sm">
                  <Link to={`/attendance/${s.id}`}>
                    <ClipboardCheck className="mr-1 h-4 w-4" /> Điểm danh
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    setEditing(s);
                    setOpen(true);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Xoá buổi học?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Buổi sẽ bị ẩn. Dữ liệu điểm danh đã ghi vẫn còn.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Huỷ</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => softDelete(s.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Xoá
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <SessionFormDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        classes={classes}
        defaultClassId={classFilter !== "all" ? Number(classFilter) : undefined}
        onSaved={() => qc.invalidateQueries({ queryKey: ["sessions"] })}
      />
      <GenerateSessionsDialog
        open={genOpen}
        onOpenChange={setGenOpen}
        classes={classes}
        defaultClassId={classFilter !== "all" ? Number(classFilter) : undefined}
        onGenerated={() => qc.invalidateQueries({ queryKey: ["sessions"] })}
      />
    </div>
  );
}