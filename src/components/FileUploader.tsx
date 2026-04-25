import { useRef, useState } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  uploadFile,
  validateFile,
  formatFileSize,
  MAX_FILES,
  type StoredFile,
} from "@/lib/storage";

export function FileUploader({
  bucket,
  pathPrefix,
  files,
  onChange,
  maxFiles = MAX_FILES,
  disabled,
}: {
  bucket: string;
  pathPrefix: string;
  files: StoredFile[];
  onChange: (next: StoredFile[]) => void;
  maxFiles?: number;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onPick = async (list: FileList | null) => {
    if (!list?.length) return;
    const slots = maxFiles - files.length;
    if (slots <= 0) {
      toast({ title: `Tối đa ${maxFiles} file`, variant: "destructive" });
      return;
    }
    const picked = Array.from(list).slice(0, slots);
    setBusy(true);
    const uploaded: StoredFile[] = [];
    for (const f of picked) {
      const err = validateFile(f);
      if (err) {
        toast({ title: "Bỏ qua file", description: err, variant: "destructive" });
        continue;
      }
      try {
        const sf = await uploadFile(bucket, pathPrefix, f);
        uploaded.push(sf);
      } catch (e: any) {
        toast({ title: `Lỗi upload ${f.name}`, description: e.message, variant: "destructive" });
      }
    }
    setBusy(false);
    if (uploaded.length) onChange([...files, ...uploaded]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const remove = (idx: number) => {
    const next = [...files];
    next.splice(idx, 1);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || busy || files.length >= maxFiles}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-1 h-4 w-4" />
          )}
          {busy ? "Đang tải lên…" : "Chọn file"}
        </Button>
        <span className="text-xs text-muted-foreground">
          {files.length}/{maxFiles} • PDF, DOC, XLS, ảnh, ZIP — tối đa 10MB/file
        </span>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.zip,.txt"
        onChange={(e) => onPick(e.target.files)}
      />
      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((f, i) => (
            <li
              key={f.path}
              className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-1.5 text-sm"
            >
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="text-xs text-muted-foreground">{formatFileSize(f.size)}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Gỡ file"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}