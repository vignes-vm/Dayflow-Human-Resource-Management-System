import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { loginSchema, type LoginInput } from "@dayflow/shared";

import { AuthLayout } from "@/features/auth/AuthLayout";
import { authErrorMessage } from "@/features/auth/errorMessages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";

export function SignInPage() {
  const navigate = useNavigate();
  const { refetch } = useAuth();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginInput) => {
    setFormError(null);
    try {
      const result = await api.post<{ mustChangePassword: boolean }>("/auth/login", values, {
        skipRefresh: true,
      });
      await refetch();
      navigate(result.mustChangePassword ? "/change-password" : "/employees", { replace: true });
    } catch (err) {
      setFormError(authErrorMessage(err));
      toast({ variant: "danger", title: "Sign in failed", description: authErrorMessage(err) });
    }
  };

  return (
    <AuthLayout
      footer={
        <>
          Don&apos;t have an Account?{" "}
          <a href="/sign-up" className="text-primary-500 font-medium hover:underline">
            Sign Up
          </a>
        </>
      }
    >
      <div className="space-y-1 text-center">
        <h1 className="font-display text-ink-900 text-xl font-semibold">Sign in to Dayflow</h1>
        <p className="text-ink-500 text-sm">Every workday, perfectly aligned.</p>
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
          <Label htmlFor="identifier" required>
            Login ID / Email
          </Label>
          <Input
            id="identifier"
            autoComplete="username"
            invalid={!!errors.identifier}
            {...register("identifier")}
          />
          {errors.identifier ? (
            <p className="text-danger text-xs">{errors.identifier.message}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" required>
            Password
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              invalid={!!errors.password}
              className="pr-10"
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="text-ink-400 hover:text-ink-700 focus-visible:ring-focusRing absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
          {errors.password ? (
            <p className="text-danger text-xs">{errors.password.message}</p>
          ) : null}
          <div className="text-right">
            <a href="/forgot-password" className="text-primary-500 text-xs hover:underline">
              Forgot password?
            </a>
          </div>
        </div>

        <Button type="submit" className="w-full" loading={isSubmitting}>
          Sign In
        </Button>
      </form>

      <div className="rounded-card border-border bg-ink-100/40 text-ink-500 border border-dashed p-3 text-xs">
        <p className="text-ink-700 mb-1 font-medium">Demo accounts</p>
        <p>Seed data lands in Step 20 — demo Admin / HR / Employee credentials will appear here.</p>
      </div>
    </AuthLayout>
  );
}
