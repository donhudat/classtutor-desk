import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FileUploader } from "@/components/FileUploader";
import { FileList } from "@/components/FileList";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/features/auth/AuthProvider";
import type { StoredFile } from "@/lib/storage";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  assignmentId: number;
  studentId: number;
  assignmentTitle: string;
  onSaved?: () => void;
};

type SubFile = {
  id: number;
  file_name: string;
  file_size: number;
  storage_path: string;
  mime_type: string;
};

export function SubmitAssignmentDialog({
  open,
  onOpenChange,
  assignmentId,
  studentId,
  assignmentTitle,
  onSaved,
}: Props) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [content, setContent] = useState("");
  const [newFiles, setNewFiles] = useState<StoredFile[]>([]);
  const [busy, setBusy] = useState(false);

  const subQ = useQuery({
    queryKey: ["my-submission", assignmentId, studentId],
    enabled: open && !!assignmentId && !!studentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("submissions")
        .select("id, content, status, score, feedback, submitted_at, returned_at")
        .eq("assignment_id", assignmentId)
        .eq("student_id", studentId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const filesQ = useQuery({
    queryKey: ["my-submission-files", subQ.data?.id],
    enabled: !!subQ.data?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("submission_files")
        .select("id, file_name, file_size, storage_path, mime_type")
        .eq("submission_id", subQ.data!.id);
      if (error) throw error;
      return (data ?? []) as SubFile[];
    },
  });

  useEffect(() => {
    if (open) {
      setContent(subQ.data?.content ?? "");
      setNewFiles([]);
    }
  }, [open, subQ.data]);

  const locked =
    subQ.data?.status === "graded" || subQ.data?.status === "returned";

  const submit = async () => {
    if (!profile) return;
    setBusy(true);
    try {
      let submissionId = subQ.data?.id;
      if (!submissionId) {
        const { data, error } = await supabase
          .from("submissions")
          .insert({
            assignment_id: assignmentId,
            student_id: studentId,
            tenant_id: profile.tenant_id,
            content: content.trim() || null,
            status: "submitted",
            submitted_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        if (error) throw error;
        submissionId = data.id;
      } else {
        const { error } = await supabase
          .from("submissions")
          .update({
            content: content.trim() || null,
            status: "submitted",
            submitted_at: new Date().toISOString(),
          })
          .eq("id", submissionId);
        if (error) throw error;
      }

      if (newFiles.length > 0 && submissionId) {
        const rows = newFiles.map((f) => ({
          submission_id: submissionId!,
          tenant_id: profile.tenant_id,
          file_name: f.name,
          file_size: f.size,
          mime_type: f.mime,
          storage_path: f.path,
        }));
        const { error } = await supabase.from("submission_files").insert(rows);
        if (error) throw error;
      }
      toast({ title: "Đã nộp bài" });
      qc.invalidateQueries({ queryKey: ["my-assignments"] });
      qc.invalidateQueries({ queryKey: ["my-submission", assignmentId, studentId] });
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Lỗi", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const existingAsStored: StoredFile[] = (filesQ.data ?? []).map((f) => ({
    path: f.storage_path,
    name: f.file_name,
    size: f.file_size,
    mime: f.mime_type,
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nộp bài: {assignmentTitle}</DialogTitle>
          <DialogDescription>
            {locked
              ? "Bài đã được chấm — không thể chỉnh sửa."
              : "Tải file bài làm hoặc nhập nội dung trả lời."}
          </DialogDescription>
        </DialogHeader>

        {existingAsStored.length > 0 && (
          <div className="space-y-2">
            <Label>File đã nộp</Label>
            <FileList bucket="submission-files" files={existingAsStored} />
          </div>
        )}

        <div className="space-y-2">
          <Label>{existingAsStored.length > 0 ? "Tải thêm file" : "Tải file bài làm"}</Label>
          <FileUploader
            bucket="submission-files"
            pathPrefix={`${profile?.tenant_id ?? 0}/${assignmentId}/${studentId}`}
            files={newFiles}
            onChange={setNewFiles}
            disabled={locked}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="content">Ghi chú / nội dung</Label>
          <Textarea
            id="content"
            rows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={locked}
            placeholder="Nội dung trả lời (tuỳ chọn)"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
          <Button onClick={submit} disabled={busy || locked}>
            {busy ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-1 h-4 w-4" />
            )}
            Nộp bài
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}