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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
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
  /** Giữ tham số này để tương thích, nhưng không dùng nữa */
  defaultClassId?: number;
  onGenerated?: () => void;
}) {
  const { profile } = useAuth();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedClassIds, setSelectedClassIds] = useState<number[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const today = new Date();
    const inAMonth = new Date();
    inAMonth.setDate(today.getDate() + 30);
    setFrom(ymd(today));
    setTo(ymd(inAMonth));
    setSelectedClassIds(defaultClassId ? [defaultClassId] : []);
  }, [open]);

  // Lớp thực tế được dùng để sinh buổi: nếu user chọn cụ thể thì lọc, mặc định = tất cả.
  const targetClasses = useMemo(
    () => (selectedClassIds.length > 0 ? classes.filter((c) => selectedClassIds.includes(c.id)) : classes),
    [classes, selectedClassIds],
  );

  // Tính tổng số buổi sẽ sinh trên TẤT CẢ lớp.
  const preview = useMemo(() => {
    if (!from || !to) return { total: 0, perClass: [] as { name: string; count: number }[] };
    const start = parseYMD(from);
    const end = parseYMD(to);
    const perClass: { name: string; count: number }[] = [];
    let total = 0;
    for (const cls of targetClasses) {
      if (!cls.schedule?.length) continue;
      const clsStart = parseYMD(cls.start_date);
      const clsEnd = cls.end_date ? parseYMD(cls.end_date) : null;
      const lower = start < clsStart ? clsStart : start;
      const upper = clsEnd && end > clsEnd ? clsEnd : end;
      let count = 0;
      for (let d = new Date(lower); d <= upper; d.setDate(d.getDate() + 1)) {
        const wd = d.getDay();
        for (const s of cls.schedule) {
          if (s.weekday === wd) count++;
        }
      }
      if (count > 0) {
        total += count;
        perClass.push({ name: cls.name, count });
      }
    }
    return { total, perClass };
  }, [targetClasses, from, to]);

  const submit = async () => {
    if (!profile) return;
    if (!from || !to) {
      toast({ title: "Chọn khoảng ngày", variant: "destructive" });
      return;
    }
    if (preview.total === 0) {
      toast({ title: "Không có buổi nào để tạo", variant: "destructive" });
      return;
    }
    setLoading(true);

    const fromISO = combine(from, "00:00");
    const toISO = combine(to, "23:59");

    const targetClassIds = targetClasses.map((c) => c.id);

    // Xoá (soft-delete) các buổi CŨ trong khoảng — chỉ trong các lớp được chọn,
    // chỉ những buổi chưa được điểm danh và đang ở trạng thái "scheduled".
    const { error: delErr } = await supabase
      .from("class_sessions")
      .update({ deleted_at: new Date().toISOString() })
      .gte("starts_at", fromISO)
      .lte("starts_at", toISO)
      .in("class_id", targetClassIds)
      .eq("status", "scheduled")
      .is("attendance_taken_at", null)
      .is("deleted_at", null);
    if (delErr) {
      setLoading(false);
      toast({ title: "Lỗi", description: delErr.message, variant: "destructive" });
      return;
    }

    // Lấy lại các buổi còn tồn tại (đã điểm danh / completed / cancelled) để tránh trùng slot.
    const { data: existing, error: existErr } = await supabase
      .from("class_sessions")
      .select("class_id, starts_at")
      .gte("starts_at", fromISO)
      .lte("starts_at", toISO)
      .in("class_id", targetClassIds)
      .is("deleted_at", null);
    if (existErr) {
      setLoading(false);
      toast({ title: "Lỗi", description: existErr.message, variant: "destructive" });
      return;
    }
    const existingSet = new Set(
      (existing ?? []).map((r: any) => `${r.class_id}|${r.starts_at}`),
    );

    const start = parseYMD(from);
    const end = parseYMD(to);
    const generatedSet = new Set<string>();
    const rows: {
      tenant_id: number;
      class_id: number;
      starts_at: string;
      ends_at: string;
      status: "scheduled";
    }[] = [];

    for (const cls of targetClasses) {
      if (!cls.schedule?.length) continue;
      const clsStart = parseYMD(cls.start_date);
      const clsEnd = cls.end_date ? parseYMD(cls.end_date) : null;
      const lower = start < clsStart ? clsStart : start;
      const upper = clsEnd && end > clsEnd ? clsEnd : end;
      for (let d = new Date(lower); d <= upper; d.setDate(d.getDate() + 1)) {
        const wd = d.getDay();
        for (const s of cls.schedule) {
          if (s.weekday !== wd) continue;
          const startsAt = combine(ymd(d), s.start);
          const rowKey = `${cls.id}|${startsAt}`;
          if (existingSet.has(rowKey) || generatedSet.has(rowKey)) continue;
          generatedSet.add(rowKey);
          rows.push({
            tenant_id: profile.tenant_id,
            class_id: cls.id,
            starts_at: startsAt,
            ends_at: combine(ymd(d), s.end),
            status: "scheduled",
          });
        }
      }
    }

    if (rows.length === 0) {
      setLoading(false);
      toast({ title: "Không có buổi mới để tạo" });
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

  const skipped = preview.total > 0 ? preview.perClass.length : 0;

  const toggleClass = (id: number) =>
    setSelectedClassIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const classDisplay =
    selectedClassIds.length === 0
      ? "Tất cả lớp"
      : selectedClassIds.length === 1
        ? classes.find((c) => c.id === selectedClassIds[0])?.name ?? "1 lớp"
        : `${selectedClassIds.length} lớp đã chọn`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Sinh buổi học từ lịch</DialogTitle>
          <DialogDescription>
            Tự động tạo buổi cho các lớp được chọn dựa trên lịch cố định trong tuần. Các buổi cũ{" "}
            <span className="font-semibold">chưa điểm danh</span> trong khoảng sẽ bị thay thế;
            buổi đã điểm danh được giữ nguyên.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Lớp</Label>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  type="button"
                  className="mt-1 h-10 w-full justify-between"
                >
                  <span
                    className={cn(
                      "truncate",
                      selectedClassIds.length === 0 && "text-muted-foreground",
                    )}
                  >
                    {classDisplay}
                  </span>
                  <div className="flex items-center gap-1">
                    {selectedClassIds.length > 0 && (
                      <span
                        role="button"
                        tabIndex={0}
                        className="rounded-full p-0.5 hover:bg-muted"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedClassIds([]);
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </span>
                    )}
                    <ChevronDown className="h-4 w-4 opacity-60" />
                  </div>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Tìm lớp…" />
                  <CommandList>
                    <CommandEmpty>Không có lớp.</CommandEmpty>
                    <CommandGroup>
                      {classes.map((c) => {
                        const checked = selectedClassIds.includes(c.id);
                        return (
                          <CommandItem
                            key={c.id}
                            value={c.name}
                            onSelect={() => toggleClass(c.id)}
                            className="flex items-center gap-2"
                          >
                            <div
                              className={cn(
                                "flex h-4 w-4 items-center justify-center rounded border",
                                checked
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border",
                              )}
                            >
                              {checked && <Check className="h-3 w-3" />}
                            </div>
                            <span className="truncate text-sm">{c.name}</span>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <p className="mt-1 text-xs text-muted-foreground">
              Để trống = sinh cho tất cả lớp.
            </p>
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
            Sẽ tạo tối đa <span className="font-semibold">{preview.total}</span> buổi từ{" "}
            <span className="font-semibold">{skipped}</span> lớp.
            <span className="ml-1 text-muted-foreground">Buổi trùng giờ sẽ bị bỏ qua.</span>
          </div>

          {preview.perClass.length > 0 && (
            <div className="max-h-48 space-y-1 overflow-auto rounded-md border border-border bg-background px-3 py-2 text-sm">
              {preview.perClass.map((p) => (
                <div key={p.name} className="flex items-center justify-between gap-2">
                  <span className="truncate">{p.name}</span>
                  <span className="shrink-0 text-muted-foreground">{p.count} buổi</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Huỷ
          </Button>
          <Button onClick={submit} disabled={loading || preview.total === 0}>
            {loading ? "Đang tạo…" : "Tạo buổi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
