import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Bell } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

interface NotificationsResponse {
  items: NotificationItem[];
  unreadCount: number;
}

export function NotificationBell() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: queryKeys.notifications(),
    queryFn: () => api.get<NotificationsResponse>("/notifications?limit=8"),
    refetchInterval: 30_000,
  });

  const unreadCount = data?.unreadCount ?? 0;

  const markAllRead = async () => {
    await api.post("/notifications/read-all");
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  const markRead = async (id: string) => {
    await api.post(`/notifications/${id}/read`);
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Notifications (${unreadCount} unread)`}
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
          {unreadCount > 0 ? (
            <span className="bg-danger absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="px-0 py-0">Notifications</DropdownMenuLabel>
          {unreadCount > 0 ? (
            <button
              type="button"
              onClick={markAllRead}
              className="text-primary-500 cursor-pointer text-xs font-medium hover:underline"
            >
              Mark all read
            </button>
          ) : null}
        </div>
        <DropdownMenuSeparator />
        {!data || data.items.length === 0 ? (
          <div className="p-2">
            <EmptyState title="No notifications" description="You're all caught up." />
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {data.items.map((n) => (
              <DropdownMenuItem
                key={n.id}
                className="flex-col items-start gap-0.5 whitespace-normal"
                onSelect={() => {
                  if (!n.readAt) markRead(n.id);
                  if (n.link) window.location.href = n.link;
                }}
              >
                <span className="text-ink-900 flex w-full items-center gap-1.5 text-sm font-medium">
                  {!n.readAt ? (
                    <span className="bg-primary-500 h-1.5 w-1.5 rounded-full" aria-hidden="true" />
                  ) : null}
                  {n.title}
                </span>
                <span className="text-ink-500 text-xs">{n.body}</span>
                <span className="text-ink-400 text-[11px]">
                  {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                </span>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
