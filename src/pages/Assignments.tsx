import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, ClipboardList } from "lucide-react";
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
import { AssignmentFormDialog, AssignmentEditing } from "@/features/assignments/AssignmentFormDialog";

type Row = {
  id: number;
  class_id: number;
  title: string;
  description: string | null;
  max_score: number;
  deadline: string | null;
};

export default function AssignmentsPage() {
  const qc = useQueryClient();
  const [classFilter, setClassFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AssignmentEditing | null>(null);

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

  const aQ = useQuery({
    queryKey: ["assignments", classFilter],
    queryFn: async () => {
      let q = supabase
        .from("assignments")
        .select("id, class_id, title, description, max_score, deadline")
        .is("deleted_at", null)
        .order("id", { ascending: false });
      if (classFilter !== "all") q = q.eq("class_id", Number(classFilter));
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const classMap = useMemo(() => {
    const m = new Map<number, string>();
    (classesQ.data ?? []).forEach((c) => m.set(c.id, c.name));
    return m;
  }, [classesQ.data]);

  const softDelete = async (id: number) => {
    const { error } = await supabase
      .from("assignments")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Đã xoá bài tập" });
    qc.invalidateQueries({ queryKey: ["assignments"] });
  };

  const list = aQ.data ?? [];
  const classes = classesQ.data ?? [];

  return (
    <div>
      <PageHeader
        title="Bài tập"
        description="Giao bài, theo dõi học sinh nộp và chấm điểm."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
            disabled={classes.length === 0}
          >
            <Plus className="mr-2 h-4 w-4" /> Tạo bài tập
          </Button>
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

      {!aQ.isLoading && list.length === 0 && (
        <Card className="border-dashed border-border/80 bg-card/40">
          <CardContent className="py-12 text-center">
            <p className="font-display text-xl">Chưa có bài tập</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              Tạo bài tập đầu tiên để giao cho lớp.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {list.map((a) => {
          const overdue = a.deadline && new Date(a.deadline) < new Date();
          return (
            <Card key={a.id} className="border-border/80">
              <CardContent className="flex flex-wrap items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-base">{a.title}</span>
                    <Badge variant="secondary">{classMap.get(a.class_id) ?? `Lớp #${a.class_id}`}</Badge>
                    <Badge variant="outline">Tối đa {a.max_score}</Badge>
                    {a.deadline && (
                      <Badge variant={overdue ? "destructive" : "outline"}>
                        Hạn: {formatDateTime(a.deadline)}
                      </Badge>
                    )}
                  </div>
                  {a.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{a.description}</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/assignments/${a.id}`}>
                      <ClipboardList className="mr-1 h-4 w-4" /> Bài nộp
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      setEditing(a);
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
                        <AlertDialogTitle>Xoá bài tập?</AlertDialogTitle>
                        <AlertDialogDescription>Bài và các bản nộp sẽ bị ẩn.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Huỷ</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => softDelete(a.id)}
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
          );
        })}
      </div>

      <AssignmentFormDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        classes={classes}
        defaultClassId={classFilter !== "all" ? Number(classFilter) : undefined}
        onSaved={() => qc.invalidateQueries({ queryKey: ["assignments"] })}
      />
    </div>
  );
}