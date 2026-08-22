import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { changePasswordSchema, type ChangePasswordInput } from "@dayflow/shared";
import { ShieldAlert } from "lucide-react";

import { authErrorMessage } from "@/features/auth/errorMessages";
import { PasswordStrengthMeter } from "@/features/auth/PasswordStrengthMeter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";

/**
 * S5 — shown whenever mustChangePassword is set. Cannot be dismissed or
 * navigated away from: <ProtectedRoute> keeps redirecting here until the
 * password is changed. See Dayflow-Blueprint-v2.md §11.
 */
export function ForcedChangePasswordPage() {
  const { refetch } = useAuth();
  const { toast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema) });

  const newPassword = watch("newPassword") ?? "";

  const onSubmit = async (values: ChangePasswordInput) => {
    setFormError(null);
    try {
      await api.post("/auth/change-password", values);
      toast({ variant: "success", title: "Password changed" });
      await refetch();
    } catch (err) {
      setFormError(authErrorMessage(err));
    }
  };

  return (
    <div className="bg-paper flex min-h-screen items-center justify-center px-4 py-10">
      <div className="rounded-card border-border bg-surface shadow-elevation w-full max-w-md space-y-6 border p-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <ShieldAlert className="text-warning h-10 w-10" aria-hidden="true" />
          <h1 className="font-display text-ink-900 text-xl font-semibold">Set a new password</h1>
          <p className="text-ink-500 text-sm">
            Your account was created with a temporary password. You must set your own before you can
            continue.
          </p>
        </div>

        <ul className="rounded-card bg-ink-100/50 text-ink-600 list-inside list-disc space-y-1 p-3 text-xs">
          <li>At least 8 characters</li>
          <li>An uppercase and a lowercase letter</li>
          <li>At least one digit</li>
        </ul>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          {formError ? (
            <div
              role="alert"
              className="rounded-card border-danger-100 bg-danger-100/60 text-danger border px-3 py-2 text-sm"
            >
              {formError}
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="currentPassword" required>
              Temporary password
            </Label>
            <Input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              invalid={!!errors.currentPassword}
              {...register("currentPassword")}
            />
            {errors.currentPassword ? (
              <p className="text-danger text-xs">{errors.currentPassword.message}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="newPassword" required>
              New password
            </Label>
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              invalid={!!errors.newPassword}
              {...register("newPassword")}
            />
            {errors.newPassword ? (
              <p className="text-danger text-xs">{errors.newPassword.message}</p>
            ) : null}
            <PasswordStrengthMeter password={newPassword} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword" required>
              Confirm new password
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              invalid={!!errors.confirmPassword}
              {...register("confirmPassword")}
            />
            {errors.confirmPassword ? (
              <p className="text-danger text-xs">{errors.confirmPassword.message}</p>
            ) : null}
          </div>
          <Button type="submit" className="w-full" loading={isSubmitting}>
            Set new password
          </Button>
        </form>
      </div>
    </div>
  );
}
