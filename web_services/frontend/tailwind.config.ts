import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0f172a",
        surface: "#0f172a",
        "surface-container": "#1e293b",
        "surface-container-high": "#334155",
        "primary-container": "#374572",
        "on-surface": "#e2e8f0",
        "on-surface-variant": "#c4c6cf",
        primary: "#b3c2f7",
        secondary: "#cfd3eb",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      fontFamily: {
        body: ["var(--font-inter)", "Inter", "sans-serif"],
        headline: ["var(--font-manrope)", "Manrope", "sans-serif"],
        label: ["var(--font-inter)", "Inter", "sans-serif"],
        manrope: ["var(--font-manrope)", "Manrope", "sans-serif"],
      },
      keyframes: {
        "slow-gradient": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
      },
      animation: {
        gradient: "slow-gradient 15s ease infinite",
      },
    },
  },
  plugins: [],
};

export default config;
