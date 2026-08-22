import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { changePasswordSchema, type ChangePasswordInput } from "@dayflow/shared";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/useToast";
import { api, ApiClientError } from "@/lib/api";

interface SessionItem {
  id: string;
  createdAt: string;
  expiresAt: string;
}

export function SecurityTab({ employeeId }: { employeeId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const sessionsQuery = useQuery({
    queryKey: ["sessions", employeeId],
    queryFn: () => api.get<{ data: SessionItem[] }>(`/profile/${employeeId}/sessions`),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema) });

  const changePasswordMutation = useMutation({
    mutationFn: (values: ChangePasswordInput) => api.post("/auth/change-password", values),
    onSuccess: () => {
      reset();
      toast({ variant: "success", title: "Password changed" });
    },
    onError: (err) => {
      setFormError(err instanceof ApiClientError ? err.message : "Something went wrong.");
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (sessionId: string) => api.delete(`/profile/${employeeId}/sessions/${sessionId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sessions", employeeId] }),
  });

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      <div>
        <p className="text-ink-500 mb-3 text-xs font-semibold uppercase tracking-wide">
          Change password
        </p>
        <form
          onSubmit={handleSubmit((values) => {
            setFormError(null);
            changePasswordMutation.mutate(values);
          })}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="currentPassword">Current password</Label>
            <Input id="currentPassword" type="password" {...register("currentPassword")} />
            {errors.currentPassword ? (
              <p className="text-danger text-xs">{errors.currentPassword.message}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="newPassword">New password</Label>
            <Input id="newPassword" type="password" {...register("newPassword")} />
            {errors.newPassword ? (
              <p className="text-danger text-xs">{errors.newPassword.message}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input id="confirmPassword" type="password" {...register("confirmPassword")} />
            {errors.confirmPassword ? (
              <p className="text-danger text-xs">{errors.confirmPassword.message}</p>
            ) : null}
          </div>
          {formError ? <p className="text-danger text-xs">{formError}</p> : null}
          <Button type="submit" disabled={isSubmitting || changePasswordMutation.isPending}>
            {changePasswordMutation.isPending ? "Changing…" : "Change password"}
          </Button>
        </form>
      </div>

      <div>
        <p className="text-ink-500 mb-3 text-xs font-semibold uppercase tracking-wide">
          Active sessions
        </p>
        {sessionsQuery.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <div className="divide-border rounded-card border-border divide-y border text-sm">
            {sessionsQuery.data?.data.length ? (
              sessionsQuery.data.data.map((s) => (
                <div key={s.id} className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-ink-700">
                    Since {format(new Date(s.createdAt), "dd MMM yyyy, HH:mm")}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => revokeMutation.mutate(s.id)}
                    disabled={revokeMutation.isPending}
                  >
                    Revoke
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-ink-400 px-3 py-2.5">No active sessions.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
