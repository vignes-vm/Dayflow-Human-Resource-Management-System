// Dayflow design system — semantic token names wired to the CSS variables in
// src/styles/tokens.css. Never hand-roll a colour here; add a variable to
// tokens.css and expose it below. See docs/Dayflow-Team-Plan.md §2.3 — M2 ONLY.
import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
  darkMode: ["class", '[data-theme="dark"]'],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "var(--paper)",
        surface: {
          DEFAULT: "var(--surface)",
          raised: "var(--surface-raised)",
        },
        border: "var(--border)",
        ink: {
          900: "var(--ink-900)",
          800: "var(--ink-800)",
          700: "var(--ink-700)",
          600: "var(--ink-600)",
          500: "var(--ink-500)",
          400: "var(--ink-400)",
          300: "var(--ink-300)",
          200: "var(--ink-200)",
          100: "var(--ink-100)",
        },
        primary: {
          DEFAULT: "var(--primary-500)",
          500: "var(--primary-500)",
          600: "var(--primary-600)",
          100: "var(--primary-100)",
        },
        present: "var(--present)",
        half: "var(--half)",
        leave: "var(--leave)",
        absent: "var(--absent)",
        holiday: "var(--holiday)",
        danger: {
          DEFAULT: "var(--danger)",
          100: "var(--danger-100)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          100: "var(--warning-100)",
        },
        success: {
          DEFAULT: "var(--success)",
          100: "var(--success-100)",
        },
        focusRing: "var(--focus-ring)",
      },
      borderRadius: {
        card: "var(--radius-card)",
      },
      boxShadow: {
        elevation: "var(--shadow-elevation)",
      },
      fontFamily: {
        display: "var(--font-display)",
        body: "var(--font-body)",
        mono: "var(--font-mono)",
      },
      transitionTimingFunction: {
        standard: "var(--ease-standard)",
      },
      transitionDuration: {
        fast: "120ms",
        base: "200ms",
        slow: "320ms",
      },
      keyframes: {
        "fade-rise-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-rise-in": "fade-rise-in 200ms var(--ease-standard)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
