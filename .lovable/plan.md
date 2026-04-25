
# Iteration #2.5 — Hoàn thiện Lớp / Buổi / Bài tập

Bạn chỉ ra 4 lỗ hổng đúng:

1. Tạo lớp xong **chưa gắn được học sinh/phụ huynh ngay trong form** (phải mở dialog riêng), và **chưa thấy phụ huynh** trong danh sách lớp.
2. **Học phí mỗi buổi** đang nằm trong dialog enrollments — ổn về mặt data nhưng UX rời rạc, cần hiển thị tổng quan trong card lớp.
3. **Buổi học** đang là list dọc — cần **calendar view** (tháng/tuần) để nhìn tổng thể như ảnh ref `image-2.png`.
4. **Bài tập**:
   - Chưa gắn được vào **buổi học cụ thể** (cột `session_id` đã có trong DB nhưng UI không dùng).
   - Chưa có **upload file đính kèm bài tập** (đề bài) và **upload file bài nộp** (học sinh) → tải lại để giáo viên chấm.
   - Học sinh/phụ huynh chưa có UI xem bài tập → cần page riêng + RLS đã sẵn sàng.

---

## Phần 1 — Storage & DB

### 1.1 Tạo Storage Buckets (private)
- `assignment-attachments` — file đề bài giáo viên đính kèm
- `submission-files` — file học sinh nộp

Cả 2 đều **private**, đường dẫn theo convention: `{tenant_id}/{assignment_id}/{filename}` và `{tenant_id}/{assignment_id}/{student_id}/{filename}`.

### 1.2 RLS policies cho storage (qua `storage.objects`)

**`assignment-attachments`**:
- Teacher cùng tenant: full CRUD (check `(storage.foldername(name))[1] = current_tenant_id()::text AND is_teacher()`).
- Student/Parent: SELECT nếu thuộc lớp của assignment đó (join qua `assignments.class_id` + `is_student_in_class` / `is_parent_child_in_class`).

**`submission-files`**:
- Teacher cùng tenant: SELECT/DELETE.
- Student: INSERT/SELECT chỉ file của chính mình (`(storage.foldername(name))[3] = student_id_của_user::text`).
- Parent: SELECT file của con.

### 1.3 Bổ sung bảng
- Thêm cột `attachments jsonb default '[]'` vào `assignments` để lưu metadata file đề bài (tên, path, size, mime). **Lý do**: tránh tạo bảng `assignment_files` riêng cho metadata nhẹ; file binary vẫn ở Storage.
- Bảng `submission_files` đã có sẵn — sẽ dùng nguyên.

### 1.4 Migration cleanup
- Bổ sung **trigger** `set_updated_at` cho các bảng còn thiếu (assignments, submissions, class_sessions...) — hiện tại function `set_updated_at` đã có nhưng chưa attach.

---

## Phần 2 — Lớp học (Classes)

### 2.1 Card lớp hiển thị thêm
- Số học sinh đang học (count enrollments active).
- Học phí trung bình / khoảng giá (min–max VND/buổi).
- Nút "Học sinh" giữ nguyên, thêm tooltip count.

### 2.2 EnrollmentsDialog nâng cấp
- Hiển thị **phụ huynh tương ứng** của mỗi học sinh (join `students.parent_id → parents → profiles`).
- Cho phép sửa `price_per_session` inline (không phải xoá rồi thêm lại).
- Cho phép set `end_date` (rời lớp giữa chừng) thay vì chỉ soft-delete.
- Thêm cột "Tổng buổi đã học" (count attendances status=attended) — đặt nền cho module học phí sau.

### 2.3 Trong ClassFormDialog (form tạo/sửa lớp)
- **KHÔNG** thêm enroll trong form tạo lớp (vi phạm separation; tạo xong sẽ tự động mở EnrollmentsDialog nếu là lớp mới).
- Sau khi tạo lớp thành công → toast có nút "Thêm học sinh ngay" để mở Enrollments.

---

## Phần 3 — Buổi học (Sessions) — Calendar View

### 3.1 Component `SessionsCalendar`
- Dùng thư viện đã có sẵn `react-day-picker` (đã trong shadcn `calendar.tsx`) — KHÔNG cài thêm lib nặng như fullcalendar.
- 2 chế độ xem:
  - **Tháng**: lưới 7 cột × 6 hàng, mỗi ô liệt kê tối đa 3 buổi (giờ + tên lớp viết tắt), badge "+N" nếu nhiều hơn.
  - **Danh sách** (giữ list cũ làm fallback / mobile).
- Toggle "Tháng | Danh sách" ở đầu trang.
- Click ngày trong calendar → drawer (Sheet) bên phải hiện toàn bộ buổi của ngày đó với nút "Điểm danh" / "Sửa" / "Xoá".
- Color-code theo lớp (hash từ class_id → màu pastel từ palette giới hạn 8 màu, đảm bảo contrast với theme editorial).

### 3.2 Filter
- Giữ filter theo lớp.
- Thêm nút mũi tên ◀ ▶ chuyển tháng + chip "Hôm nay".

---

## Phần 4 — Bài tập (Assignments) — Theo buổi + File

### 4.1 AssignmentFormDialog nâng cấp
- Thêm field **"Buổi học (tuỳ chọn)"**: select các session của lớp được chọn (chỉ load khi chọn lớp). Cho phép null = bài tập chung không gắn buổi.
- Khi chọn buổi → tự fill deadline = `session.ends_at + 7 ngày` (gợi ý, sửa được).
- Thêm khu **"File đính kèm đề bài"**:
  - Drag & drop hoặc click chọn file (max 5 file, mỗi file ≤ 10MB — validate client-side).
  - Cho phép xoá file đã upload.
  - Upload vào `assignment-attachments/{tenant_id}/{assignment_id}/...` SAU KHI insert assignment (vì cần id). Update `attachments` jsonb sau upload.
  - Loại file cho phép: pdf, doc/docx, xls/xlsx, jpg, png, zip.

