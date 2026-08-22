import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { Check, Eye, EyeOff, Upload, X } from "lucide-react";
import { registerCompanySchema, type RegisterCompanyInput } from "@dayflow/shared";

// The shared schema validates logoUrl as a full URL, but the sign-up form
// only ever collects a local file preview (no upload endpoint exists yet —
// see plan notes), so the form validates everything except that field, with
// its own copy of the password-match refine.
const signUpFormSchema = registerCompanySchema
  .innerType()
  .omit({ logoUrl: true })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

import { AuthLayout } from "@/features/auth/AuthLayout";
import { authErrorMessage } from "@/features/auth/errorMessages";
import { PasswordStrengthMeter } from "@/features/auth/PasswordStrengthMeter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/useToast";
import { cn } from "@/lib/cn";

type SignUpForm = Omit<RegisterCompanyInput, "logoUrl">;

export function SignUpPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignUpForm>({
    resolver: zodResolver(signUpFormSchema),
  });

  const password = watch("password") ?? "";
  const confirmPassword = watch("confirmPassword") ?? "";

  const onSubmit = async (values: SignUpForm) => {
    setFormError(null);
    try {
      const result = await api.post<{ verifyUrl?: string }>("/auth/register-company", values, {
        skipRefresh: true,
      });
      toast({
        variant: "success",
        title: "Company created",
        description: "Check your email to verify your account.",
      });
      navigate(
        "/verify" + (result.verifyUrl ? `?devUrl=${encodeURIComponent(result.verifyUrl)}` : ""),
        {
          state: { justRegistered: true },
        },
      );
    } catch (err) {
      setFormError(authErrorMessage(err));
    }
  };

  return (
    <AuthLayout
      footer={
        <>
          Already have an account?{" "}
          <a href="/sign-in" className="text-primary-500 font-medium hover:underline">
            Sign In
          </a>
        </>
      }
    >
      <div className="space-y-1 text-center">
        <h1 className="font-display text-ink-900 text-xl font-semibold">Create your company</h1>
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
          <Label htmlFor="companyName" required>
            Company Name
          </Label>
          <div className="flex gap-2">
            <Input
              id="companyName"
              invalid={!!errors.companyName}
              className="flex-1"
              {...register("companyName")}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => setLogoPreview(reader.result as string);
                reader.readAsDataURL(file);
              }}
            />
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Upload company logo"
              title="Upload company logo"
            >
              {logoPreview ? (
                <img src={logoPreview} alt="" className="h-6 w-6 rounded object-cover" />
              ) : (
                <Upload className="h-4 w-4" aria-hidden="true" />
              )}
            </Button>
          </div>
          {errors.companyName ? (
            <p className="text-danger text-xs">{errors.companyName.message}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="adminName" required>
            Name
          </Label>
          <Input id="adminName" invalid={!!errors.adminName} {...register("adminName")} />
          {errors.adminName ? (
            <p className="text-danger text-xs">{errors.adminName.message}</p>
          ) : null}
        </div>

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

        <div className="space-y-1.5">
          <Label htmlFor="phone" required>
            Phone
          </Label>
          <Input id="phone" type="tel" invalid={!!errors.phone} {...register("phone")} />
          {errors.phone ? <p className="text-danger text-xs">{errors.phone.message}</p> : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" required>
            Password
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
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
          <PasswordStrengthMeter password={password} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword" required>
            Confirm Password
          </Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              invalid={!!errors.confirmPassword}
              className="pr-10"
              {...register("confirmPassword")}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              className="text-ink-400 hover:text-ink-700 focus-visible:ring-focusRing absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2"
              aria-label={showConfirm ? "Hide password" : "Show password"}
            >
              {showConfirm ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
          {errors.confirmPassword ? (
            <p className="text-danger text-xs">{errors.confirmPassword.message}</p>
          ) : confirmPassword ? (
            <p
              className={cn(
                "flex items-center gap-1 text-xs",
                confirmPassword === password ? "text-present" : "text-danger",
              )}
            >
              {confirmPassword === password ? (
                <Check className="h-3 w-3" aria-hidden="true" />
              ) : (
                <X className="h-3 w-3" aria-hidden="true" />
              )}
              {confirmPassword === password ? "Passwords match" : "Passwords don't match"}
            </p>
          ) : null}
        </div>

        <Button type="submit" className="w-full" loading={isSubmitting}>
          Sign Up
        </Button>
      </form>

      <p className="text-ink-500 text-center text-xs leading-relaxed">
        Signing up creates your company. You&apos;ll add your team from inside Dayflow — we generate
        their Login IDs and passwords automatically.
      </p>
    </AuthLayout>
  );
}
