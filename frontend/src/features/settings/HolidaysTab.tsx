import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/DataTable";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useToast } from "@/hooks/useToast";
import type { Holiday } from "@/features/settings/types";

export function HolidaysTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [year, setYear] = useState(new Date().getFullYear());
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const holidaysQuery = useQuery({
    queryKey: queryKeys.holidays(year),
    queryFn: () => api.get<{ items: Holiday[] }>(`/settings/holidays?year=${year}`),
  });

  const addHoliday = async () => {
    if (!date || !name) return;
    setSaving(true);
    try {
      await api.post("/settings/holidays", { date, name });
      await queryClient.invalidateQueries({ queryKey: queryKeys.holidays(year) });
      toast({ variant: "success", title: "Holiday added" });
      setOpen(false);
      setDate("");
      setName("");
    } catch {
      toast({ variant: "danger", title: "Couldn't add holiday" });
    } finally {
      setSaving(false);
    }
  };

  const removeHoliday = async (id: string) => {
    try {
      await api.delete(`/settings/holidays/${id}`);
      await queryClient.invalidateQueries({ queryKey: queryKeys.holidays(year) });
      toast({ title: "Holiday removed" });
    } catch {
      toast({ variant: "danger", title: "Couldn't remove holiday" });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Holiday calendar</CardTitle>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-24"
            aria-label="Year"
          />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
                Add holiday
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add a holiday</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="holiday-date" required>
                    Date
                  </Label>
                  <Input
                    id="holiday-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="holiday-name" required>
                    Name
                  </Label>
                  <Input id="holiday-name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={addHoliday} loading={saving} disabled={!date || !name}>
                  Add
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <DataTable
          loading={holidaysQuery.isLoading}
          data={holidaysQuery.data?.items ?? []}
          getRowId={(h) => h.id}
          emptyTitle="No holidays yet"
          emptyDescription={`Add ${year}'s public holidays so attendance and time off count them correctly.`}
          columns={[
            {
              id: "date",
              header: "Date",
              sortValue: (h) => h.date,
              cell: (h) => (
                <span className="tabular font-mono">{format(new Date(h.date), "dd MMM yyyy")}</span>
              ),
            },
            { id: "name", header: "Name", cell: (h) => h.name },
            {
              id: "actions",
              header: "",
              cell: (h) => (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeHoliday(h.id)}
                  aria-label={`Remove ${h.name}`}
                >
                  <Trash2 className="text-danger h-4 w-4" aria-hidden="true" />
                </Button>
              ),
              className: "w-12",
            },
          ]}
        />
      </CardContent>
    </Card>
  );
}