### 4.2 Page Assignments (teacher)
- Group bài tập theo **buổi** — accordion theo session date, hoặc filter "Theo buổi / Theo lớp / Tất cả".
- Mặc định: tab "Theo buổi" — list session sắp tới + bài tập gắn dưới mỗi session.
- Tab "Tất cả": list phẳng như hiện tại.
- Hiển thị số file đính kèm + số bài đã nộp / tổng học sinh.

### 4.3 AssignmentDetail (teacher chấm bài)
- Hiển thị link tải file đề bài (signed URL).
- Mỗi học sinh: hiện list file học sinh đã nộp (signed URL để tải về xem).
- Giáo viên có thể tải file học sinh, nhập điểm + nhận xét, save → status `graded`.

### 4.4 Page MỚI: `StudentAssignments` (`/my-assignments`)
- Học sinh xem bài tập của các lớp mình đang học.
- Group theo lớp, sắp xếp theo deadline gần nhất.
- Mỗi bài: tải file đề + form nộp:
  - Textarea (content).
  - Upload file (1–5 file).
  - Nút "Nộp bài" → insert `submissions` (status=submitted) + insert `submission_files`.
  - Nếu đã nộp & chưa chấm → cho phép sửa lại (RLS đã cho phép update khi status ∈ {draft, submitted}).
  - Nếu đã chấm: hiển thị điểm + feedback, không sửa được nữa.

### 4.5 Page MỚI: `ParentAssignments` (`/my-children` mở rộng)
- Phụ huynh xem bài tập + tình trạng nộp + điểm + feedback của con.
- Read-only, không nộp/sửa được.

---

## Phần 5 — Routing & Sidebar

### 5.1 App.tsx
- Mở route cho student/parent:
  - `/my-assignments` → `StudentAssignments` (allow=student).
  - `/my-children/assignments` → `ParentAssignments` (allow=parent).
- Giữ nguyên các route teacher.

### 5.2 Sidebar
- Đã có sẵn các menu role-based; chỉ verify link đúng.

---

## Phần 6 — Helpers & utilities

- `src/lib/storage.ts`: helpers `uploadAssignmentFile`, `uploadSubmissionFile`, `getSignedUrl`, `deleteFile` — gói gọn logic Supabase Storage.
- `src/components/FileUploader.tsx`: component generic dùng cho cả 2 luồng (đề bài / bài nộp), props nhận bucket + path prefix + accept + maxFiles + maxSize.
- `src/components/FileList.tsx`: list file đã upload với nút download (signed URL) + nút xoá (optional).

---

## Files dự kiến tạo / sửa

**Tạo mới (~10 files)**:
- `src/lib/storage.ts`
- `src/components/FileUploader.tsx`
- `src/components/FileList.tsx`
- `src/features/sessions/SessionsCalendar.tsx`
- `src/features/sessions/SessionDayDrawer.tsx`
- `src/features/assignments/AssignmentSessionPicker.tsx`
- `src/pages/StudentAssignments.tsx`
- `src/pages/ParentAssignments.tsx`
- `src/features/assignments/StudentSubmitDialog.tsx`
- 1 migration SQL (storage buckets + policies + cột `attachments` + triggers `set_updated_at`)

**Sửa**:
- `src/App.tsx` (routes mới)
- `src/pages/Classes.tsx` (card hiển thị thêm count + price range)
- `src/pages/Sessions.tsx` (toggle calendar / list)
- `src/pages/Assignments.tsx` (group theo buổi + filter)
- `src/pages/AssignmentDetail.tsx` (file đề bài + file học sinh nộp)
- `src/features/classes/EnrollmentsDialog.tsx` (cột phụ huynh, edit price inline, end_date)
- `src/features/assignments/AssignmentFormDialog.tsx` (chọn buổi + upload file)

---

## Giả định tôi đang đưa ra

1. **Calendar không cần drag-to-create** — click ngày để xem, tạo buổi vẫn qua dialog. Lý do: drag-create phức tạp + ít dùng vì đã có "Sinh từ lịch".
2. **File size limit 10MB/file** — phù hợp bài tập học thuật (PDF, ảnh chụp vở). Nếu cần lớn hơn (video), tăng sau.
3. **Phụ huynh chỉ xem, không thay học sinh nộp bài** — đúng tinh thần "phụ huynh giám sát".
4. **`attachments` jsonb thay vì bảng riêng** — đề bài thường ≤ 5 file, jsonb đơn giản hơn. Bài nộp dùng bảng `submission_files` vì cần index theo submission_id để query nhanh.
5. **Calendar dùng react-day-picker custom render** thay vì fullcalendar/big-calendar — đã có sẵn, không thêm 200KB bundle.

---

## Câu hỏi trước khi code (trả lời nhanh hoặc "ok hết")

a) **Nộp bài muộn**: cho phép học sinh nộp sau deadline không?
   - Đề xuất: **CÓ**, nhưng hiển thị badge "Nộp muộn" để giáo viên thấy.

b) **File preview trong app** (PDF viewer, ảnh thumbnail) hay **chỉ download**?
   - Đề xuất: **chỉ download** ở iteration này (preview tốn effort, có thể thêm sau).

c) **Calendar mặc định** mở ở chế độ Tháng hay Danh sách?
   - Đề xuất: **Tháng** (đẹp hơn, đúng ý ảnh ref).

Sau khi bạn duyệt plan này, tôi sẽ chuyển sang default mode và code toàn bộ trong 1 lần (~15 files, ước tính ~1500 dòng tổng cộng — vẫn trong giới hạn an toàn).
