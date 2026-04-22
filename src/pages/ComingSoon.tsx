import { PageHeader } from "@/features/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

export default function ComingSoon({ title }: { title: string }) {
  return (
    <div>
      <PageHeader title={title} description="Tính năng này sẽ có ở các bản cập nhật tiếp theo." />
      <Card className="border-dashed border-border/80 bg-card/40">
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <Construction className="h-10 w-10 text-muted-foreground" />
          <p className="font-display text-xl">Đang phát triển</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Phần <strong>{title}</strong> sẽ được triển khai trong giai đoạn tiếp theo cùng với điểm danh, bài tập và học phí.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
