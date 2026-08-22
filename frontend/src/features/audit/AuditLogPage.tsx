import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";
import { format } from "date-fns";

import { PageHeader } from "@/components/PageHeader";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { AuditDiff } from "@/features/audit/AuditDiff";

interface AuditLogItem {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  before: unknown;
  after: unknown;
  createdAt: string;
  ip: string | null;
  actor: { id: string; loginId: string; email: string; role: string } | null;
}

interface AuditLogResponse {
  items: AuditLogItem[];
  page: number;
  totalPages: number;
}

export function AuditLogPage() {
  const [entity, setEntity] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  const filters = {
    entity: entity || undefined,
    from: from || undefined,
    to: to || undefined,
    page,
  };

  const query = useQuery({
    queryKey: queryKeys.audit(filters),
    queryFn: () => {
      const params = new URLSearchParams();
      if (entity) params.set("entity", entity);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      params.set("page", String(page));
      return api.get<AuditLogResponse>(`/audit?${params.toString()}`);
    },
  });

  return (
    <div>
      <PageHeader
        title="Audit log"
        description="Every mutating action, who did it, and what changed."
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="filter-entity">Entity</Label>
          <Input
            id="filter-entity"
            placeholder="e.g. Company"
            value={entity}
            onChange={(e) => {
              setEntity(e.target.value);
              setPage(1);
            }}
            className="w-40"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="filter-from">From</Label>
          <Input
            id="filter-from"
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="filter-to">To</Label>
          <Input
            id="filter-to"
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {query.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState onRetry={() => query.refetch()} />
      ) : !query.data || query.data.items.length === 0 ? (
        <EmptyState title="No audit entries" description="Nothing matches these filters yet." />
      ) : (
        <div className="space-y-2">
          {query.data.items.map((item) => {
            const isOpen = expanded === item.id;
            return (
              <div key={item.id} className="rounded-card border-border bg-surface border">
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : item.id)}
                  className="focus-visible:ring-focusRing flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2"
                  aria-expanded={isOpen}
                >
                  {isOpen ? (
                    <ChevronDown className="text-ink-400 h-4 w-4 shrink-0" aria-hidden="true" />
                  ) : (
                    <ChevronRight className="text-ink-400 h-4 w-4 shrink-0" aria-hidden="true" />
                  )}
                  <Badge variant="primary">{item.action}</Badge>
                  <span className="text-ink-700 text-sm">
                    {item.entity} · {item.actor?.loginId ?? "system"}
                  </span>
                  <span className="tabular text-ink-400 ml-auto shrink-0 font-mono text-xs">
                    {format(new Date(item.createdAt), "dd MMM yyyy, HH:mm")}
                  </span>
                </button>
                {isOpen ? (
                  <div className="border-border space-y-3 border-t px-4 py-3">
                    <div className="text-ink-500 flex flex-wrap gap-4 text-xs">
                      <span>Actor: {item.actor?.email ?? "system"}</span>
                      <span>Role: {item.actor?.role ?? "—"}</span>
                      <span>IP: {item.ip ?? "—"}</span>
                      <span>Entity ID: {item.entityId}</span>
                    </div>
                    <AuditDiff before={item.before} after={item.after} />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {query.data && query.data.totalPages > 1 ? (
        <div className="text-ink-500 mt-4 flex items-center justify-between text-sm">
          <span>
            Page {query.data.page} of {query.data.totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= query.data.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
