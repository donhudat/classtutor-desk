import { useEffect, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/features/auth/AuthProvider";

export type AssignmentEditing = {
  id?: number;
  class_id?: number;
  title?: string;
  description?: string | null;
  max_score?: number;
  deadline?: string | null;
};

const schema = z.object({
  class_id: z.number().int().positive("Chọn lớp"),
  title: z.string().trim().min(1, "Nhập tiêu đề").max(200),
  description: z.string().max(2000).optional(),
  max_score: z.number().min(0.1).max(100),
  deadline: z.string().optional(),
});

function toLocalISO(dt: string) {
  if (!dt) return null;
  return new Date(dt).toISOString();
}
function fromISOLocal(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AssignmentFormDialog({
  open,
  onOpenChange,
  editing,
  defaultClassId,
  classes,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: AssignmentEditing | null;
  defaultClassId?: number;
  classes: { id: number; name: string }[];
  onSaved?: () => void;
}) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [classId, setClassId] = useState<number | undefined>();
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [maxScore, setMaxScore] = useState("10");
  const [deadline, setDeadline] = useState("");

  useEffect(() => {
    if (!open) return;
    setClassId(editing?.class_id ?? defaultClassId ?? classes[0]?.id);
    setTitle(editing?.title ?? "");
    setDesc(editing?.description ?? "");
    setMaxScore(String(editing?.max_score ?? 10));
    setDeadline(fromISOLocal(editing?.deadline ?? null));
  }, [open, editing, defaultClassId, classes]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({
      class_id: classId ?? 0,
      title,
      description: desc,
      max_score: Number(maxScore),
      deadline,
    });
    if (!parsed.success) {
      toast({ title: "Lỗi", description: parsed.error.errors[0].message, variant: "destructive" });
      return;
    }
    if (!profile) return;
    const payload = {
      class_id: parsed.data.class_id,
      title: parsed.data.title,
      description: parsed.data.description || null,
      max_score: parsed.data.max_score,
      deadline: toLocalISO(parsed.data.deadline || ""),
    };
    setLoading(true);
    let error;
    if (editing?.id) {
      ({ error } = await supabase.from("assignments").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase
        .from("assignments")
        .insert({ ...payload, tenant_id: profile.tenant_id, created_by: profile.id }));
    }
    setLoading(false);
    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing?.id ? "Đã cập nhật bài" : "Đã tạo bài tập" });
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {editing?.id ? "Sửa bài tập" : "Tạo bài tập"}
          </DialogTitle>
          <DialogDescription>Giao bài cho lớp với hạn nộp và điểm tối đa.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div>
            <Label>Lớp</Label>
            <Select
              value={classId ? String(classId) : undefined}
              onValueChange={(v) => setClassId(Number(v))}
              disabled={!!editing?.id}
            >
              <SelectTrigger>
                <SelectValue placeholder="Chọn lớp" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tiêu đề</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
          </div>
          <div>
            <Label>Mô tả</Label>
            <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={4} maxLength={2000} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Điểm tối đa</Label>
              <Input type="number" min={0.1} max={100} step={0.1} value={maxScore} onChange={(e) => setMaxScore(e.target.value)} />
            </div>
            <div>
              <Label>Hạn nộp</Label>
              <Input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Huỷ
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Đang lưu…" : "Lưu"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}