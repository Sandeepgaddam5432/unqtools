import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        unq: {
          bg: "var(--bg)",
          surface: "var(--surface)",
          "surface-2": "var(--surface-2)",
          "surface-hover": "var(--surface-hover)",
          border: "var(--border)",
          "border-subtle": "var(--border-subtle)",
          "border-strong": "var(--border-strong)",
          text: "var(--text)",
          "text-muted": "var(--text-muted)",
          "text-subtle": "var(--text-subtle)",
          accent: "var(--accent)",
          "accent-hover": "var(--accent-hover)",
          "accent-subtle": "var(--accent-subtle)",
          "accent-contrast": "var(--accent-contrast)",
          success: "var(--success)",
          "success-subtle": "var(--success-subtle)",
          warning: "var(--warning)",
          "warning-subtle": "var(--warning-subtle)",
          danger: "var(--danger)",
          "danger-subtle": "var(--danger-subtle)",
        },
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono: ["SF Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius)",
        lg: "var(--radius-lg)",
        pill: "var(--radius-pill)",
      },
    },
  },
  plugins: [],
};

export default config;
