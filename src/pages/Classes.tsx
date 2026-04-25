import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/features/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClassFormDialog, ClassEditing } from "@/features/classes/ClassFormDialog";
import { EnrollmentsDialog } from "@/features/classes/EnrollmentsDialog";
import { formatDate, formatVND } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

const dayLabel = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

type ClassRow = {
  id: number;
  name: string;
  subject: string | null;
  start_date: string;
  end_date: string | null;
  note: string | null;
  schedule: { weekday: number; start: string; end: string }[] | null;
};

type EnrollAgg = { class_id: number; count: number; min: number; max: number };

export default function ClassesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ClassEditing | null>(null);
  const [enrollOf, setEnrollOf] = useState<{ id: number; name: string } | null>(null);

  const classesQ = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("id, name, subject, start_date, end_date, note, schedule")
        .is("deleted_at", null)
        .order("id", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ClassRow[];
    },
  });

  // Aggregate enrollments cho tất cả lớp (số học sinh đang học + price range)
  const aggQ = useQuery({
    queryKey: ["enrollments-agg"],
    enabled: !!classesQ.data?.length,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("class_enrollments")
        .select("class_id, price_per_session, end_date")
        .is("deleted_at", null);
      if (error) throw error;
      const map = new Map<number, EnrollAgg>();
      (data ?? []).forEach((r: any) => {
        if (r.end_date && r.end_date < today) return;
        const cur = map.get(r.class_id) ?? {
          class_id: r.class_id,
          count: 0,
          min: Infinity,
          max: -Infinity,
        };
        cur.count += 1;
        cur.min = Math.min(cur.min, r.price_per_session);
        cur.max = Math.max(cur.max, r.price_per_session);
        map.set(r.class_id, cur);
      });
      return map;
    },
  });

  const aggMap = aggQ.data ?? new Map<number, EnrollAgg>();

  const softDelete = async (id: number) => {
    const { error } = await supabase
      .from("classes")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Đã xoá lớp" });
    qc.invalidateQueries({ queryKey: ["classes"] });
  };

  const list = classesQ.data ?? [];

  return (
    <div>
      <PageHeader
        title="Lớp học"
        description="Tạo và quản lý các lớp dạy thêm của bạn."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Tạo lớp
          </Button>
        }
      />

      {classesQ.isLoading && (
        <p className="text-center text-muted-foreground">Đang tải…</p>
      )}

      {!classesQ.isLoading && list.length === 0 && (
        <Card className="border-dashed border-border/80 bg-card/40">
          <CardContent className="py-12 text-center">
            <p className="font-display text-xl">Chưa có lớp học nào</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              Tạo lớp đầu tiên để bắt đầu sắp xếp lịch và điểm danh học sinh.
            </p>
            <Button
              className="mt-4"
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> Tạo lớp
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.map((c) => {
          const agg = aggMap.get(c.id);
          const priceLabel = agg
            ? agg.min === agg.max
              ? formatVND(agg.min)
              : `${formatVND(agg.min)} – ${formatVND(agg.max)}`
            : null;
          return (
            <Card key={c.id} className="border-border/80 transition-shadow hover:shadow-md">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="font-display text-lg leading-tight">{c.name}</CardTitle>
                    {c.subject && (
                      <Badge variant="secondary" className="mt-2">{c.subject}</Badge>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title={`Học sinh trong lớp${agg ? ` (${agg.count})` : ""}`}
                      onClick={() => setEnrollOf({ id: c.id, name: c.name })}
                    >
                      <Users className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        setEditing(c as ClassEditing);
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
                          <AlertDialogTitle>Xoá lớp "{c.name}"?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Lớp sẽ bị ẩn. Lịch sử buổi học, điểm danh, học phí vẫn còn.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Huỷ</AlertDialogCancel>
                          <AlertDialogAction onClick={() => softDelete(c.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Xoá
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex flex-wrap gap-1">
                  {(c.schedule ?? []).map((s, i) => (
                    <span key={i} className="rounded-md bg-muted px-2 py-1 text-xs">
                      {dayLabel[s.weekday]} • {s.start}–{s.end}
                    </span>
                  ))}
                  {(!c.schedule || c.schedule.length === 0) && (
                    <span className="text-xs text-muted-foreground">Chưa có lịch</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 border-t border-border pt-2 text-xs text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => setEnrollOf({ id: c.id, name: c.name })}
                    className="inline-flex items-center gap-1 rounded-md hover:text-foreground"
                  >
                    <Users className="h-3.5 w-3.5" />
                    <span className="font-medium text-foreground">{agg?.count ?? 0}</span> học sinh
                  </button>
                  {priceLabel && (
                    <span>
                      Học phí: <span className="font-medium text-foreground">{priceLabel}</span>/buổi
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  Bắt đầu: {formatDate(c.start_date)}
                  {c.end_date && ` → ${formatDate(c.end_date)}`}
                </div>
                {c.note && (
                  <p className="border-t border-border pt-2 text-xs text-muted-foreground">
                    {c.note}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <ClassFormDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        onSaved={(newId?: number, name?: string) => {
          qc.invalidateQueries({ queryKey: ["classes"] });
          if (newId && name) setEnrollOf({ id: newId, name });
        }}
      />
      <EnrollmentsDialog
        open={!!enrollOf}
        onOpenChange={(v) => !v && setEnrollOf(null)}
        classId={enrollOf?.id ?? null}
        className={enrollOf?.name ?? ""}
      />
    </div>
  );
}
