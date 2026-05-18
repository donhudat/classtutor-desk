import { PageHeader } from "@/features/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp, Target, DollarSign, Flag } from "lucide-react";

// Snapshot data from Semrush (database: vn) — updated May 2026
const DATA_SOURCE = "Semrush · Database: Vietnam (vn)";
const SNAPSHOT_DATE = "Tháng 5, 2026";

type KeywordRow = {
  keyword: string;
  volume: number | null;
  cpc: number | null;
  competition: number | null;
  difficulty: number | null;
  note?: string;
};

const targetKeywords: KeywordRow[] = [
  { keyword: "quản lý lớp học", volume: 210, cpc: 0.33, competition: 0.03, difficulty: 14 },
  { keyword: "quản lý lớp học gia sư", volume: null, cpc: null, competition: null, difficulty: null, note: "Quá ngách — Semrush không có dữ liệu" },
  { keyword: "phần mềm gia sư", volume: 20, cpc: 0, competition: 0.71, difficulty: 0 },
];

const relatedKeywords: KeywordRow[] = [
  { keyword: "lớp học", volume: 33100, cpc: 0.09, competition: 0.02, difficulty: null },
  { keyword: "phần mềm quản lý trung tâm", volume: 210, cpc: 0.4, competition: 0.24, difficulty: null },
  { keyword: "phần mềm quản lý học sinh", volume: 170, cpc: 0.27, competition: 0.33, difficulty: null },
  { keyword: "phần mềm quản lý lớp học", volume: 140, cpc: 0.33, competition: 0.2, difficulty: null },
  { keyword: "quản lý học sinh", volume: 140, cpc: 0, competition: 0.05, difficulty: null },
  { keyword: "app điểm danh học sinh", volume: 110, cpc: 0.27, competition: 0.23, difficulty: null },
  { keyword: "phần mềm quản lý trường học", volume: 110, cpc: 0.29, competition: 0.33, difficulty: null },
  { keyword: "app classroom", volume: 90, cpc: 0, competition: 0.13, difficulty: null },
];

function difficultyLabel(d: number | null) {
  if (d == null) return { label: "—", variant: "secondary" as const };
  if (d < 30) return { label: `${d}/100 · Dễ`, variant: "default" as const };
  if (d < 50) return { label: `${d}/100 · Vừa`, variant: "secondary" as const };
  if (d < 70) return { label: `${d}/100 · Khó`, variant: "outline" as const };
  return { label: `${d}/100 · Rất khó`, variant: "destructive" as const };
}

function competitionLabel(c: number | null) {
  if (c == null) return "—";
  if (c < 0.33) return `${c.toFixed(2)} (thấp)`;
  if (c < 0.66) return `${c.toFixed(2)} (vừa)`;
  return `${c.toFixed(2)} (cao)`;
}

const COLORS = ["hsl(var(--primary))", "hsl(var(--primary) / 0.7)", "hsl(var(--muted-foreground) / 0.5)"];

export default function SeoKeywordsPage() {
  const totalVolume = targetKeywords.reduce((sum, k) => sum + (k.volume ?? 0), 0);
  const avgCpc =
    targetKeywords.filter((k) => k.cpc != null).reduce((s, k) => s + (k.cpc ?? 0), 0) /
    Math.max(1, targetKeywords.filter((k) => k.cpc != null).length);
  const easiestKw = [...targetKeywords]
    .filter((k) => k.difficulty != null)
    .sort((a, b) => (a.difficulty ?? 99) - (b.difficulty ?? 99))[0];

  const chartData = [...targetKeywords, ...relatedKeywords]
    .filter((k) => k.volume != null && k.volume > 0)
    .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
    .slice(0, 10)
    .map((k) => ({ keyword: k.keyword, volume: k.volume }));

  return (
    <div>
      <PageHeader
        title="Nghiên cứu từ khóa SEO"
        description={
          <>
            Theo dõi search volume các từ khóa mục tiêu tại{" "}
            <span className="font-medium">Việt Nam</span>. Nguồn: {DATA_SOURCE}. Cập nhật:{" "}
            {SNAPSHOT_DATE}.
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tổng search volume / tháng
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-display font-semibold">{totalVolume.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Cộng dồn 3 từ khóa mục tiêu</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">CPC trung bình</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-display font-semibold">${avgCpc.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Giá thầu Google Ads</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cơ hội tốt nhất</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-display font-semibold truncate">{easiestKw?.keyword ?? "—"}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Độ khó {easiestKw?.difficulty}/100 · {easiestKw?.volume} lượt/tháng
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flag className="h-4 w-4" />
            Từ khóa mục tiêu — Việt Nam
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Từ khóa</TableHead>
                <TableHead className="text-right">Volume/tháng</TableHead>
                <TableHead className="text-right">CPC</TableHead>
                <TableHead>Cạnh tranh Ads</TableHead>
                <TableHead>Độ khó SEO</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {targetKeywords.map((k) => {
                const diff = difficultyLabel(k.difficulty);
                return (
                  <TableRow key={k.keyword}>
                    <TableCell className="font-medium">
                      {k.keyword}
                      {k.note && (
                        <div className="text-xs text-muted-foreground mt-0.5">{k.note}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {k.volume != null ? k.volume.toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {k.cpc != null ? `$${k.cpc.toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {competitionLabel(k.competition)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={diff.variant}>{diff.label}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top 10 từ khóa theo volume</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis
                  type="category"
                  dataKey="keyword"
                  width={170}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [`${v.toLocaleString()} lượt/tháng`, "Volume"]}
                />
                <Bar dataKey="volume" radius={[0, 4, 4, 0]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Từ khóa liên quan đáng cân nhắc</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Từ khóa</TableHead>
                  <TableHead className="text-right">Volume</TableHead>
                  <TableHead className="text-right">CPC</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {relatedKeywords.map((k) => (
                  <TableRow key={k.keyword}>
                    <TableCell className="font-medium">{k.keyword}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {k.volume?.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {k.cpc != null ? `$${k.cpc.toFixed(2)}` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Dữ liệu lấy từ Semrush (snapshot {SNAPSHOT_DATE}). Để tự động cập nhật theo thời gian thực, cần
        tích hợp Semrush API qua edge function — yêu cầu API key trả phí từ Semrush.
      </p>
    </div>
  );
}