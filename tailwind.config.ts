import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: ["./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "oklch(var(--bg) / <alpha-value>)",
        surface: "oklch(var(--surface) / <alpha-value>)",
        "surface-2": "oklch(var(--surface-2) / <alpha-value>)",
        border: "oklch(var(--border) / <alpha-value>)",
        fg: "oklch(var(--fg) / <alpha-value>)",
        "fg-muted": "oklch(var(--fg-muted) / <alpha-value>)",
        "fg-subtle": "oklch(var(--fg-subtle) / <alpha-value>)",
        accent: "oklch(var(--accent) / <alpha-value>)",
        "accent-fg": "oklch(var(--accent-fg) / <alpha-value>)",
        "accent-soft": "oklch(var(--accent-soft) / <alpha-value>)",
        "accent-contrast": "oklch(var(--accent-fg) / <alpha-value>)",
        "accent-fill": "oklch(var(--accent-fill, var(--accent)) / <alpha-value>)",
        success: "oklch(var(--success) / <alpha-value>)",
        warning: "oklch(var(--warning) / <alpha-value>)",
        danger: "oklch(var(--danger) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["JetBrains Mono", "SF Mono", "Menlo", "monospace"],
      },
      fontSize: {
        "2xs": ["clamp(0.6875rem, 0.66rem + 0.13vw, 0.75rem)", { lineHeight: "1rem" }],
        xs: ["clamp(0.75rem, 0.72rem + 0.15vw, 0.8125rem)", { lineHeight: "1.125rem" }],
        sm: ["clamp(0.8125rem, 0.78rem + 0.25vw, 0.875rem)", { lineHeight: "1.25rem" }],
        base: ["clamp(0.9375rem, 0.9rem + 0.35vw, 1rem)", { lineHeight: "1.5rem" }],
        lg: ["clamp(1.0625rem, 1rem + 0.5vw, 1.1875rem)", { lineHeight: "1.5rem" }],
        xl: ["clamp(1.25rem, 1.15rem + 0.75vw, 1.5rem)", { lineHeight: "1.75rem" }],
        "2xl": ["clamp(1.5rem, 1.3rem + 1.2vw, 2rem)", { lineHeight: "2rem" }],
        "3xl": ["clamp(1.875rem, 1.55rem + 1.8vw, 2.5rem)", { lineHeight: "2.25rem" }],
        "4xl": ["clamp(2.25rem, 1.8rem + 2.5vw, 3.25rem)", { lineHeight: "1.1" }],
        "5xl": ["clamp(2.75rem, 2.1rem + 3.5vw, 4rem)", { lineHeight: "1.05" }],
      },
      borderRadius: {
        xs: "calc(var(--radius) * 0.5)",
        sm: "calc(var(--radius) * 0.75)",
        md: "var(--radius)",
        lg: "calc(var(--radius) * 1.5)",
        xl: "calc(var(--radius) * 2)",
        "2xl": "calc(var(--radius) * 3)",
      },
      spacing: {
        "4.5": "1.125rem",
        "13": "3.25rem",
        "18": "4.5rem",
        "22": "5.5rem",
      },
      boxShadow: {
        soft: "0 1px 2px oklch(0 0 0 / 0.04), 0 1px 3px oklch(0 0 0 / 0.06)",
        lift: "0 4px 12px -2px oklch(0 0 0 / 0.08), 0 2px 6px -2px oklch(0 0 0 / 0.05)",
        float: "0 12px 32px -8px oklch(0 0 0 / 0.12), 0 4px 12px -4px oklch(0 0 0 / 0.06)",
        glow: "0 0 0 1px oklch(var(--accent) / 0.2), 0 4px 16px -2px oklch(var(--accent) / 0.25)",
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.22, 1, 0.36, 1)",
        "spring-out": "cubic-bezier(0.16, 1, 0.3, 1)",
        "ease-emphasis": "cubic-bezier(0.32, 0.72, 0, 1)",
      },
      transitionDuration: {
        "150": "150ms",
        "250": "250ms",
        "400": "400ms",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
      animation: {
        "fade-in": "fade-in 200ms cubic-bezier(0.22, 1, 0.36, 1)",
        "slide-up": "slide-up 250ms cubic-bezier(0.22, 1, 0.36, 1)",
        "scale-in": "scale-in 150ms cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
