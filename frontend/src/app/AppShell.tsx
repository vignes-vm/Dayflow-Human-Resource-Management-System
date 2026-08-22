import { NavLink, useNavigate } from "react-router-dom";
import { LogOut, User } from "lucide-react";

import { navItemsForRole } from "@/app/nav.config";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PresenceDot } from "@/components/PresenceDot";
import { CheckInControl } from "@/components/CheckInControl";
import { NotificationBell } from "@/components/NotificationBell";
import { CommandPalette } from "@/components/CommandPalette";
import { OfflineBanner } from "@/components/OfflineBanner";
import { PageTransition } from "@/components/PageTransition";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/cn";

function initials(first?: string, last?: string) {
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "?";
}

export function AppShell() {
  const { me } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const todayQuery = useQuery({
    queryKey: ["attendance", "me", "today"],
    queryFn: () =>
      api.get<{ presence: "GREEN" | "AIRPLANE" | "YELLOW" | "RED" }>("/attendance/me/today"),
    refetchInterval: 30_000,
    enabled: !!me,
  });

  if (!me) return null;

  const items = navItemsForRole(me.user.role);

  const handleLogout = async () => {
    await api.post("/auth/logout");
    queryClient.setQueryData(queryKeys.me(), undefined);
    queryClient.clear();
    navigate("/sign-in", { replace: true });
  };

  return (
    <div className="bg-paper min-h-screen pb-16 lg:pb-0">
      <OfflineBanner />
      <a
        href="#main-content"
        className="focus:rounded-card focus:bg-primary-500 sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[70] focus:px-3 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>

      <header className="border-border bg-surface/95 sticky top-0 z-40 border-b backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <NavLink to="/employees" className="flex shrink-0 items-center gap-2">
            <span className="rounded-card bg-primary-500 font-display flex h-8 w-8 items-center justify-center text-sm font-semibold text-white">
              D
            </span>
            <span className="font-display text-ink-900 hidden text-base font-semibold sm:inline">
              Dayflow
            </span>
          </NavLink>

          <nav
            className="rounded-card bg-ink-100 hidden items-center gap-1 p-1 lg:flex"
            aria-label="Primary"
          >
            {items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    "rounded-[7px] px-3 py-1.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-surface text-ink-900 shadow-sm"
                      : "text-ink-600 hover:text-ink-900",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-2 sm:flex">
              <PresenceDot state={todayQuery.data?.presence ?? "RED"} />
              <CheckInControl />
            </div>
            <NotificationBell />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="focus-visible:ring-focusRing flex cursor-pointer items-center gap-2 rounded-full focus-visible:outline-none focus-visible:ring-2"
                  aria-label="Account menu"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={me.employee?.avatarUrl ?? undefined} alt="" />
                    <AvatarFallback>
                      {initials(me.employee?.firstName, me.employee?.lastName)}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => navigate("/profile/me")}>
                  <User className="mr-2 h-4 w-4" aria-hidden="true" />
                  My Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem danger onSelect={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
                  Log Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main id="main-content" className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <PageTransition />
      </main>

      <nav
        className="border-border bg-surface fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t px-2 py-2 lg:hidden"
        aria-label="Primary"
      >
        {items.slice(0, 2).map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                "rounded-card flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] font-medium",
                isActive ? "text-primary-500" : "text-ink-500",
              )
            }
          >
            {item.label}
          </NavLink>
        ))}
        <div className="-mt-6">
          <CheckInControl />
        </div>
        {items.slice(2).map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                "rounded-card flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] font-medium",
                isActive ? "text-primary-500" : "text-ink-500",
              )
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <CommandPalette role={me.user.role} />
    </div>
  );
}
