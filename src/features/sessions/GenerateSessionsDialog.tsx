import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type ClassWithSchedule = {
  id: number;
  name: string;
  start_date: string;
  end_date: string | null;
  schedule: { weekday: number; start: string; end: string }[] | null;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function ymd(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function parseYMD(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function combine(dateStr: string, time: string) {
  return new Date(`${dateStr}T${time}:00`).toISOString();
}

export function GenerateSessionsDialog({
  open,
  onOpenChange,
  classes,
  defaultClassId,
  onGenerated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  classes: ClassWithSchedule[];
  defaultClassId?: number;
  onGenerated?: () => void;
}) {
  const { profile } = useAuth();
  const [classId, setClassId] = useState<number | undefined>();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);

  const cls = useMemo(() => classes.find((c) => c.id === classId), [classes, classId]);

  useEffect(() => {
    if (!open) return;
    setClassId(defaultClassId ?? classes[0]?.id);
    const today = new Date();
    const inAMonth = new Date();
    inAMonth.setDate(today.getDate() + 30);
    setFrom(ymd(today));
    setTo(ymd(inAMonth));
  }, [open, classes, defaultClassId]);

  const previewSlots = useMemo(() => {
    if (!cls || !from || !to || !cls.schedule?.length) return [] as { date: string; start: string; end: string }[];
    const start = parseYMD(from);
    const end = parseYMD(to);
    const clsStart = parseYMD(cls.start_date);
    const clsEnd = cls.end_date ? parseYMD(cls.end_date) : null;
    const lower = start < clsStart ? clsStart : start;
    const upper = clsEnd && end > clsEnd ? clsEnd : end;
    const slots: { date: string; start: string; end: string }[] = [];
    for (let d = new Date(lower); d <= upper; d.setDate(d.getDate() + 1)) {
      const wd = d.getDay();
      for (const s of cls.schedule) {
        if (s.weekday === wd) slots.push({ date: ymd(d), start: s.start, end: s.end });
      }
    }
    return slots;
  }, [cls, from, to]);

  const submit = async () => {
    if (!cls || !profile) return;
    if (previewSlots.length === 0) {
      toast({ title: "Không có buổi nào để tạo", variant: "destructive" });
      return;
    }
    setLoading(true);

    // Lấy danh sách buổi đã có trong khoảng để tránh trùng
    const fromISO = combine(from, "00:00");
    const toISO = combine(to, "23:59");
    const { data: existing, error: existErr } = await supabase
      .from("class_sessions")
      .select("starts_at")
      .eq("class_id", cls.id)
      .gte("starts_at", fromISO)
      .lte("starts_at", toISO)
      .is("deleted_at", null);
    if (existErr) {
      setLoading(false);
      toast({ title: "Lỗi", description: existErr.message, variant: "destructive" });
      return;
    }
    const existingSet = new Set((existing ?? []).map((r) => r.starts_at));

    const rows = previewSlots
      .map((s) => ({
        tenant_id: profile.tenant_id,
        class_id: cls.id,
        starts_at: combine(s.date, s.start),
        ends_at: combine(s.date, s.end),
        status: "scheduled" as const,
      }))
      .filter((r) => !existingSet.has(r.starts_at));

    if (rows.length === 0) {
      setLoading(false);
      toast({ title: "Tất cả buổi đã tồn tại" });
      onOpenChange(false);
      return;
    }

    const { error } = await supabase.from("class_sessions").insert(rows);
    setLoading(false);
    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Đã tạo ${rows.length} buổi học` });
    onGenerated?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Sinh buổi học từ lịch</DialogTitle>
          <DialogDescription>
            Tự động tạo các buổi học cho lớp dựa theo lịch cố định trong tuần.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Lớp</Label>
            <Select
              value={classId ? String(classId) : undefined}
              onValueChange={(v) => setClassId(Number(v))}
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Từ ngày</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label>Đến ngày</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
            Sẽ tạo <span className="font-semibold">{previewSlots.length}</span> buổi.{" "}
            <span className="text-muted-foreground">Buổi trùng giờ bắt đầu sẽ bị bỏ qua.</span>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Huỷ
          </Button>
          <Button onClick={submit} disabled={loading || previewSlots.length === 0}>
            {loading ? "Đang tạo…" : "Tạo buổi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}