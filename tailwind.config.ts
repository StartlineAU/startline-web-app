import type { Config } from "tailwindcss";

const config: Config = {
  // shadcn/ui requires a `dark` class strategy. We don't toggle dark mode at
  // runtime — the entire app is dark — but the strategy must be set so any
  // `dark:` variants compile.
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Existing project palette (rgb triples + alpha) ─────────────────
        primary: {
          DEFAULT: "rgb(var(--color-primary) / <alpha-value>)",
          light: "rgb(var(--color-primary-light) / <alpha-value>)",
          dark: "rgb(var(--color-primary-dark) / <alpha-value>)",
          // shadcn expects `primary-foreground` for on-primary text colour
          foreground: "hsl(var(--primary-foreground))",
        },
        dark: {
          DEFAULT: "rgb(var(--color-dark) / <alpha-value>)",
          darker: "rgb(var(--color-darker) / <alpha-value>)",
          light: "rgb(var(--color-dark-light) / <alpha-value>)",
          lighter: "rgb(var(--color-dark-lighter) / <alpha-value>)",
        },
        light: {
          DEFAULT: "rgb(var(--color-light) / <alpha-value>)",
          dark: "rgb(var(--color-light-dark) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
          light: "rgb(var(--color-muted-light) / <alpha-value>)",
          dark: "rgb(var(--color-muted-dark) / <alpha-value>)",
        },
        // ── shadcn/ui tokens (HSL) ─────────────────────────────────────────
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        title: ["var(--font-chakra-petch)", "var(--font-inter)", "system-ui", "sans-serif"],
        headline: ["var(--font-chakra-petch)", "sans-serif"],
        body: ["var(--font-inter)", "sans-serif"],
      },
      borderRadius: {
        // Project radii (preserved). shadcn's `lg/md/sm` are remapped to track
        // `--radius` so shadcn primitives use the same rounding scale.
        DEFAULT: "4px",
        none: "0px",
        sm: "calc(var(--radius) - 4px)", // shadcn → 4px
        md: "calc(var(--radius) - 2px)", // shadcn → 6px
        lg: "var(--radius)",             // shadcn → 8px
        xl: "12px",
        "2xl": "16px",
        "3xl": "24px",
        full: "9999px",
      },
      boxShadow: {
        machined: "2px 2px 0px 0px rgb(var(--color-primary))",
      },
      keyframes: {
        // shadcn Accordion expand/collapse keyframes
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
