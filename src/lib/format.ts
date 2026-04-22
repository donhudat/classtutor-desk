export const formatVND = (n: number | null | undefined) =>
  typeof n === "number"
    ? n.toLocaleString("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 })
    : "—";

export const formatDate = (iso: string | Date | null | undefined) => {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
};

export const formatDateTime = (iso: string | Date | null | undefined) => {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};
