import { cn } from "@/lib/cn";

function scorePassword(password: string): number {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (password.length >= 12) score++;
  return Math.min(score, 4);
}

const LABELS = ["Too weak", "Weak", "Fair", "Good", "Strong"];
const COLORS = ["bg-danger", "bg-danger", "bg-warning", "bg-present", "bg-present"];

export function PasswordStrengthMeter({ password }: { password: string }) {
  const score = scorePassword(password);
  if (!password) return null;

  return (
    <div className="space-y-1" aria-live="polite">
      <div className="flex gap-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "bg-ink-200 h-1 flex-1 rounded-full transition-colors",
              i < score && COLORS[score],
            )}
          />
        ))}
      </div>
      <p className="text-ink-500 text-xs">{LABELS[score]}</p>
    </div>
  );
}
