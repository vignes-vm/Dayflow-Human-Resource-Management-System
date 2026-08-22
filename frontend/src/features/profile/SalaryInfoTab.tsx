import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Decimal } from "decimal.js";
import type { ContractDto, ContractPreviewResponse, SalaryComponentInput } from "@dayflow/shared";

import { ComponentTable } from "@/components/ComponentTable";
import { MoneyInput } from "@/components/MoneyInput";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { useToast } from "@/hooks/useToast";
import { api, ApiClientError } from "@/lib/api";
import { format } from "date-fns";

const DEFAULT_COMPONENTS: SalaryComponentInput[] = [
  {
    code: "BASIC",
    label: "Basic Salary",
    category: "EARNING",
    computation: "PCT_OF_WAGE",
    value: "50",
  },
  {
    code: "HRA",
    label: "House Rent Allowance",
    category: "EARNING",
    computation: "PCT_OF_COMPONENT",
    value: "50",
    baseComponentCode: "BASIC",
  },
  {
    code: "STANDARD_ALLOWANCE",
    label: "Standard Allowance",
    category: "EARNING",
    computation: "FIXED",
    value: "4567",
  },
  {
    code: "PERFORMANCE_BONUS",
    label: "Performance Bonus",
    category: "EARNING",
    computation: "PCT_OF_COMPONENT",
    value: "8.33",
    baseComponentCode: "BASIC",
  },
  {
    code: "LTA",
    label: "Leave Travel Allowance",
    category: "EARNING",
    computation: "PCT_OF_COMPONENT",
    value: "8.33",
    baseComponentCode: "BASIC",
  },
  {
    code: "FIXED_ALLOWANCE",
    label: "Fixed Allowance",
    category: "EARNING",
    computation: "BALANCE",
    value: "0",
  },
];

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export function SalaryInfoTab({ employeeId }: { employeeId: string }) {
  const { toast } = useToast();
  const contractsQuery = useQuery({
    queryKey: ["contracts", employeeId],
    queryFn: () => api.get<{ data: ContractDto[] }>(`/contracts/${employeeId}`),
  });

  const [wage, setWage] = useState<string | null>(null);
  const [components, setComponents] = useState<SalaryComponentInput[] | null>(null);
  const [effectiveFrom, setEffectiveFrom] = useState(() => format(new Date(), "yyyy-MM-dd"));

  const current = contractsQuery.data?.data[0];

  useEffect(() => {
    if (wage === null && contractsQuery.data) {
      if (current) {
        setWage(current.monthlyWage);
        setComponents(
          current.components
            .filter((c) => c.category === "EARNING")
            .map((c) => ({
              code: c.code,
              label: c.label,
              category: c.category,
              computation: c.computation,
              value: c.computation === "FIXED" || c.computation === "BALANCE" ? c.amount : "0",
              baseComponentCode: null,
            })),
        );
      } else {
        setWage("50000");
        setComponents(DEFAULT_COMPONENTS);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractsQuery.data]);

  const debouncedWage = useDebounced(wage, 300);
  const debouncedComponents = useDebounced(components, 300);

  const previewQuery = useQuery({
    queryKey: ["contracts-preview", employeeId, debouncedWage, debouncedComponents],
    queryFn: () =>
      api.post<ContractPreviewResponse>("/contracts/preview", {
        employeeId,
        monthlyWage: debouncedWage,
        components: debouncedComponents,
        effectiveFrom: new Date(effectiveFrom).toISOString(),
      }),
    enabled: !!debouncedWage && !!debouncedComponents,
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      api.post<ContractDto>("/contracts", {
        employeeId,
        monthlyWage: wage,
        components,
        effectiveFrom: new Date(effectiveFrom).toISOString(),
      }),
    onSuccess: () => {
      toast({ variant: "success", title: "Salary saved", description: "New contract created." });
      contractsQuery.refetch();
    },
    onError: (err) => {
      toast({
        variant: "danger",
        title: "Could not save",
        description: err instanceof ApiClientError ? err.message : "Something went wrong.",
      });
    },
  });

  const yearlyWage = useMemo(() => {
    if (!wage) return "0.00";
    try {
      return new Decimal(wage || "0").times(12).toFixed(2);
    } catch {
      return "0.00";
    }
  }, [wage]);

  const hasErrors = (previewQuery.data?.errors.length ?? 0) > 0;

  if (contractsQuery.isLoading || components === null) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (contractsQuery.isError) {
    return <ErrorState onRetry={() => contractsQuery.refetch()} />;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="monthlyWage">Month wage</Label>
          <MoneyInput id="monthlyWage" value={wage ?? ""} onValueChange={setWage} />
        </div>
        <div className="space-y-1.5">
          <Label>Yearly wage</Label>
          <MoneyInput value={yearlyWage} onValueChange={() => {}} disabled />
        </div>
      </div>

      {previewQuery.data ? (
        <ComponentTable
          lines={previewQuery.data.lines}
          wage={wage ?? "0"}
          editable
          components={components}
          onComponentChange={(idx, patch) =>
            setComponents((prev) =>
              prev ? prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)) : prev,
            )
          }
        />
      ) : (
        <Skeleton className="h-64 w-full" />
      )}

      {hasErrors ? (
        <div className="bg-danger-100 rounded-card text-danger p-3 text-sm">
          {previewQuery.data!.errors.map((e, i) => (
            <p key={i}>{e.message}</p>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="effectiveFrom">Effective from</Label>
          <Input
            id="effectiveFrom"
            type="date"
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
          />
        </div>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={hasErrors || saveMutation.isPending}
        >
          {saveMutation.isPending ? "Saving…" : "Save"}
        </Button>
      </div>

      {contractsQuery.data && contractsQuery.data.data.length > 0 ? (
        <div>
          <p className="text-ink-500 mb-2 text-xs font-semibold uppercase tracking-wide">History</p>
          <div className="divide-border rounded-card border-border divide-y border text-sm">
            {contractsQuery.data.data.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-ink-700">
                  Effective {format(new Date(c.effectiveFrom), "dd MMM yyyy")}
                </span>
                <span className="tabular font-mono">₹{c.monthlyWage}</span>
                <span className="text-ink-400 text-xs">
                  {c.createdBy ? `${c.createdBy.firstName} ${c.createdBy.lastName}` : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState title="No contract yet" description="Save one above to get started." />
      )}
    </div>
  );
}
