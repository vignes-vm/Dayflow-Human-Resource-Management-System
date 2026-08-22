// M2 ONLY — every route is declared here. Feature owners build the component
// their route already points to; nobody else edits this file.
// See docs/Dayflow-Team-Plan.md §3.3.
import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";

import { ProtectedRoute, PublicOnlyRoute, RoleRoute } from "@/app/guards";
import { AppShell } from "@/app/AppShell";
import { ShellSkeleton } from "@/components/ShellSkeleton";
import { NotFoundPage } from "@/features/system/NotFoundPage";
import { ForbiddenPage } from "@/features/system/ForbiddenPage";

const SignInPage = lazy(() =>
  import("@/features/auth/SignInPage").then((m) => ({ default: m.SignInPage })),
);
const SignUpPage = lazy(() =>
  import("@/features/auth/SignUpPage").then((m) => ({ default: m.SignUpPage })),
);
const VerifyPage = lazy(() =>
  import("@/features/auth/VerifyPage").then((m) => ({ default: m.VerifyPage })),
);
const ForgotPasswordPage = lazy(() =>
  import("@/features/auth/ForgotPasswordPage").then((m) => ({ default: m.ForgotPasswordPage })),
);
const ResetPasswordPage = lazy(() =>
  import("@/features/auth/ResetPasswordPage").then((m) => ({ default: m.ResetPasswordPage })),
);
const ForcedChangePasswordPage = lazy(() =>
  import("@/features/auth/ForcedChangePasswordPage").then((m) => ({
    default: m.ForcedChangePasswordPage,
  })),
);

const EmployeesPage = lazy(() => import("@/features/employees/EmployeesPage")); // M3
const ProfilePage = lazy(() => import("@/features/profile/ProfilePage")); // M3
const AttendancePage = lazy(() => import("@/features/attendance/AttendancePage")); // M4
const TimeOffPage = lazy(() => import("@/features/timeoff/TimeOffPage")); // M4
const PayrollPage = lazy(() => import("@/features/payroll/PayrollPage")); // M3
const AnalyticsPage = lazy(() => import("@/features/analytics/AnalyticsPage")); // M4
const SettingsPage = lazy(() =>
  import("@/features/settings/SettingsPage").then((m) => ({ default: m.SettingsPage })),
); // M2
const AuditLogPage = lazy(() =>
  import("@/features/audit/AuditLogPage").then((m) => ({ default: m.AuditLogPage })),
); // M2

const KitchenSink = lazy(() => import("@/pages/kitchen-sink"));

function withSuspense(node: React.ReactNode) {
  return <Suspense fallback={<ShellSkeleton />}>{node}</Suspense>;
}

export const router = createBrowserRouter([
  {
    element: <PublicOnlyRoute />,
    children: [
      { path: "/sign-in", element: withSuspense(<SignInPage />) },
      { path: "/sign-up", element: withSuspense(<SignUpPage />) },
      { path: "/forgot-password", element: withSuspense(<ForgotPasswordPage />) },
      { path: "/reset-password", element: withSuspense(<ResetPasswordPage />) },
    ],
  },
  { path: "/verify", element: withSuspense(<VerifyPage />) },
  {
    element: <ProtectedRoute />,
    children: [
      { path: "/change-password", element: withSuspense(<ForcedChangePasswordPage />) },
      {
        element: <AppShell />,
        children: [
          { index: true, element: <Navigate to="/employees" replace /> },
          { path: "/employees", element: withSuspense(<EmployeesPage />) },
          { path: "/employees/:employeeId", element: withSuspense(<ProfilePage />) },
          { path: "/profile/me", element: withSuspense(<ProfilePage />) },
          { path: "/attendance", element: withSuspense(<AttendancePage />) },
          { path: "/time-off", element: withSuspense(<TimeOffPage />) },
          {
            element: <RoleRoute allow={["ADMIN"]} />,
            children: [
              { path: "/payroll", element: withSuspense(<PayrollPage />) },
              { path: "/settings", element: withSuspense(<SettingsPage />) },
              { path: "/audit", element: withSuspense(<AuditLogPage />) },
            ],
          },
          {
            element: <RoleRoute allow={["ADMIN", "HR"]} />,
            children: [{ path: "/analytics", element: withSuspense(<AnalyticsPage />) }],
          },
          ...(import.meta.env.DEV
            ? [{ path: "/kitchen-sink", element: withSuspense(<KitchenSink />) }]
            : []),
          { path: "/403", element: <ForbiddenPage /> },
          { path: "*", element: <NotFoundPage /> },
        ],
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
