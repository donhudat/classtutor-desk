import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/features/layout/PageHeader";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { CreateUserDialog } from "@/features/students/CreateUserDialog";
import { formatDate } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type StudentRow = {
  id: number;
  date_of_birth: string | null;
  parent_id: number | null;
  user_id: string;
  profiles: { full_name: string; login_id: string; phone: string | null } | null;
  parents: { profiles: { full_name: string } | null } | null;
};

export default function StudentsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const studentsQ = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select(`
          id, date_of_birth, parent_id, user_id,
          profiles:profiles!students_user_id_fkey(full_name, login_id, phone),
          parents:parents!students_parent_id_fkey(
            profiles:profiles!parents_user_id_fkey(full_name)
          )
        `)
        .is("deleted_at", null)
        .order("id", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as StudentRow[];
    },
  });

  const parentsQ = useQuery({
    queryKey: ["parents-lite"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parents")
        .select("id, profiles:profiles!parents_user_id_fkey(full_name)")
        .is("deleted_at", null)
        .order("id", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as any[]).map((p) => ({
        id: p.id as number,
        full_name: p.profiles?.full_name ?? `Phụ huynh #${p.id}`,
      }));
    },
  });

  const filtered = useMemo(() => {
    const list = studentsQ.data ?? [];
    if (!q.trim()) return list;
    const k = q.toLowerCase();
    return list.filter(
      (s) =>
        s.profiles?.full_name?.toLowerCase().includes(k) ||
        s.profiles?.login_id?.toLowerCase().includes(k),
    );
  }, [studentsQ.data, q]);

  const softDelete = async (id: number) => {
    const { error } = await supabase
      .from("students")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Đã xoá học sinh" });
    qc.invalidateQueries({ queryKey: ["students"] });
  };

  return (
    <div>
      <PageHeader
        title="Học sinh"
        description="Quản lý danh sách học sinh trong các lớp của bạn."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Thêm học sinh
          </Button>
        }
      />

      <Card className="border-border/80">
        <div className="flex items-center gap-2 border-b border-border p-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm theo tên hoặc login ID…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-8 max-w-sm border-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Họ tên</TableHead>
              <TableHead>Login ID</TableHead>
              <TableHead>Ngày sinh</TableHead>
              <TableHead>Phụ huynh</TableHead>
              <TableHead>SĐT</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {studentsQ.isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Đang tải…
                </TableCell>
              </TableRow>
            )}
            {!studentsQ.isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center">
                  <div className="mx-auto max-w-xs">
                    <p className="font-display text-lg">Chưa có học sinh nào</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Bấm <strong>Thêm học sinh</strong> để tạo tài khoản đầu tiên.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {filtered.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.profiles?.full_name ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  @{s.profiles?.login_id}
                </TableCell>
                <TableCell>{formatDate(s.date_of_birth)}</TableCell>
                <TableCell>{s.parents?.profiles?.full_name ?? "—"}</TableCell>
                <TableCell>{s.profiles?.phone ?? "—"}</TableCell>
                <TableCell>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Xoá học sinh?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Học sinh sẽ bị ẩn khỏi danh sách. Dữ liệu lịch sử (điểm danh, học phí) vẫn được giữ.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Huỷ</AlertDialogCancel>
                        <AlertDialogAction onClick={() => softDelete(s.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Xoá
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <CreateUserDialog
        open={open}
        onOpenChange={setOpen}
        role="student"
        parents={parentsQ.data ?? []}
        onCreated={() => qc.invalidateQueries({ queryKey: ["students"] })}
      />
    </div>
  );
}
