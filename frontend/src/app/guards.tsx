import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { Role } from "@dayflow/shared";

import { useAuth } from "@/hooks/useAuth";
import { ShellSkeleton } from "@/components/ShellSkeleton";

/** Redirects signed-in users away from public-only routes (sign in, sign up). */
export function PublicOnlyRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <ShellSkeleton />;
  if (isAuthenticated) return <Navigate to="/employees" replace />;
  return <Outlet />;
}

/** Requires a signed-in session; forces the password-change screen when required. */
export function ProtectedRoute() {
  const { me, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <ShellSkeleton />;
  if (!isAuthenticated) return <Navigate to="/sign-in" replace state={{ from: location }} />;

  const onChangePasswordScreen = location.pathname === "/change-password";
  if (me?.user.mustChangePassword && !onChangePasswordScreen) {
    return <Navigate to="/change-password" replace />;
  }
  if (!me?.user.mustChangePassword && onChangePasswordScreen) {
    return <Navigate to="/employees" replace />;
  }

  return <Outlet />;
}

export function RoleRoute({ allow }: { allow: Role[] }) {
  const { me, isLoading } = useAuth();

  if (isLoading) return <ShellSkeleton />;
  if (!me || !allow.includes(me.user.role)) {
    return <Navigate to="/403" replace />;
  }
  return <Outlet />;
}
