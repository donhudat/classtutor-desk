import { useState } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Copy, Check, AlertCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const schema = z.object({
  full_name: z.string().trim().min(1, "Nhập họ tên").max(100),
  login_id: z
    .string()
    .trim()
    .min(3, "Tối thiểu 3 ký tự")
    .max(40)
    .regex(/^[a-z0-9_]+$/i, "Chỉ chữ, số, _"),
  phone: z.string().trim().max(20).optional(),
  date_of_birth: z.string().optional(),
  parent_id: z.string().optional(),
});

export function CreateUserDialog({
  open,
  onOpenChange,
  role,
  parents = [],
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  role: "student" | "parent";
  parents?: { id: number; full_name: string }[];
  onCreated?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ login_id: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    login_id: "",
    phone: "",
    date_of_birth: "",
    parent_id: "",
  });

  const reset = () => {
    setForm({ full_name: "", login_id: "", phone: "", date_of_birth: "", parent_id: "" });
    setResult(null);
    setCopied(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast({ title: "Lỗi", description: parsed.error.errors[0].message, variant: "destructive" });
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("create-managed-user", {
      body: {
        role,
        full_name: parsed.data.full_name,
        login_id: parsed.data.login_id,
        phone: parsed.data.phone || null,
        date_of_birth: role === "student" ? parsed.data.date_of_birth || null : null,
        parent_id:
          role === "student" && parsed.data.parent_id
            ? Number(parsed.data.parent_id)
            : null,
      },
    });
    setLoading(false);
    if (error || (data as any)?.error) {
      const msg = (data as any)?.error
        ? typeof (data as any).error === "string"
          ? (data as any).error
          : "Dữ liệu không hợp lệ"
        : error?.message ?? "Lỗi";
      toast({ title: "Tạo thất bại", description: msg, variant: "destructive" });
      return;
    }
    setResult({ login_id: (data as any).login_id, password: (data as any).password });
    onCreated?.();
  };

  const close = () => {
    onOpenChange(false);
    setTimeout(reset, 200);
  };

  const copyAll = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(
      `Login ID: ${result.login_id}\nMật khẩu: ${result.password}`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogContent>
        {!result ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-xl">
                Thêm {role === "student" ? "học sinh" : "phụ huynh"}
              </DialogTitle>
              <DialogDescription>
                Hệ thống sẽ tạo tài khoản và sinh mật khẩu ngẫu nhiên — bạn copy gửi cho họ.
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
                <Label>Login ID</Label>
                <Input
                  value={form.login_id}
                  onChange={(e) => setForm({ ...form, login_id: e.target.value })}
                  placeholder="vd: an_nguyen"
                  required
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Chỉ chữ, số, dấu gạch dưới. Học sinh dùng để đăng nhập.
                </p>
              </div>
              <div>
                <Label>Số điện thoại (tuỳ chọn)</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              {role === "student" && (
                <>
                  <div>
                    <Label>Ngày sinh (tuỳ chọn)</Label>
                    <Input
                      type="date"
                      value={form.date_of_birth}
                      onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Phụ huynh (tuỳ chọn)</Label>
                    <Select
                      value={form.parent_id}
                      onValueChange={(v) => setForm({ ...form, parent_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn phụ huynh…" />
                      </SelectTrigger>
                      <SelectContent>
                        {parents.length === 0 && (
                          <div className="px-3 py-2 text-sm text-muted-foreground">
                            Chưa có phụ huynh
                          </div>
                        )}
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
                <Button type="button" variant="outline" onClick={close}>
                  Huỷ
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Đang tạo…" : "Tạo tài khoản"}
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-xl">Tạo thành công</DialogTitle>
              <DialogDescription>
                <span className="inline-flex items-center gap-1 text-warning">
                  <AlertCircle className="h-4 w-4" /> Mật khẩu chỉ hiển thị một lần — hãy copy ngay.
                </span>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 rounded-md border border-border bg-muted/40 p-4 font-mono text-sm">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Login ID</div>
                <div className="font-semibold">{result.login_id}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Mật khẩu</div>
                <div className="font-semibold">{result.password}</div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={copyAll}>
                {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                {copied ? "Đã copy" : "Copy"}
              </Button>
              <Button onClick={close}>Xong</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
