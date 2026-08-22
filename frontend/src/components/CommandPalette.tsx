import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { useNavigate } from "react-router-dom";
import { LogIn, Search, Users, CalendarClock, Wallet, Settings, ClipboardList } from "lucide-react";
import type { Role } from "@dayflow/shared";

import { navItemsForRole } from "@/app/nav.config";
import { cn } from "@/lib/cn";
import { useToast } from "@/hooks/useToast";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Employees: Users,
  Attendance: CalendarClock,
  "Time Off": ClipboardList,
  Payroll: Wallet,
  Settings: Settings,
};

export function CommandPalette({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const go = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  const notReady = (label: string) => {
    toast({
      title: `${label} isn't wired up yet`,
      description: "This module is still being built.",
    });
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div
      className="bg-ink-900/40 fixed inset-0 z-[60] flex items-start justify-center pt-[15vh]"
      onClick={() => setOpen(false)}
    >
      <Command
        className={cn(
          "rounded-card border-border bg-surface shadow-elevation w-full max-w-lg overflow-hidden border",
        )}
        onClick={(e) => e.stopPropagation()}
        label="Command palette"
      >
        <div className="border-border flex items-center gap-2 border-b px-3">
          <Search className="text-ink-400 h-4 w-4" aria-hidden="true" />
          <Command.Input
            autoFocus
            placeholder="Search or jump to…"
            className="text-ink-900 placeholder:text-ink-400 h-11 w-full bg-transparent text-sm outline-none"
          />
        </div>
        <Command.List className="max-h-80 overflow-y-auto p-2">
          <Command.Empty className="text-ink-500 p-4 text-center text-sm">
            No results found.
          </Command.Empty>
          <Command.Group heading="Navigate" className="text-ink-500 px-2 py-1 text-xs font-medium">
            {navItemsForRole(role).map((item) => {
              const Icon = ICONS[item.label] ?? Users;
              return (
                <Command.Item
                  key={item.path}
                  onSelect={() => go(item.path)}
                  className="rounded-card text-ink-900 aria-selected:bg-ink-100 flex cursor-pointer items-center gap-2 px-2 py-2 text-sm"
                >
                  <Icon className="text-ink-400 h-4 w-4" aria-hidden="true" />
                  {item.label}
                </Command.Item>
              );
            })}
          </Command.Group>
          <Command.Group heading="Actions" className="text-ink-500 px-2 py-1 text-xs font-medium">
            <Command.Item
              onSelect={() => notReady("Check in")}
              className="rounded-card text-ink-900 aria-selected:bg-ink-100 flex cursor-pointer items-center gap-2 px-2 py-2 text-sm"
            >
              <LogIn className="text-ink-400 h-4 w-4" aria-hidden="true" />
              Check in
            </Command.Item>
            <Command.Item
              onSelect={() => notReady("Request time off")}
              className="rounded-card text-ink-900 aria-selected:bg-ink-100 flex cursor-pointer items-center gap-2 px-2 py-2 text-sm"
            >
              <ClipboardList className="text-ink-400 h-4 w-4" aria-hidden="true" />
              Request time off
            </Command.Item>
            <Command.Item
              onSelect={() => go("/employees")}
              className="rounded-card text-ink-900 aria-selected:bg-ink-100 flex cursor-pointer items-center gap-2 px-2 py-2 text-sm"
            >
              <Search className="text-ink-400 h-4 w-4" aria-hidden="true" />
              Search employees
            </Command.Item>
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}
