import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        unq: {
          bg: "var(--unq-color-bg)",
          surface: "var(--unq-color-surface)",
          border: "var(--unq-color-border)",
          text: "var(--unq-color-text)",
          muted: "var(--unq-color-muted)",
          primary: "var(--unq-color-primary)",
          "primary-hover": "var(--unq-color-primary-hover)",
          accent: "var(--unq-color-accent)",
          danger: "var(--unq-color-danger)",
          success: "var(--unq-color-success)",
        },
      },
      fontFamily: {
        sans: [
          "InterVariable",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      borderRadius: {
        unq: "var(--unq-radius)",
      },
      boxShadow: {
        unq: "var(--unq-shadow)",
        "unq-lg": "var(--unq-shadow-lg)",
      },
      maxWidth: {
        shell: "1200px",
      },
    },
  },
  plugins: [],
};

export default config;
