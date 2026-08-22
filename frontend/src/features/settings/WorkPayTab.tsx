import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ErrorState";
import { MoneyInput } from "@/components/MoneyInput";
import { PercentInput } from "@/components/PercentInput";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useToast } from "@/hooks/useToast";
import type { Company } from "@/features/settings/types";

export function WorkPayTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const companyQuery = useQuery({
    queryKey: queryKeys.company(),
    queryFn: () => api.get<Company>("/company"),
  });

  const [form, setForm] = useState({
    workDaysPerWeek: "5",
    standardDailyHours: "8",
    breakMinutes: "60",
    pfRateEmployee: "12",
    pfRateEmployer: "12",
    professionalTax: "200.00",
    coverageOkThreshold: "70",
    coverageRiskThreshold: "50",
    absenceCutoffHour: "11",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (companyQuery.data) {
      const c = companyQuery.data;
      setForm({
        workDaysPerWeek: String(c.workDaysPerWeek),
        standardDailyHours: String(c.standardDailyHours),
        breakMinutes: String(c.breakMinutes),
        pfRateEmployee: c.pfRateEmployee,
        pfRateEmployer: c.pfRateEmployer,
        professionalTax: c.professionalTax,
        coverageOkThreshold: String(c.coverageOkThreshold),
        coverageRiskThreshold: String(c.coverageRiskThreshold),
        absenceCutoffHour: String(c.absenceCutoffHour),
      });
    }
  }, [companyQuery.data]);

  if (companyQuery.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }
  if (companyQuery.isError || !companyQuery.data) {
    return <ErrorState onRetry={() => companyQuery.refetch()} />;
  }

  const save = async () => {
    setSaving(true);
    try {
      await api.patch("/company", {
        workDaysPerWeek: Number(form.workDaysPerWeek),
        standardDailyHours: Number(form.standardDailyHours),
        breakMinutes: Number(form.breakMinutes),
        pfRateEmployee: Number(form.pfRateEmployee),
        pfRateEmployer: Number(form.pfRateEmployer),
        professionalTax: Number(form.professionalTax),
        coverageOkThreshold: Number(form.coverageOkThreshold),
        coverageRiskThreshold: Number(form.coverageRiskThreshold),
        absenceCutoffHour: Number(form.absenceCutoffHour),
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.company() });
      toast({
        variant: "success",
        title: "Saved",
        description: "Changes apply everywhere immediately.",
      });
    } catch {
      toast({ variant: "danger", title: "Couldn't save", description: "Please try again." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Work week</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="work-days">Working days / week</Label>
            <Input
              id="work-days"
              type="number"
              min={1}
              max={7}
              value={form.workDaysPerWeek}
              onChange={(e) => setForm((f) => ({ ...f, workDaysPerWeek: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="daily-hours">Standard daily hours</Label>
            <Input
              id="daily-hours"
              type="number"
              min={1}
              max={24}
              value={form.standardDailyHours}
              onChange={(e) => setForm((f) => ({ ...f, standardDailyHours: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="break-minutes">Break time (minutes)</Label>
            <Input
              id="break-minutes"
              type="number"
              min={0}
              max={480}
              value={form.breakMinutes}
              onChange={(e) => setForm((f) => ({ ...f, breakMinutes: e.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Provident Fund &amp; Tax</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="pf-employee">PF rate — employee</Label>
            <PercentInput
              id="pf-employee"
              value={form.pfRateEmployee}
              onValueChange={(v) => setForm((f) => ({ ...f, pfRateEmployee: v }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-employer">PF rate — employer</Label>
            <PercentInput
              id="pf-employer"
              value={form.pfRateEmployer}
              onValueChange={(v) => setForm((f) => ({ ...f, pfRateEmployer: v }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="professional-tax">Professional tax</Label>
            <MoneyInput
              id="professional-tax"
              value={form.professionalTax}
              onValueChange={(v) => setForm((f) => ({ ...f, professionalTax: v }))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Coverage Radar &amp; absence</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="coverage-ok">Coverage "ok" threshold (%)</Label>
            <Input
              id="coverage-ok"
              type="number"
              min={0}
              max={100}
              value={form.coverageOkThreshold}
              onChange={(e) => setForm((f) => ({ ...f, coverageOkThreshold: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="coverage-risk">Coverage "risk" threshold (%)</Label>
            <Input
              id="coverage-risk"
              type="number"
              min={0}
              max={100}
              value={form.coverageRiskThreshold}
              onChange={(e) => setForm((f) => ({ ...f, coverageRiskThreshold: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="absence-cutoff">Absence cutoff hour</Label>
            <Input
              id="absence-cutoff"
              type="number"
              min={0}
              max={23}
              value={form.absenceCutoffHour}
              onChange={(e) => setForm((f) => ({ ...f, absenceCutoffHour: e.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} loading={saving}>
          Save changes
        </Button>
      </div>
    </div>
  );
}
