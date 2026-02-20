import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#A6E22E",
          light: "#B8F040",
          dark: "#8BC420",
        },
        dark: {
          DEFAULT: "#1F1F1F",
          darker: "#141414",
          light: "#2A2A2A",
          lighter: "#353535",
        },
        light: {
          DEFAULT: "#F5F7FA",
          dark: "#E8EBF0",
        },
        muted: {
          DEFAULT: "#8A8F98",
          light: "#A0A5AE",
          dark: "#6E737B",
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
