import { useEffect, useState } from "react";
import { z } from "zod";
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

export type EditingUser = {
  // record id (students.id or parents.id)
  id: number;
  // auth user id linked to profiles.id
  user_id: string;
  full_name: string;
  phone: string | null;
  date_of_birth?: string | null; // student only
  parent_id?: number | null; // student only
};

const schema = z.object({
  full_name: z.string().trim().min(1, "Nhập họ tên").max(100),
  phone: z.string().trim().max(20).optional(),
  date_of_birth: z.string().optional(),
  parent_id: z.string().optional(),
});

export function EditUserDialog({
  open,
  onOpenChange,
  role,
  editing,
  parents = [],
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  role: "student" | "parent";
  editing: EditingUser | null;
  parents?: { id: number; full_name: string }[];
  onSaved?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    date_of_birth: "",
    parent_id: "none",
  });

  useEffect(() => {
    if (!open || !editing) return;
    setForm({
      full_name: editing.full_name ?? "",
      phone: editing.phone ?? "",
      date_of_birth: editing.date_of_birth ?? "",
      parent_id: editing.parent_id ? String(editing.parent_id) : "none",
    });
  }, [open, editing]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast({ title: "Lỗi", description: parsed.error.errors[0].message, variant: "destructive" });
      return;
    }
    setLoading(true);

    // 1) profiles: full_name, phone
    const { error: pErr } = await supabase
      .from("profiles")
      .update({
        full_name: parsed.data.full_name,
        phone: parsed.data.phone || null,
      })
      .eq("id", editing.user_id);

    if (pErr) {
      setLoading(false);
      toast({ title: "Lỗi", description: pErr.message, variant: "destructive" });
      return;
    }

    // 2) per-role table
    if (role === "student") {
      const { error } = await supabase
        .from("students")
        .update({
          date_of_birth: parsed.data.date_of_birth || null,
          parent_id:
            parsed.data.parent_id && parsed.data.parent_id !== "none"
              ? Number(parsed.data.parent_id)
              : null,
        })
        .eq("id", editing.id);
      if (error) {
        setLoading(false);
        toast({ title: "Lỗi", description: error.message, variant: "destructive" });
        return;
      }
    } else {
      const { error } = await supabase
        .from("parents")
        .update({ phone: parsed.data.phone || null })
        .eq("id", editing.id);
      if (error) {
        setLoading(false);
        toast({ title: "Lỗi", description: error.message, variant: "destructive" });
        return;
      }
    }

    setLoading(false);
    toast({ title: "Đã lưu" });
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            Sửa {role === "student" ? "học sinh" : "phụ huynh"}
          </DialogTitle>
          <DialogDescription>
            Cập nhật thông tin cá nhân. Login ID và mật khẩu không thay đổi.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div>
            <Label>Họ và tên</Label>
            <Input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              required
            />
          </div>
          <div>
            <Label>Số điện thoại</Label>
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          {role === "student" && (
            <>
              <div>
                <Label>Ngày sinh</Label>
                <Input
                  type="date"
                  value={form.date_of_birth}
                  onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
                />
              </div>
              <div>
                <Label>Phụ huynh</Label>
                <Select
                  value={form.parent_id}
                  onValueChange={(v) => setForm({ ...form, parent_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn phụ huynh…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Không có —</SelectItem>
                    {parents.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
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