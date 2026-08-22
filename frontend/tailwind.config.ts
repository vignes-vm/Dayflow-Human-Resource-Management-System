// Base Tailwind config from the Step 1 scaffold. M2 wires the semantic token
// names (bg-paper, text-ink-700, etc.) into `theme.extend` in Step 3 — see
// docs/Dayflow-Team-Plan.md §2.3. Do not hand-roll colours here in the meantime.
import type { Config } from "tailwindcss";

export default {
  darkMode: ["class", '[data-theme="dark"]'],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;
