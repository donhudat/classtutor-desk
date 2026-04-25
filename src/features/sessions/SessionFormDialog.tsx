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

type SessionStatus = "scheduled" | "completed" | "cancelled";

export type SessionEditing = {
  id?: number;
  class_id?: number;
  starts_at?: string;
  ends_at?: string;
  status?: SessionStatus;
  note?: string | null;
};

const schema = z.object({
  class_id: z.number().int().positive("Chọn lớp"),
  date: z.string().min(1, "Chọn ngày"),
  start: z.string().min(1, "Chọn giờ bắt đầu"),
  end: z.string().min(1, "Chọn giờ kết thúc"),
  status: z.enum(["scheduled", "completed", "cancelled"]),
  note: z.string().max(500).optional(),
});

function toLocalISO(date: string, time: string) {
  // date: YYYY-MM-DD, time: HH:MM → ISO with local TZ
  const d = new Date(`${date}T${time}:00`);
  return d.toISOString();
}
function splitISO(iso?: string) {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

export function SessionFormDialog({
  open,
  onOpenChange,
  editing,
  defaultClassId,
  classes,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: SessionEditing | null;
  defaultClassId?: number;
  classes: { id: number; name: string }[];
  onSaved?: () => void;
}) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [classId, setClassId] = useState<number | undefined>();
  const [date, setDate] = useState("");
  const [start, setStart] = useState("18:00");
  const [end, setEnd] = useState("19:30");
  const [status, setStatus] = useState<SessionStatus>("scheduled");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editing?.id) {
      const s = splitISO(editing.starts_at);
      const e = splitISO(editing.ends_at);
      setClassId(editing.class_id);
      setDate(s.date);
      setStart(s.time);
      setEnd(e.time);
      setStatus(editing.status ?? "scheduled");
      setNote(editing.note ?? "");
    } else {
      setClassId(defaultClassId ?? classes[0]?.id);
      setDate("");
      setStart("18:00");
      setEnd("19:30");
      setStatus("scheduled");
      setNote("");
    }
  }, [open, editing, defaultClassId, classes]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({
      class_id: classId ?? 0,
      date,
      start,
      end,
      status,
      note,
    });
    if (!parsed.success) {
      toast({ title: "Lỗi", description: parsed.error.errors[0].message, variant: "destructive" });
      return;
    }
    if (end <= start) {
      toast({ title: "Lỗi", description: "Giờ kết thúc phải sau giờ bắt đầu", variant: "destructive" });
      return;
    }
    if (!profile) return;

    const payload = {
      class_id: parsed.data.class_id,
      starts_at: toLocalISO(date, start),
      ends_at: toLocalISO(date, end),
      status: parsed.data.status,
      note: parsed.data.note || null,
    };

    setLoading(true);
    let error;
    if (editing?.id) {
      ({ error } = await supabase.from("class_sessions").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase
        .from("class_sessions")
        .insert({ ...payload, tenant_id: profile.tenant_id }));
    }
    setLoading(false);
    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing?.id ? "Đã cập nhật buổi" : "Đã tạo buổi" });
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {editing?.id ? "Sửa buổi học" : "Tạo buổi học"}
          </DialogTitle>
          <DialogDescription>Chọn lớp, ngày và khung giờ buổi học.</DialogDescription>
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
            <Label>Ngày</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Giờ bắt đầu</Label>
              <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} required />
            </div>
            <div>
              <Label>Giờ kết thúc</Label>
              <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} required />
            </div>
          </div>
          <div>
            <Label>Trạng thái</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as SessionStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="scheduled">Đã lên lịch</SelectItem>
                <SelectItem value="completed">Đã diễn ra</SelectItem>
                <SelectItem value="cancelled">Đã huỷ</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Ghi chú</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} />
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