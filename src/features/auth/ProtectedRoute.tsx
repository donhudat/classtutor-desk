import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth, useRole } from "./AuthProvider";

type Role = "teacher" | "student" | "parent";

export function ProtectedRoute({
  children,
  allow,
}: {
  children: ReactNode;
  allow?: Role[];
}) {
  const { loading, user, profile } = useAuth();
  const { roles } = useRole();
  const loc = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Đang tải…
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace state={{ from: loc }} />;
  if (!profile) {
    // user signed in nhưng chưa có profile → onboarding
    return <Navigate to="/onboarding" replace />;
  }
  if (allow && !roles.some((r) => allow.includes(r))) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
