import { ApiClientError } from "@/lib/api";

// Distinct copy per backend error code — Dayflow-Blueprint-v2.md §11 (S1) and
// the voice guidance in §12: name the problem and, where possible, the fix.
const MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: "That Login ID/email or password isn't right. Double-check and try again.",
  EMAIL_NOT_VERIFIED:
    "Verify your email before signing in — check your inbox for the link we sent.",
  ACCOUNT_SUSPENDED: "This account has been suspended. Contact your company admin.",
  PASSWORD_CHANGE_REQUIRED: "You need to set a new password before continuing.",
  COMPANY_NAME_TAKEN: "A company with this name already exists. Try a more specific name.",
  EMAIL_TAKEN: "An account with this email already exists. Sign in instead.",
  TOKEN_EXPIRED: "This link has expired. Request a new one.",
  TOKEN_ALREADY_USED: "This link has already been used.",
  INVALID_TOKEN: "This link isn't valid. Request a new one.",
  VALIDATION_ERROR: "Check the highlighted field and try again.",
  LOGIN_ID_COLLISION:
    "Couldn't generate a unique Login ID for this company code. Try a different company name.",
};

export function authErrorMessage(err: unknown): string {
  if (err instanceof ApiClientError) {
    return MESSAGES[err.code] ?? err.message;
  }
  return "Something went wrong. Please try again.";
}
