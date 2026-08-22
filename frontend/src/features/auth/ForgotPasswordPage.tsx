import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@dayflow/shared";
import { MailCheck } from "lucide-react";

import { AuthLayout } from "@/features/auth/AuthLayout";
import { authErrorMessage } from "@/features/auth/errorMessages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = async (values: ForgotPasswordInput) => {
    setFormError(null);
    try {
      await api.post("/auth/forgot-password", values, { skipRefresh: true });
      setSent(true);
    } catch (err) {
      setFormError(authErrorMessage(err));
    }
  };

  if (sent) {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center gap-3 text-center">
          <MailCheck className="text-present h-10 w-10" aria-hidden="true" />
          <p className="font-display text-ink-900 text-lg font-semibold">Check your email</p>
          <p className="text-ink-500 text-sm">
            If an account exists for that address, we&apos;ve sent a password reset link.
          </p>
          <Button asChild variant="secondary">
            <a href="/sign-in">Back to Sign In</a>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      footer={
        <a href="/sign-in" className="text-primary-500 font-medium hover:underline">
          Back to Sign In
        </a>
      }
    >
      <div className="space-y-1 text-center">
        <h1 className="font-display text-ink-900 text-xl font-semibold">Forgot password</h1>
        <p className="text-ink-500 text-sm">We&apos;ll email you a link to reset it.</p>
      </div>

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
          <Label htmlFor="email" required>
            Email
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            invalid={!!errors.email}
            {...register("email")}
          />
          {errors.email ? <p className="text-danger text-xs">{errors.email.message}</p> : null}
        </div>
        <Button type="submit" className="w-full" loading={isSubmitting}>
          Send reset link
        </Button>
      </form>
    </AuthLayout>
  );
}
