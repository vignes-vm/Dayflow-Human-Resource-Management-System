import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, XCircle } from "lucide-react";

import { AuthLayout } from "@/features/auth/AuthLayout";
import { authErrorMessage } from "@/features/auth/errorMessages";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

type Status = "loading" | "success" | "expired" | "used" | "invalid";

export function VerifyPage() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    api
      .get(`/auth/verify?token=${encodeURIComponent(token)}`, { skipRefresh: true })
      .then(() => {
        setStatus("success");
        setTimeout(() => {
          window.location.href = "/sign-in";
        }, 3000);
      })
      .catch((err) => {
        const msg = authErrorMessage(err);
        setMessage(msg);
        if (msg.includes("expired")) setStatus("expired");
        else if (msg.includes("already been used")) setStatus("used");
        else setStatus("invalid");
      });
  }, [token]);

  if (status === "loading") {
    return (
      <AuthLayout>
        <p className="text-ink-500 text-center text-sm">Verifying your email…</p>
      </AuthLayout>
    );
  }

  if (status === "success") {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center gap-3 text-center">
          <CheckCircle2 className="text-present h-10 w-10" aria-hidden="true" />
          <p className="font-display text-ink-900 text-lg font-semibold">Email verified</p>
          <p className="text-ink-500 text-sm">Redirecting you to sign in…</p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="flex flex-col items-center gap-3 text-center">
        <XCircle className="text-danger h-10 w-10" aria-hidden="true" />
        <p className="font-display text-ink-900 text-lg font-semibold">
          {status === "expired"
            ? "Link expired"
            : status === "used"
              ? "Already verified"
              : "Invalid link"}
        </p>
        <p className="text-ink-500 text-sm">
          {message || "This verification link couldn't be used."}
        </p>
        <Button asChild variant="secondary">
          <a href="/sign-in">Back to Sign In</a>
        </Button>
      </div>
    </AuthLayout>
  );
}
