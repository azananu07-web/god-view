import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        surface: "var(--surface-1)",
        plane: "var(--plane)",
        ink: { DEFAULT: "var(--text-primary)", 2: "var(--text-secondary)", 3: "var(--text-muted)" },
        line: "var(--gridline)",
        brand: { DEFAULT: "#2a78d6", dark: "#1c5cab" },
        good: "#0ca30c",
        warn: "#fab219",
        serious: "#ec835a",
        critical: "#d03b3b",
      },
      fontFamily: { sans: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"] },
    },
  },
  plugins: [],
} satisfies Config;
