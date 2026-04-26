import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Trash2, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/features/layout/PageHeader";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { CreateUserDialog } from "@/features/students/CreateUserDialog";
import { EditUserDialog, type EditingUser } from "@/features/students/EditUserDialog";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

type ParentRow = {
  id: number;
  phone: string | null;
  user_id: string;
  profiles: { full_name: string; login_id: string } | null;
  students: { id: number }[] | null;
};

export default function ParentsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<EditingUser | null>(null);
  const [q, setQ] = useState("");

  const parentsQ = useQuery({
    queryKey: ["parents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parents")
        .select(`
          id, phone, user_id,
          profiles:profiles!parents_user_id_fkey(full_name, login_id),
          students:students!students_parent_id_fkey(id)
        `)
        .is("deleted_at", null)
        .order("id", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ParentRow[];
    },
  });

  const filtered = useMemo(() => {
    const list = parentsQ.data ?? [];
    if (!q.trim()) return list;
    const k = q.toLowerCase();
    return list.filter(
      (p) =>
        p.profiles?.full_name?.toLowerCase().includes(k) ||
        p.profiles?.login_id?.toLowerCase().includes(k),
    );
  }, [parentsQ.data, q]);

  const softDelete = async (id: number) => {
    const { error } = await supabase
      .from("parents")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Đã xoá phụ huynh" });
    qc.invalidateQueries({ queryKey: ["parents"] });
  };

  return (
    <div>
      <PageHeader
        title="Phụ huynh"
        description="Tài khoản phụ huynh để theo dõi tiến độ con."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Thêm phụ huynh
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
              <TableHead>SĐT</TableHead>
              <TableHead>Số con</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {parentsQ.isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">Đang tải…</TableCell>
              </TableRow>
            )}
            {!parentsQ.isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center">
                  <p className="font-display text-lg">Chưa có phụ huynh nào</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Bấm <strong>Thêm phụ huynh</strong> để bắt đầu.
                  </p>
                </TableCell>
              </TableRow>
            )}
            {filtered.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.profiles?.full_name ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  @{p.profiles?.login_id}
                </TableCell>
                <TableCell>{p.phone ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{p.students?.length ?? 0}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        setEditing({
                          id: p.id,
                          user_id: p.user_id,
                          full_name: p.profiles?.full_name ?? "",
                          phone: p.phone,
                        });
                        setEditOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Xoá phụ huynh?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Liên kết với học sinh sẽ vẫn còn nhưng phụ huynh không truy cập được nữa.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Huỷ</AlertDialogCancel>
                        <AlertDialogAction onClick={() => softDelete(p.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Xoá
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <CreateUserDialog
        open={open}
        onOpenChange={setOpen}
        role="parent"
        onCreated={() => qc.invalidateQueries({ queryKey: ["parents"] })}
      />

      <EditUserDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        role="parent"
        editing={editing}
        onSaved={() => qc.invalidateQueries({ queryKey: ["parents"] })}
      />
    </div>
  );
}
