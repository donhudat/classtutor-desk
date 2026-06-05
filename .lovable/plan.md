## Vấn đề
Trong dialog "Sinh buổi học từ lịch" hiện đã có ô chọn lớp (Popover + Command), nhưng người dùng không thấy / không bấm được. Nguyên nhân có thể:
- Popover render bằng Portal và bị layering của Dialog che (cùng `z-50`), hoặc click bên trong dialog bị Radix coi là outside → đóng ngay.
- Trigger trông giống Input nên dễ bị bỏ qua, và danh sách lớp chỉ hiện khi mở popover (1 thao tác phụ).

## Hướng sửa
Thay Popover bằng **danh sách checkbox hiển thị thẳng** trong dialog — không có layer phụ, không bị che, không cần bấm mở.

Bố cục mới trong `GenerateSessionsDialog.tsx`:

```text
[Label] Lớp                          [Chọn tất cả] [Bỏ chọn]
┌──────────────────────────────────────────────────┐
│  ☑ Lớp Toán 8A         T2 / T5                   │
│  ☐ Lớp Văn 9B          T3 / T6                   │
│  ☑ Lớp Anh nâng cao    T4 / T7                   │
│  ... (scroll dọc, max-h ~ 200px)                 │
└──────────────────────────────────────────────────┘
Đang chọn: 2/5 lớp. Để trống = sinh cho tất cả.

[Từ ngày] [Đến ngày]
[Preview tổng số buổi]
```

Chi tiết:
- Danh sách dùng `ScrollArea` / div `max-h-48 overflow-auto` + `Checkbox` shadcn cho từng lớp.
- Hai nút nhỏ: **Chọn tất cả** (set = mọi id), **Bỏ chọn** (set = []).
- Preview phía dưới vẫn dùng `targetClasses` (lọc theo `selectedClassIds`; rỗng = tất cả).
- Logic submit (insert + soft-delete) giữ nguyên — vẫn `.in("class_id", targetClassIds)`.
- Bỏ import `Popover`, `Command*`, `ChevronDown`, `X` không còn cần.

## File chỉnh sửa
- `src/features/sessions/GenerateSessionsDialog.tsx` — chỉ phần UI chọn lớp; phần date + submit không đổi.

Không đụng backend, không đổi schema, không đụng `Sessions.tsx`.