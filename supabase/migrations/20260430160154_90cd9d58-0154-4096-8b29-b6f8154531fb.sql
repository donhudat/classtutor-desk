-- Bỏ quyền xem nhận xét của học sinh; chỉ phụ huynh và giáo viên được xem
DROP POLICY IF EXISTS feedbacks_student_select ON public.feedbacks;

-- Đảm bảo unique theo (session_id, student_id) để upsert
CREATE UNIQUE INDEX IF NOT EXISTS feedbacks_session_student_uniq
  ON public.feedbacks (session_id, student_id);