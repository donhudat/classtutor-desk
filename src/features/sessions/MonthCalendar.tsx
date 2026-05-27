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
    <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="font-display text-xl font-semibold tracking-tight">
          Tháng {monthStart.getMonth() + 1}{" "}
          <span className="text-muted-foreground font-normal">{monthStart.getFullYear()}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-full border border-border/70 bg-background/60 p-0.5 shadow-sm">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={goPrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 rounded-full px-3 text-xs font-medium" onClick={goToday}>
              Hôm nay
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={goNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          {rightAction}
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 px-2 pb-2 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
        {WEEK_HEADERS.map((w) => (
          <div key={w} className="py-2">
            {w}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-1.5 px-2 pb-3">
        {days.map((d, idx) => {
          const inMonth = d.getMonth() === monthStart.getMonth();
          const isToday = isSameDay(d, today);
          const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
          const dayItems = sessionsByDay.get(key) ?? [];
          return (
            <div
              key={idx}
              className={cn(
                "min-h-[112px] rounded-xl p-2 text-xs transition-colors",
                inMonth
                  ? "bg-background/40 hover:bg-secondary/40"
                  : "bg-transparent text-muted-foreground/60",
                isToday && "ring-1 ring-primary/40 bg-primary/5",
              )}
            >
              <div className="mb-1.5 flex items-center justify-end">
                {isToday ? (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground shadow-sm shadow-primary/40">
                    {d.getDate()}
                  </span>
                ) : (
                  <span className={cn("text-[12px] font-medium", !inMonth && "opacity-60")}>
                    {d.getDate()}
                  </span>
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
                        "flex w-full items-center gap-1.5 truncate rounded-lg px-2 py-1 text-left text-[11px] leading-tight transition-all hover:translate-x-0.5",
                        tone === "primary" &&
                          "bg-primary/10 text-primary hover:bg-primary/15 border-l-2 border-primary",
                        tone === "secondary" &&
                          "bg-accent/15 text-accent hover:bg-accent/25 border-l-2 border-accent",
                        tone === "muted" &&
                          "bg-muted text-muted-foreground border-l-2 border-border",
                      )}
                    >
                      <span className="font-semibold tabular-nums">{fmtTime(s.starts_at)}</span>
                      <span className="truncate font-medium opacity-90">{s.className ?? `Lớp #${s.class_id}`}</span>
                    </button>
                  );
                })}
                {dayItems.length > 3 && (
                  <div className="px-1 text-[10px] font-medium text-muted-foreground">
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