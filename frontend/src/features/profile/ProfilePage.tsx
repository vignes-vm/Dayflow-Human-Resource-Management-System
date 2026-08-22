import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import type { EmployeeDetail } from "@dayflow/shared";

import { PageHeader } from "@/components/PageHeader";
import { ErrorState } from "@/components/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { ResumeTab } from "@/features/profile/ResumeTab";
import { PrivateInfoTab } from "@/features/profile/PrivateInfoTab";
import { SalaryInfoTab } from "@/features/profile/SalaryInfoTab";
import { SecurityTab } from "@/features/profile/SecurityTab";

function LockedField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label>{label}</Label>
        <Tooltip>
          <TooltipTrigger asChild>
            <Lock className="text-ink-400 h-3 w-3" aria-hidden="true" />
          </TooltipTrigger>
          <TooltipContent>Contact HR to change this.</TooltipContent>
        </Tooltip>
      </div>
      <Input value={value} disabled />
    </div>
  );
}

export default function ProfilePage() {
  const { employeeId: routeId } = useParams();
  const { me } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("resume");

  const isOwnProfile = !routeId;
  const targetId = routeId ?? me?.employee?.id ?? "";

  const employeeQuery = useQuery({
    queryKey: queryKeys.employee(targetId),
    queryFn: () => api.get<EmployeeDetail>(`/employees/${targetId}`),
    enabled: !!targetId,
  });

  const phoneMutation = useMutation({
    mutationFn: (phone: string) => api.patch(`/employees/${targetId}`, { phone }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.employee(targetId) }),
  });

  if (!targetId || employeeQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (employeeQuery.isError || !employeeQuery.data) {
    return <ErrorState onRetry={() => employeeQuery.refetch()} />;
  }

  const emp = employeeQuery.data;
  const isSelf = isOwnProfile || emp.id === me?.employee?.id;
  const isAdmin = me?.user.role === "ADMIN";
  const isPrivileged = isAdmin || me?.user.role === "HR";
  const viewingOther = !isSelf;
  const canEditLockedFields = isPrivileged;

  return (
    <div>
      {viewingOther ? (
        <div className="bg-ink-100 text-ink-700 rounded-card mb-4 px-4 py-2 text-sm">
          Viewing {emp.firstName} {emp.lastName}'s profile — view only.
        </div>
      ) : null}

      <PageHeader
        title={`${emp.firstName} ${emp.lastName}`}
        description={emp.jobTitle ?? undefined}
      />

      <div className="mb-6 flex flex-col gap-6 sm:flex-row sm:items-start">
        <Avatar className="h-20 w-20">
          <AvatarImage src={emp.avatarUrl ?? undefined} alt="" />
          <AvatarFallback className="text-lg">
            {emp.firstName[0]}
            {emp.lastName[0]}
          </AvatarFallback>
        </Avatar>
        <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Login ID</Label>
            <Input value={emp.loginId} disabled className="tabular font-mono" />
          </div>
          {isSelf ? (
            <div className="space-y-1.5">
              <Label htmlFor="phone">Mobile</Label>
              <Input
                id="phone"
                defaultValue={emp.phone ?? ""}
                onBlur={(e) => phoneMutation.mutate(e.target.value)}
              />
            </div>
          ) : (
            <LockedField label="Mobile" value={emp.phone ?? "—"} />
          )}
          {canEditLockedFields ? (
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={emp.email ?? "—"} disabled />
            </div>
          ) : (
            <LockedField label="Email" value={emp.email ?? "—"} />
          )}
          <LockedField label="Department" value={emp.department?.name ?? "—"} />
          <LockedField
            label="Manager"
            value={emp.manager ? `${emp.manager.firstName} ${emp.manager.lastName}` : "—"}
          />
          <LockedField label="Location" value={emp.workLocation ?? "—"} />
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="resume">Resume</TabsTrigger>
          <TabsTrigger value="private-info">Private Info</TabsTrigger>
          {isAdmin ? <TabsTrigger value="salary-info">Salary Info</TabsTrigger> : null}
          {isSelf ? <TabsTrigger value="security">Security</TabsTrigger> : null}
        </TabsList>
        <TabsContent value="resume">
          <ResumeTab employeeId={emp.id} editable={isSelf || isPrivileged} />
        </TabsContent>
        <TabsContent value="private-info">
          <PrivateInfoTab employeeId={emp.id} editable={isSelf || isPrivileged} />
        </TabsContent>
        {isAdmin ? (
          <TabsContent value="salary-info">
            <SalaryInfoTab employeeId={emp.id} />
          </TabsContent>
        ) : null}
        {isSelf ? (
          <TabsContent value="security">
            <SecurityTab employeeId={emp.id} />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
