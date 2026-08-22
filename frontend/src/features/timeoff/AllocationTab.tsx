import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AllocationDto, EmployeeCard, TimeOffTypeDto } from "@dayflow/shared";

import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/useToast";
import { api, ApiClientError } from "@/lib/api";

export function AllocationTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [days, setDays] = useState("");
  const [validFrom, setValidFrom] = useState("");

  const allocationsQuery = useQuery({
    queryKey: ["time-off", "allocations"],
    queryFn: () => api.get<{ data: AllocationDto[] }>("/time-off/allocations"),
  });
  const typesQuery = useQuery({
    queryKey: ["time-off", "types"],
    queryFn: () => api.get<{ data: TimeOffTypeDto[] }>("/time-off/types"),
  });
  const employeesQuery = useQuery({
    queryKey: ["employees", { pageSize: 100 }],
    queryFn: () => api.get<{ data: EmployeeCard[] }>("/employees?pageSize=100"),
  });

  const mutation = useMutation({
    mutationFn: () =>
      api.post("/time-off/allocations", {
        employeeIds: [employeeId],
        typeId,
        days,
        validFrom,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-off", "allocations"] });
      setDrawerOpen(false);
      toast({ variant: "success", title: "Allocation granted" });
    },
    onError: (err) => {
      toast({
        variant: "danger",
        title: "Could not allocate",
        description: err instanceof ApiClientError ? err.message : "Something went wrong.",
      });
    },
  });

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setDrawerOpen(true)}>New allocation</Button>
      </div>
      <DataTable<AllocationDto>
        columns={
          [
            { id: "employee", header: "Employee", cell: (r) => r.employeeName },
            { id: "type", header: "Type", cell: (r) => r.typeName },
            { id: "days", header: "Allocated", numeric: true, cell: (r) => r.days },
            { id: "used", header: "Used", numeric: true, cell: (r) => r.used },
            { id: "remaining", header: "Remaining", numeric: true, cell: (r) => r.remaining },
          ] satisfies DataTableColumn<AllocationDto>[]
        }
        data={allocationsQuery.data?.data ?? []}
        getRowId={(r) => r.id}
        loading={allocationsQuery.isLoading}
        emptyTitle="No allocations yet"
      />

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>New allocation</SheetTitle>
          </SheetHeader>
          <div className="flex flex-1 flex-col gap-4">
            <div className="space-y-1.5">
              <Label>Employee</Label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an employee" />
                </SelectTrigger>
                <SelectContent>
                  {employeesQuery.data?.data.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.firstName} {e.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={typeId} onValueChange={setTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a type" />
                </SelectTrigger>
                <SelectContent>
                  {typesQuery.data?.data.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="days">Days</Label>
              <Input id="days" value={days} onChange={(e) => setDays(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="validFrom">Valid from</Label>
              <Input
                id="validFrom"
                type="date"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
              />
            </div>
          </div>
          <SheetFooter>
            <Button
              onClick={() => mutation.mutate()}
              disabled={!employeeId || !typeId || !days || !validFrom || mutation.isPending}
            >
              {mutation.isPending ? "Allocating…" : "Allocate"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
