import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ErrorState";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useToast } from "@/hooks/useToast";
import type { Company, LoginIdPreview } from "@/features/settings/types";

export function CompanyProfileTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const companyQuery = useQuery({
    queryKey: queryKeys.company(),
    queryFn: () => api.get<Company>("/company"),
  });
  const previewQuery = useQuery({
    queryKey: queryKeys.loginIdPreview(),
    queryFn: () => api.get<LoginIdPreview>("/settings/next-login-id-preview"),
  });

  const [form, setForm] = useState({
    name: "",
    address: "",
    timezone: "",
    code: "",
    serialWidth: 4,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (companyQuery.data) {
      setForm({
        name: companyQuery.data.name,
        address: companyQuery.data.address ?? "",
        timezone: companyQuery.data.timezone,
        code: companyQuery.data.code,
        serialWidth: companyQuery.data.serialWidth,
      });
    }
  }, [companyQuery.data]);

  if (companyQuery.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
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
        name: form.name,
        address: form.address || undefined,
        timezone: form.timezone,
        code: form.code,
        serialWidth: Number(form.serialWidth),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.company() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.loginIdPreview() }),
      ]);
      toast({ variant: "success", title: "Company profile saved" });
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
          <CardTitle>Company profile</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="company-name">Company name</Label>
            <Input
              id="company-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="company-address">Address</Label>
            <Input
              id="company-address"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="company-timezone">Timezone</Label>
            <Input
              id="company-timezone"
              value={form.timezone}
              onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Company code &amp; Login ID</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="company-code">Company code</Label>
            <Input
              id="company-code"
              maxLength={2}
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="serial-width">Serial width</Label>
            <Input
              id="serial-width"
              type="number"
              min={3}
              max={6}
              value={form.serialWidth}
              onChange={(e) => setForm((f) => ({ ...f, serialWidth: Number(e.target.value) }))}
            />
          </div>
          <div className="rounded-card border-border bg-ink-100/40 border border-dashed p-3 sm:col-span-2">
            <p className="text-ink-500 text-xs">Next Login ID preview</p>
            <p className="tabular text-ink-900 font-mono text-lg font-medium">
              {previewQuery.data?.preview ?? "—"}
            </p>
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
