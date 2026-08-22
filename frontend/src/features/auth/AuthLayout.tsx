import { Link } from "react-router-dom";

export function AuthLayout({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="bg-paper flex min-h-screen items-center justify-center px-4 py-10">
      <div className="rounded-card border-border bg-surface shadow-elevation animate-fade-rise-in w-full max-w-md space-y-6 border p-8">
        <Link to="/sign-in" className="flex items-center justify-center gap-2">
          <span className="rounded-card bg-primary-500 font-display flex h-9 w-9 items-center justify-center text-base font-semibold text-white">
            D
          </span>
          <span className="font-display text-ink-900 text-lg font-semibold">Dayflow</span>
        </Link>
        {children}
        {footer ? <div className="text-ink-500 text-center text-sm">{footer}</div> : null}
      </div>
    </div>
  );
}
