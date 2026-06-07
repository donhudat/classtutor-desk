import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Wand2, ClipboardCheck, CalendarDays, List, Check, ChevronDown, X, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/features/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MonthCalendar, type CalendarSession } from "@/features/sessions/MonthCalendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
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
import { QuickAttendance } from "@/features/sessions/QuickAttendance";

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
  const [classFilter, setClassFilter] = useState<number[]>([]);
  const [studentFilter, setStudentFilter] = useState<number[]>([]);
  const [open, setOpen] = useState(false);
  const [genOpen, setGenOpen] = useState(false);
  const [editing, setEditing] = useState<SessionEditing | null>(null);
  const [month, setMonth] = useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [detail, setDetail] = useState<SessionRow | null>(null);
  const [quickOpenId, setQuickOpenId] = useState<number | null>(null);

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

  const studentsQ = useQuery({
    queryKey: ["students-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, profiles:profiles!students_user_id_fkey(full_name, login_id)")
        .is("deleted_at", null);
      if (error) {
        // Fallback without explicit fk hint if it's missing
        const { data: d2, error: e2 } = await supabase
          .from("students")
          .select("id, user_id")
          .is("deleted_at", null);
        if (e2) throw e2;
        const ids = (d2 ?? []).map((s: any) => s.user_id);
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, login_id")
          .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
        const pm = new Map((profs ?? []).map((p: any) => [p.id, p]));
        return (d2 ?? [])
          .map((s: any) => ({
            id: s.id as number,
            full_name: (pm.get(s.user_id) as any)?.full_name ?? "—",
            login_id: (pm.get(s.user_id) as any)?.login_id ?? "",
          }))
          .sort((a, b) => a.full_name.localeCompare(b.full_name, "vi"));
      }
      return (data ?? [])
        .map((s: any) => ({
          id: s.id as number,
          full_name: s.profiles?.full_name ?? "—",
          login_id: s.profiles?.login_id ?? "",
        }))
        .sort((a, b) => a.full_name.localeCompare(b.full_name, "vi"));
    },
  });

  // Resolve class_ids from selected students (1 student in many classes)
  const studentClassIdsQ = useQuery({
    queryKey: ["student-classes", studentFilter.slice().sort().join(",")],
    enabled: studentFilter.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_enrollments")
        .select("class_id")
        .in("student_id", studentFilter)
        .is("deleted_at", null);
      if (error) throw error;
      return Array.from(new Set((data ?? []).map((r: any) => r.class_id as number)));
    },
  });

  // Combined class filter
  const effectiveClassIds = useMemo<number[] | null>(() => {
    if (studentFilter.length > 0) {
      if (!studentClassIdsQ.data) return [];
      const fromStudents = studentClassIdsQ.data;
      if (classFilter.length === 0) return fromStudents;
      return fromStudents.filter((id) => classFilter.includes(id));
    }
    return classFilter.length > 0 ? classFilter : null; // null = all
  }, [classFilter, studentFilter, studentClassIdsQ.data]);

  const sessionsQ = useQuery({
    queryKey: [
      "sessions",
      effectiveClassIds ? effectiveClassIds.slice().sort().join(",") : "all",
      month.toISOString(),
    ],
    enabled: effectiveClassIds === null || effectiveClassIds.length > 0 || studentFilter.length === 0,
    queryFn: async () => {
      const start = new Date(month.getFullYear(), month.getMonth() - 1, 1).toISOString();
      const end = new Date(month.getFullYear(), month.getMonth() + 2, 1).toISOString();
      let q = supabase
        .from("class_sessions")
        .select("id, class_id, starts_at, ends_at, status, note, attendance_taken_at")
        .is("deleted_at", null)
        .gte("starts_at", start)
        .lt("starts_at", end)
        .order("starts_at", { ascending: false })
        .limit(500);
      if (effectiveClassIds !== null) q = q.in("class_id", effectiveClassIds);
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

  // If student filter set but resolution returned 0 classes, force empty
  const list =
    studentFilter.length > 0 && effectiveClassIds && effectiveClassIds.length === 0
      ? []
      : sessionsQ.data ?? [];
  const classes = classesQ.data ?? [];
  const students = studentsQ.data ?? [];

  const calSessions: CalendarSession[] = list.map((s) => {
    const c = classMap.get(s.class_id);
    return {
      id: s.id,
      class_id: s.class_id,
      starts_at: s.starts_at,
      ends_at: s.ends_at,
      status: s.status,
      className: c?.name,
      subject: c?.subject ?? null,
    };
  });

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

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <MultiSelectFilter
          label="lớp"
          placeholder="Tất cả lớp"
          options={classes.map((c) => ({ id: c.id, label: c.name, sub: c.subject ?? undefined }))}
          selected={classFilter}
          onChange={setClassFilter}
        />
        <MultiSelectFilter
          label="học sinh"
          placeholder="Tất cả học sinh"
          options={students.map((s) => ({ id: s.id, label: s.full_name, sub: s.login_id }))}
          selected={studentFilter}
          onChange={setStudentFilter}
        />
        {(classFilter.length > 0 || studentFilter.length > 0) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setClassFilter([]);
              setStudentFilter([]);
            }}
          >
            Xoá bộ lọc
          </Button>
        )}
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

      {classes.length > 0 && (
        <Tabs defaultValue="calendar">
          <TabsList className="mb-3">
            <TabsTrigger value="calendar">
              <CalendarDays className="mr-1 h-4 w-4" /> Lịch tháng
            </TabsTrigger>
            <TabsTrigger value="list">
              <List className="mr-1 h-4 w-4" /> Danh sách
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calendar">
            <MonthCalendar
              month={month}
              onMonthChange={setMonth}
              sessions={calSessions}
              onSessionClick={(s) => {
                const full = list.find((x) => x.id === s.id);
                if (full) setDetail(full);
              }}
              colorFor={(s) =>
                s.status === "completed" ? "success" : s.status === "cancelled" ? "destructive" : "primary"
              }
            />
          </TabsContent>

          <TabsContent value="list">
            {list.length === 0 && !sessionsQ.isLoading && (
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
        {list.map((s) => {
          const statusBorder =
            s.status === "completed"
              ? "border-l-4 border-l-emerald-500"
              : s.status === "cancelled"
                ? "border-l-4 border-l-red-500"
                : "";
          return (
          <Card key={s.id} className={cn("border-border/80", statusBorder)}>
            <CardContent className="px-0 py-0">
              <div className="flex flex-wrap items-center gap-3 px-4 py-3">
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
                  {s.status === "completed" && (
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
                      {STATUS_LABEL[s.status]}
                    </Badge>
                  )}
                  {s.status === "cancelled" && (
                    <Badge variant="destructive">{STATUS_LABEL[s.status]}</Badge>
                  )}
                  {s.status === "scheduled" && (
                    <Badge variant={STATUS_VARIANT[s.status]}>{STATUS_LABEL[s.status]}</Badge>
                  )}
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
                <Button
                  variant={quickOpenId === s.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setQuickOpenId(quickOpenId === s.id ? null : s.id)}
                >
                  <Zap className="mr-1 h-4 w-4" /> Điểm danh nhanh
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to={`/attendance/${s.id}`}>
                    <ClipboardCheck className="mr-1 h-4 w-4" /> Đầy đủ
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
              </div>
              {quickOpenId === s.id && (
                <QuickAttendance
                  sessionId={s.id}
                  classId={s.class_id}
                  sessionDate={s.starts_at.slice(0, 10)}
                  onSaved={() => {
                    qc.invalidateQueries({ queryKey: ["sessions"] });
                  }}
                />
              )}
            </CardContent>
          </Card>
        )}
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* Detail dialog (from calendar click) */}
      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent>
          {detail && (() => {
            const cls = classMap.get(detail.class_id);
            return (
              <>
                <DialogHeader>
                  <DialogTitle>{cls?.name ?? `Lớp #${detail.class_id}`}</DialogTitle>
                  <DialogDescription>
                    {formatDateTime(detail.starts_at)} → {formatDateTime(detail.ends_at).split(" ")[0]}
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-wrap gap-2">
                  {cls?.subject && <Badge variant="secondary">{cls.subject}</Badge>}
                  {cls?.grade_level && <Badge variant="outline">Lớp {cls.grade_level}</Badge>}
                  <Badge variant={STATUS_VARIANT[detail.status]}>{STATUS_LABEL[detail.status]}</Badge>
                  {detail.attendance_taken_at && (
                    <Badge variant="outline" className="border-primary/40 text-primary">Đã điểm danh</Badge>
                  )}
                </div>
                {detail.note && (
                  <p className="text-sm text-muted-foreground">{detail.note}</p>
                )}
                <DialogFooter className="gap-2 sm:gap-2">
                  <Button asChild variant="outline">
                    <Link to={`/attendance/${detail.id}`}>
                      <ClipboardCheck className="mr-1 h-4 w-4" /> Điểm danh
                    </Link>
                  </Button>
                  <Button
                    onClick={() => {
                      setEditing(detail);
                      setDetail(null);
                      setOpen(true);
                    }}
                  >
                    <Pencil className="mr-1 h-4 w-4" /> Sửa
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <SessionFormDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        classes={classes}
        defaultClassId={classFilter.length === 1 ? classFilter[0] : undefined}
        onSaved={() => qc.invalidateQueries({ queryKey: ["sessions"] })}
      />
      <GenerateSessionsDialog
        open={genOpen}
        onOpenChange={setGenOpen}
        classes={classes}
        defaultClassId={classFilter.length === 1 ? classFilter[0] : undefined}
        onGenerated={() => qc.invalidateQueries({ queryKey: ["sessions"] })}
      />
    </div>
  );
}

function MultiSelectFilter({
  label,
  placeholder,
  options,
  selected,
  onChange,
}: {
  label: string;
  placeholder: string;
  options: { id: number; label: string; sub?: string }[];
  selected: number[];
  onChange: (next: number[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (id: number) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const display =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? options.find((o) => o.id === selected[0])?.label ?? `1 ${label}`
        : `${selected.length} ${label} đã chọn`;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-10 min-w-[220px] justify-between">
          <span className={cn("truncate", selected.length === 0 && "text-muted-foreground")}>
            {display}
          </span>
          <div className="flex items-center gap-1">
            {selected.length > 0 && (
              <span
                role="button"
                tabIndex={0}
                className="rounded-full p-0.5 hover:bg-muted"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange([]);
                }}
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <ChevronDown className="h-4 w-4 opacity-60" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Tìm ${label}…`} />
          <CommandList>
            <CommandEmpty>Không có {label}.</CommandEmpty>
            <CommandGroup>
              {options.map((o) => {
                const checked = selected.includes(o.id);
                return (
                  <CommandItem
                    key={o.id}
                    value={`${o.label} ${o.sub ?? ""}`}
                    onSelect={() => toggle(o.id)}
                    className="flex items-center gap-2"
                  >
                    <div
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded border",
                        checked ? "border-primary bg-primary text-primary-foreground" : "border-border",
                      )}
                    >
                      {checked && <Check className="h-3 w-3" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{o.label}</div>
                      {o.sub && (
                        <div className="truncate text-[11px] text-muted-foreground">{o.sub}</div>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}