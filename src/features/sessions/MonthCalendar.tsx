import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CalendarSession = {
  id: number;
  class_id: number;
  starts_at: string;
  ends_at: string;
  status?: "scheduled" | "completed" | "cancelled";
  className?: string;
  subject?: string | null;
};

type Props = {
  month: Date; // first day of month
  onMonthChange: (next: Date) => void;
  sessions: CalendarSession[];
  onSessionClick?: (s: CalendarSession) => void;
  rightAction?: React.ReactNode;
  /** Visual variant per session, defaults to status-based */
  colorFor?: (s: CalendarSession) => "primary" | "secondary" | "muted";
};

const WEEK_HEADERS = ["Th 2", "Th 3", "Th 4", "Th 5", "Th 6", "Th 7", "CN"];

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Return Monday (or first day of week) of the given date */
function startOfWeekMon(d: Date) {
  const x = new Date(d);
  const day = x.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

export function MonthCalendar({ month, onMonthChange, sessions, onSessionClick, rightAction, colorFor }: Props) {
  const monthStart = startOfMonth(month);
  const today = new Date();

  const days = useMemo(() => {
    const gridStart = startOfWeekMon(monthStart);
    const arr: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, [monthStart]);

  const sessionsByDay = useMemo(() => {
    const m = new Map<string, CalendarSession[]>();
    for (const s of sessions) {
      const d = new Date(s.starts_at);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const arr = m.get(key) ?? [];
      arr.push(s);
      m.set(key, arr);
    }
    // sort each day by start time
    m.forEach((list) => list.sort((a, b) => a.starts_at.localeCompare(b.starts_at)));
    return m;
  }, [sessions]);

  const goToday = () => onMonthChange(startOfMonth(new Date()));
  const goPrev = () => onMonthChange(new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1));
  const goNext = () => onMonthChange(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1));

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goPrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8" onClick={goToday}>
            Hôm nay
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="font-display text-base sm:text-lg">
          Tháng {monthStart.getMonth() + 1} Năm {monthStart.getFullYear()}
        </div>
        <div className="min-w-[80px] text-right">{rightAction}</div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-border bg-muted/30 text-center text-xs font-semibold">
        {WEEK_HEADERS.map((w) => (
          <div key={w} className="border-r border-border px-2 py-2 last:border-r-0">
            {w}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 grid-rows-6">
        {days.map((d, idx) => {
          const inMonth = d.getMonth() === monthStart.getMonth();
          const isToday = isSameDay(d, today);
          const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
          const dayItems = sessionsByDay.get(key) ?? [];
          return (
            <div
              key={idx}
              className={cn(
                "min-h-[110px] border-b border-r border-border p-1.5 text-xs",
                (idx + 1) % 7 === 0 && "border-r-0",
                idx >= 35 && "border-b-0",
                inMonth ? "bg-background" : "bg-muted/20 text-muted-foreground",
              )}
            >
              <div className="mb-1 flex items-center justify-end">
                {isToday ? (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-[11px] font-semibold text-destructive-foreground">
                    {d.getDate()}
                  </span>
                ) : (
                  <span className={cn("text-[11px]", !inMonth && "opacity-60")}>{d.getDate()}</span>
                )}
              </div>
              <div className="space-y-1">
                {dayItems.slice(0, 3).map((s) => {
                  const tone = colorFor?.(s) ?? (s.status === "completed" ? "secondary" : "primary");
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onSessionClick?.(s)}
                      title={`${fmtTime(s.starts_at)} - ${fmtTime(s.ends_at)} ${s.className ?? ""}`}
                      className={cn(
                        "block w-full truncate rounded px-1.5 py-1 text-left text-[11px] leading-tight transition hover:opacity-90",
                        tone === "primary" &&
                          "bg-primary/15 text-primary border border-primary/25",
                        tone === "secondary" &&
                          "bg-accent/40 text-accent-foreground border border-accent",
                        tone === "muted" && "bg-muted text-muted-foreground border border-border",
                      )}
                    >
                      <span className="font-semibold">{fmtTime(s.starts_at)}</span>{" "}
                      <span className="truncate">{s.className ?? `Lớp #${s.class_id}`}</span>
                    </button>
                  );
                })}
                {dayItems.length > 3 && (
                  <div className="px-1 text-[10px] text-muted-foreground">
                    +{dayItems.length - 3} buổi khác
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}