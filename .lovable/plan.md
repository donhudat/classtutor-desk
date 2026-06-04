## Mục tiêu
1. Trang **Buổi học** cho lọc theo **nhiều lớp** và **nhiều học sinh** cùng lúc (1 học sinh có thể học nhiều lớp).
2. Thêm **điểm danh nhanh inline** trên từng buổi ở tab Danh sách, không cần mở trang riêng.

## 1. Bộ lọc multi-select (lớp + học sinh)

- Thay 2 `Select` đơn lẻ bằng 2 dropdown multi-select dạng popover với search + checkbox (dùng `Command` + `Popover` của shadcn — đã có sẵn).
- Hiển thị dạng "Tất cả lớp" / "3 lớp đã chọn" + chip nhỏ để xoá nhanh.
- Load danh sách học sinh: query `students` join `profiles(full_name, login_id)` của tenant hiện tại, sort theo tên.
- Logic lọc sessions:
  - Nếu chọn lớp → `class_id in (...)`.
  - Nếu chọn học sinh → lấy các `class_id` từ `class_enrollments` (chưa xoá, còn hiệu lực) của các học sinh đó, intersect với filter lớp (nếu có), rồi `class_id in (...)`.
  - Nếu cả 2 đều rỗng → giữ nguyên hành vi cũ (tất cả).
- State filter lưu mảng `number[]` cho cả `classFilter` và `studentFilter`.

## 2. Điểm danh nhanh inline

Trong từng card buổi học ở tab **Danh sách**, thêm nút **"Điểm danh nhanh"** mở 1 **inline expand** (collapsible) ngay dưới card — không phải dialog, để dễ thao tác nhiều buổi liên tiếp.

Khi mở:
- Fetch học sinh trong lớp (cùng logic Attendance.tsx đã sửa: enrollments chưa xoá + chưa end).
- Fetch attendance hiện có của session.
- Hiển thị bảng gọn: tên học sinh + 4 nút trạng thái (Có mặt / Trễ / Vắng / Vắng có phép), 1 nút "Tất cả có mặt" ở đầu.
- Bỏ phần ghi chú từng học sinh + nhận xét phụ huynh ở chế độ nhanh (nếu cần chi tiết thì vẫn có nút "Mở trang đầy đủ" link tới `/attendance/:id`).
- Nút **Lưu**: upsert `attendances`, set `class_sessions.attendance_taken_at` + `status='completed'`, invalidate query để refresh badge "Đã điểm danh".

Component mới: `src/features/sessions/QuickAttendance.tsx` — nhận `sessionId`, `classId`, callback `onSaved`.

## 3. Files cần đổi

- `src/pages/Sessions.tsx`: filter UI multi-select, query học sinh, logic lọc, render `QuickAttendance` khi expand.
- `src/features/sessions/QuickAttendance.tsx` (mới): UI điểm danh nhanh.
- Tab **Lịch tháng** giữ nguyên (vẫn dùng filter đã chọn).

## Chi tiết kỹ thuật
- Không sửa schema/backend, không sửa RLS.
- `MultiSelect` triển khai inline trong `Sessions.tsx` bằng `Popover + Command + CommandInput + CommandItem` của shadcn.
- React Query keys: bổ sung `studentFilter` vào key của `sessions` query để re-fetch đúng khi đổi filter.
