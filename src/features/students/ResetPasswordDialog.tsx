import { useEffect, useState } from "react";
import { Copy, Check, AlertCircle, KeyRound } from "lucide-react";
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

export function ResetPasswordDialog({
  open,
  onOpenChange,
  userId,
  fullName,
  loginId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string | null;
  fullName?: string;
  loginId?: string;
}) {
  const [mode, setMode] = useState<"random" | "custom">("random");
  const [custom, setCustom] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ login_id: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setMode("random");
      setCustom("");
      setResult(null);
      setCopied(false);
    }
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    if (mode === "custom") {
      if (custom.length < 6 || custom.length > 72) {
        toast({
          title: "Mật khẩu không hợp lệ",
          description: "Từ 6 đến 72 ký tự.",
          variant: "destructive",
        });
        return;
      }
    }
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("reset-managed-password", {
      body: {
        user_id: userId,
        new_password: mode === "custom" ? custom : null,
      },
    });
    setLoading(false);
    if (error || (data as any)?.error) {
      const msg = (data as any)?.error
        ? typeof (data as any).error === "string"
          ? (data as any).error
          : "Không reset được"
        : error?.message ?? "Lỗi";
      toast({ title: "Reset thất bại", description: msg, variant: "destructive" });
      return;
    }
    setResult({ login_id: (data as any).login_id, password: (data as any).password });
  };

  const copyAll = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(
      `Login ID: ${result.login_id}\nMật khẩu mới: ${result.password}`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {!result ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-xl flex items-center gap-2">
                <KeyRound className="h-5 w-5" /> Đặt lại mật khẩu
              </DialogTitle>
              <DialogDescription>
                {fullName ? <strong>{fullName}</strong> : "Người dùng"}
                {loginId && <span className="ml-1 text-muted-foreground">(@{loginId})</span>}
                {" "}— mật khẩu cũ sẽ ngừng dùng được ngay.
              </DialogDescription>
            </DialogHeader>
            <form className="space-y-4" onSubmit={submit}>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={mode === "random"}
                    onChange={() => setMode("random")}
                  />
                  Sinh mật khẩu ngẫu nhiên
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={mode === "custom"}
                    onChange={() => setMode("custom")}
                  />
                  Tự nhập mật khẩu
                </label>
              </div>
              {mode === "custom" && (
                <div>
                  <Label>Mật khẩu mới</Label>
                  <Input
                    type="text"
                    value={custom}
                    onChange={(e) => setCustom(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự"
                    autoComplete="off"
                  />
                </div>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Huỷ
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Đang xử lý…" : "Đặt lại"}
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-xl">Đã đặt lại</DialogTitle>
              <DialogDescription>
                <span className="inline-flex items-center gap-1 text-warning">
                  <AlertCircle className="h-4 w-4" /> Mật khẩu chỉ hiển thị một lần — copy ngay.
                </span>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 rounded-md border border-border bg-muted/40 p-4 font-mono text-sm">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Login ID</div>
                <div className="font-semibold">{result.login_id}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Mật khẩu mới</div>
                <div className="font-semibold">{result.password}</div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={copyAll}>
                {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                {copied ? "Đã copy" : "Copy"}
              </Button>
              <Button onClick={() => onOpenChange(false)}>Xong</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}