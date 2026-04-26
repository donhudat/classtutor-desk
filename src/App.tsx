import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { AppLayout } from "@/features/layout/AppLayout";
import AuthPage from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import StudentsPage from "@/pages/Students";
import ParentsPage from "@/pages/Parents";
import ClassesPage from "@/pages/Classes";
import SessionsPage from "@/pages/Sessions";
import AttendancePage from "@/pages/Attendance";
import AssignmentsPage from "@/pages/Assignments";
import AssignmentDetailPage from "@/pages/AssignmentDetail";
import SubmissionsPage from "@/pages/Submissions";
import ComingSoon from "@/pages/ComingSoon";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Dashboard />} />
              <Route
                path="/students"
                element={
                  <ProtectedRoute allow={["teacher"]}>
                    <StudentsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/parents"
                element={
                  <ProtectedRoute allow={["teacher"]}>
                    <ParentsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/classes"
                element={
                  <ProtectedRoute allow={["teacher"]}>
                    <ClassesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/sessions"
                element={
                  <ProtectedRoute allow={["teacher"]}>
                    <SessionsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/attendance"
                element={
                  <ProtectedRoute allow={["teacher"]}>
                    <SessionsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/attendance/:sessionId"
                element={
                  <ProtectedRoute allow={["teacher"]}>
                    <AttendancePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/assignments"
                element={
                  <ProtectedRoute allow={["teacher"]}>
                    <AssignmentsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/assignments/:assignmentId"
                element={
                  <ProtectedRoute allow={["teacher"]}>
                    <AssignmentDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/submissions"
                element={
                  <ProtectedRoute allow={["teacher"]}>
                    <SubmissionsPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/payments" element={<ComingSoon title="Học phí" />} />
              <Route path="/settings" element={<ComingSoon title="Cài đặt" />} />
              <Route path="/my-classes" element={<ComingSoon title="Lớp của tôi" />} />
              <Route path="/my-assignments" element={<ComingSoon title="Bài tập" />} />
              <Route path="/my-children" element={<ComingSoon title="Con của tôi" />} />
              <Route path="/my-payments" element={<ComingSoon title="Học phí" />} />
            </Route>
            <Route path="/onboarding" element={<Navigate to="/auth" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
