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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const WEEKDAYS = [
  { v: 1, label: "T2" },
  { v: 2, label: "T3" },
  { v: 3, label: "T4" },
  { v: 4, label: "T5" },
  { v: 5, label: "T6" },
  { v: 6, label: "T7" },
  { v: 0, label: "CN" },
];

const GRADE_LEVELS = Array.from({ length: 12 }, (_, i) => i + 1);
const SUBJECTS = [
  "Toán",
  "Ngữ văn",
  "Tiếng Anh",
  "Vật lý",
  "Hoá học",
  "Sinh học",
  "Lịch sử",
  "Địa lý",
  "GDCD",
  "Tin học",
  "Khác",
];

const schema = z.object({
  name: z.string().trim().min(1, "Nhập tên lớp").max(100),
  subject: z.string().trim().min(1, "Chọn môn học").max(100),
  grade_level: z.number().int().min(1).max(12),
  start_date: z.string().min(1, "Chọn ngày bắt đầu"),
  end_date: z.string().optional(),
  note: z.string().max(500).optional(),
});

export type ClassEditing = {
  id?: number;
  name?: string;
  subject?: string | null;
  grade_level?: number | null;
  start_date?: string;
  end_date?: string | null;
  note?: string | null;
  schedule?: { weekday: number; start: string; end: string }[];
};

export function ClassFormDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: ClassEditing | null;
  onSaved?: (newId?: number, name?: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    subject: "",
    grade_level: "",
    start_date: "",
    end_date: "",
    note: "",
  });
  const [days, setDays] = useState<number[]>([]);
  const [startTime, setStartTime] = useState("18:00");
  const [endTime, setEndTime] = useState("19:30");

  useEffect(() => {
    if (open) {
      setForm({
        name: editing?.name ?? "",
        subject: editing?.subject ?? "",
        grade_level: editing?.grade_level ? String(editing.grade_level) : "",
        start_date: editing?.start_date ?? "",
        end_date: editing?.end_date ?? "",
        note: editing?.note ?? "",
      });
      const sched = editing?.schedule ?? [];
      setDays(Array.from(new Set(sched.map((s) => s.weekday))));
      if (sched[0]) {
        setStartTime(sched[0].start);
        setEndTime(sched[0].end);
      } else {
        setStartTime("18:00");
        setEndTime("19:30");
      }
    }
  }, [open, editing]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({
      ...form,
      grade_level: form.grade_level ? Number(form.grade_level) : NaN,
    });
    if (!parsed.success) {
      toast({ title: "Lỗi", description: parsed.error.errors[0].message, variant: "destructive" });
      return;
    }
    if (days.length === 0) {
      toast({ title: "Lỗi", description: "Chọn ít nhất 1 ngày trong tuần", variant: "destructive" });
      return;
    }
    if (endTime <= startTime) {
      toast({ title: "Lỗi", description: "Giờ kết thúc phải sau giờ bắt đầu", variant: "destructive" });
      return;
    }

    const schedule = days.map((d) => ({ weekday: d, start: startTime, end: endTime }));
    const payload = {
      name: parsed.data.name,
      subject: parsed.data.subject,
      grade_level: parsed.data.grade_level,
      start_date: parsed.data.start_date,
      end_date: parsed.data.end_date || null,
      note: parsed.data.note || null,
      schedule,
    };

    setLoading(true);
    let error: any;
    let insertedId: number | undefined;
    if (editing?.id) {
      ({ error } = await supabase.from("classes").update(payload).eq("id", editing.id));
    } else {
      // tenant_id sẽ được set bởi default? Không, RLS WITH CHECK cần tenant_id = current_tenant_id().
      // Lấy tenant_id hiện tại từ profile.
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        toast({ title: "Lỗi", description: "Bạn cần đăng nhập lại", variant: "destructive" });
        return;
      }
      const { data: prof } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .maybeSingle();
      if (!prof) {
        setLoading(false);
        toast({ title: "Lỗi", description: "Không tìm thấy profile", variant: "destructive" });
        return;
      }
      const ins = await supabase
        .from("classes")
        .insert({ ...payload, tenant_id: prof.tenant_id })
        .select("id")
        .single();
      error = ins.error;
      insertedId = ins.data?.id;
    }
    setLoading(false);
    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing?.id ? "Đã cập nhật lớp" : "Đã tạo lớp" });
    onSaved?.(insertedId, parsed.data.name);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {editing?.id ? "Sửa lớp" : "Tạo lớp mới"}
          </DialogTitle>
          <DialogDescription>
            Thiết lập tên lớp và lịch học cố định trong tuần.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Tên lớp</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                placeholder="vd: Toán 9 — Ca tối T246"
              />
            </div>
            <div>
              <Label>Khối lớp</Label>
              <Select
                value={form.grade_level}
                onValueChange={(v) => setForm({ ...form, grade_level: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn khối" />
                </SelectTrigger>
                <SelectContent>
                  {GRADE_LEVELS.map((g) => (
                    <SelectItem key={g} value={String(g)}>
                      Lớp {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Môn học</Label>
              <Select
                value={form.subject}
                onValueChange={(v) => setForm({ ...form, subject: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn môn" />
                </SelectTrigger>
                <SelectContent>
                  {SUBJECTS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ngày bắt đầu</Label>
              <Input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Ngày kết thúc (tuỳ chọn)</Label>
              <Input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label>Lịch học cố định trong tuần</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {WEEKDAYS.map((d) => {
                const checked = days.includes(d.v);
                return (
                  <button
                    key={d.v}
                    type="button"
                    onClick={() =>
                      setDays((cur) =>
                        cur.includes(d.v) ? cur.filter((x) => x !== d.v) : [...cur, d.v],
                      )
                    }
                    className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                      checked
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:bg-muted"
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Giờ bắt đầu</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
            </div>
            <div>
              <Label>Giờ kết thúc</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
            </div>
          </div>

          <div>
            <Label>Ghi chú (tuỳ chọn)</Label>
            <Textarea
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              rows={2}
              maxLength={500}
            />
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
