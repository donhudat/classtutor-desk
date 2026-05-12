import { supabase } from "@/integrations/supabase/client";

export type StoredFile = {
  path: string;
  name: string;
  size: number;
  mime: string;
};

export const ALLOWED_MIME = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/zip",
  "text/plain",
];

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_FILES = 5;

export function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) return `${file.name}: vượt quá 10MB`;
  if (!ALLOWED_MIME.includes(file.type) && file.type !== "")
    return `${file.name}: định dạng không được hỗ trợ`;
  return null;
}

function safeFileName(name: string) {
  // Supabase Storage chỉ chấp nhận ký tự ASCII an toàn cho key.
  // Bỏ dấu tiếng Việt, thay khoảng trắng và ký tự lạ bằng "_".
  const dotIdx = name.lastIndexOf(".");
  const base = dotIdx > 0 ? name.slice(0, dotIdx) : name;
  const ext = dotIdx > 0 ? name.slice(dotIdx) : "";
  const normalize = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // bỏ dấu
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^[_.-]+|[_.-]+$/g, "");
  const safeBase = normalize(base) || "file";
  const safeExt = ext ? "." + normalize(ext.slice(1)) : "";
  return (safeBase + safeExt).slice(0, 200);
}

export async function uploadFile(
  bucket: string,
  pathPrefix: string,
  file: File,
): Promise<StoredFile> {
  const ts = Date.now();
  const fname = `${ts}-${safeFileName(file.name)}`;
  const path = `${pathPrefix.replace(/\/$/, "")}/${fname}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw error;
  return {
    path,
    name: file.name,
    size: file.size,
    mime: file.type || "application/octet-stream",
  };
}

export async function getSignedUrl(bucket: string, path: string, expiresIn = 300) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteFile(bucket: string, path: string) {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw error;
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}