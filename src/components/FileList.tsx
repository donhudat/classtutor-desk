import { useState } from "react";
import { Download, Loader2, File } from "lucide-react";
import { formatFileSize, type StoredFile } from "@/lib/storage";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export function FileList({
  bucket,
  files,
  emptyText = "Chưa có file",
  compact,
}: {
  bucket: string;
  files: StoredFile[];
  emptyText?: string;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  const download = async (f: StoredFile) => {
    setBusy(f.path);
    try {
      // Tải qua SDK (blob) để tránh trình chặn quảng cáo (ERR_BLOCKED_BY_CLIENT)
      const { data, error } = await supabase.storage.from(bucket).download(f.path);
      if (error) throw error;
      const blobUrl = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = f.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      const blocked = /Failed to fetch|NetworkError|blocked/i.test(msg);
      toast({
        title: "Không tải được file",
        description: blocked
          ? "Có thể trình duyệt/AdBlock đang chặn miền backend. Hãy tắt AdBlock cho trang này rồi thử lại."
          : msg,
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  if (files.length === 0) {
    return <p className="text-xs text-muted-foreground">{emptyText}</p>;
  }

  return (
    <ul className={compact ? "flex flex-wrap gap-1" : "space-y-1"}>
      {files.map((f) => (
        <li key={f.path}>
          <button
            type="button"
            onClick={() => download(f)}
            disabled={busy === f.path}
            className={
              compact
                ? "inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs hover:bg-muted"
                : "flex w-full items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-muted"
            }
          >
            {busy === f.path ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <File className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span className="min-w-0 flex-1 truncate text-left">{f.name}</span>
            {!compact && (
              <span className="text-xs text-muted-foreground">{formatFileSize(f.size)}</span>
            )}
            <Download className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </li>
      ))}
    </ul>
  );
}