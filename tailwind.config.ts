import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "rgb(var(--color-primary) / <alpha-value>)",
          light: "rgb(var(--color-primary-light) / <alpha-value>)",
          dark: "rgb(var(--color-primary-dark) / <alpha-value>)",
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
          DEFAULT: "rgb(var(--color-muted) / <alpha-value>)",
          light: "rgb(var(--color-muted-light) / <alpha-value>)",
          dark: "rgb(var(--color-muted-dark) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
