import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useSearchParams } from "react-router-dom";
import { resetPasswordSchema, type ResetPasswordInput } from "@dayflow/shared";
import { CheckCircle2 } from "lucide-react";

import { AuthLayout } from "@/features/auth/AuthLayout";
import { authErrorMessage } from "@/features/auth/errorMessages";
import { PasswordStrengthMeter } from "@/features/auth/PasswordStrengthMeter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") ?? "";
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token },
  });

  const password = watch("newPassword") ?? "";

  const onSubmit = async (values: ResetPasswordInput) => {
    setFormError(null);
    try {
      await api.post("/auth/reset-password", values, { skipRefresh: true });
      setDone(true);
      setTimeout(() => navigate("/sign-in"), 2000);
    } catch (err) {
      setFormError(authErrorMessage(err));
    }
  };

  if (!token) {
    return (
      <AuthLayout>
        <p className="text-danger text-center text-sm">This reset link is missing its token.</p>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center gap-3 text-center">
          <CheckCircle2 className="text-present h-10 w-10" aria-hidden="true" />
          <p className="font-display text-ink-900 text-lg font-semibold">Password updated</p>
          <p className="text-ink-500 text-sm">Redirecting you to sign in…</p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="space-y-1 text-center">
        <h1 className="font-display text-ink-900 text-xl font-semibold">Set a new password</h1>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <input type="hidden" {...register("token")} />
        {formError ? (
          <div
            role="alert"
            className="rounded-card border-danger-100 bg-danger-100/60 text-danger border px-3 py-2 text-sm"
          >
            {formError}
          </div>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="newPassword" required>
            New password
          </Label>
          <Input
            id="newPassword"
            type="password"
            invalid={!!errors.newPassword}
            {...register("newPassword")}
          />
          {errors.newPassword ? (
            <p className="text-danger text-xs">{errors.newPassword.message}</p>
          ) : null}
          <PasswordStrengthMeter password={password} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword" required>
            Confirm password
          </Label>
          <Input
            id="confirmPassword"
            type="password"
            invalid={!!errors.confirmPassword}
            {...register("confirmPassword")}
          />
          {errors.confirmPassword ? (
            <p className="text-danger text-xs">{errors.confirmPassword.message}</p>
          ) : null}
        </div>
        <Button type="submit" className="w-full" loading={isSubmitting}>
          Reset password
        </Button>
      </form>
    </AuthLayout>
  );
}
