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
  // Mỗi weekday có thể có khung giờ riêng. Nếu undefined → ngày đó không học.
  const [slots, setSlots] = useState<Record<number, { start: string; end: string }>>({});

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
      const next: Record<number, { start: string; end: string }> = {};
      sched.forEach((s) => {
        next[s.weekday] = { start: s.start, end: s.end };
      });
      setSlots(next);
    }
  }, [open, editing]);

  const toggleDay = (wd: number) => {
    setSlots((cur) => {
      const next = { ...cur };
      if (next[wd]) {
        delete next[wd];
      } else {
        // Mặc định giờ học: nếu đã có ngày khác thì copy giờ của ngày đầu tiên, ngược lại 18:00–19:30.
        const existing = Object.values(cur)[0];
        next[wd] = existing ? { ...existing } : { start: "18:00", end: "19:30" };
      }
      return next;
    });
  };

  const updateSlot = (wd: number, key: "start" | "end", val: string) => {
    setSlots((cur) => ({ ...cur, [wd]: { ...cur[wd], [key]: val } }));
  };

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
    const entries = Object.entries(slots).map(([wd, t]) => ({
      weekday: Number(wd),
      start: t.start,
      end: t.end,
    }));
    if (entries.length === 0) {
      toast({ title: "Lỗi", description: "Chọn ít nhất 1 ngày trong tuần", variant: "destructive" });
      return;
    }
    for (const e of entries) {
      if (!e.start || !e.end || e.end <= e.start) {
        const lbl = WEEKDAYS.find((w) => w.v === e.weekday)?.label ?? "";
        toast({
          title: "Lỗi",
          description: `Giờ kết thúc phải sau giờ bắt đầu (${lbl})`,
          variant: "destructive",
        });
        return;
      }
    }
    const schedule = entries.sort((a, b) => {
      // Thứ tự T2..CN cho dễ nhìn
      const order = (w: number) => (w === 0 ? 7 : w);
      return order(a.weekday) - order(b.weekday);
    });
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
            <p className="mt-1 text-xs text-muted-foreground">
              Chọn các ngày trong tuần và đặt khung giờ riêng cho từng ngày.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {WEEKDAYS.map((d) => {
                const checked = !!slots[d.v];
                return (
                  <button
                    key={d.v}
                    type="button"
                    onClick={() => toggleDay(d.v)}
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

            {Object.keys(slots).length > 0 && (
              <div className="mt-3 space-y-2 rounded-md border border-border bg-muted/30 p-3">
                {WEEKDAYS.filter((d) => slots[d.v]).map((d) => (
                  <div key={d.v} className="flex items-center gap-2">
                    <span className="w-10 shrink-0 text-sm font-medium">{d.label}</span>
                    <Input
                      type="time"
                      value={slots[d.v].start}
                      onChange={(e) => updateSlot(d.v, "start", e.target.value)}
                      className="h-9"
                      required
                    />
                    <span className="text-sm text-muted-foreground">→</span>
                    <Input
                      type="time"
                      value={slots[d.v].end}
                      onChange={(e) => updateSlot(d.v, "end", e.target.value)}
                      className="h-9"
                      required
                    />
                  </div>
                ))}
              </div>
            )}
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
