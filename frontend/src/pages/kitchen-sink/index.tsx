import { Sun, Moon, Laptop } from "lucide-react";

import { useTheme } from "@/hooks/useTheme";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

// Auto-globs every demos/*.demo.tsx — add a component's states there and it
// appears here automatically. Dev-only route, per Dayflow-Team-Plan.md §2.3
// (`pages/kitchen-sink/index.tsx` is M2; each demo file is owned by whoever
// owns that component).
const demoModules = import.meta.glob<{ default: React.ComponentType; title?: string }>(
  "./demos/*.demo.tsx",
  { eager: true },
);

const demos = Object.entries(demoModules)
  .map(([path, mod]) => ({
    id: path,
    title: mod.title ?? path.replace("./demos/", "").replace(".demo.tsx", ""),
    Component: mod.default,
  }))
  .sort((a, b) => a.title.localeCompare(b.title));

export default function KitchenSink() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="bg-paper min-h-screen">
      <header className="border-border bg-surface/95 sticky top-0 z-10 flex items-center justify-between border-b px-6 py-3 backdrop-blur">
        <div>
          <h1 className="font-display text-ink-900 text-lg font-semibold">Kitchen sink</h1>
          <p className="text-ink-500 text-xs">Every Dayflow component, every state. Dev-only.</p>
        </div>
        <div className="rounded-card bg-ink-100 flex items-center gap-1 p-1">
          {(
            [
              { value: "light", icon: Sun },
              { value: "system", icon: Laptop },
              { value: "dark", icon: Moon },
            ] as const
          ).map(({ value, icon: Icon }) => (
            <Button
              key={value}
              size="icon"
              variant="ghost"
              className={cn("h-8 w-8", theme === value && "bg-surface shadow-sm")}
              onClick={() => setTheme(value)}
              aria-pressed={theme === value}
              aria-label={`${value} theme`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
            </Button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-10 px-6 py-8">
        {demos.map(({ id, title, Component }) => (
          <section key={id}>
            <h2 className="font-display text-ink-500 mb-3 text-sm font-semibold uppercase tracking-wide">
              {title}
            </h2>
            <div className="rounded-card border-border bg-surface border p-6">
              <Component />
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
