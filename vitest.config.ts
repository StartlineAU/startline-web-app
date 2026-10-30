import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    exclude: ["e2e", "node_modules", "video", ".next", ".opencode"],
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ||
        "postgresql://postgres:postgres@localhost:5432/startline?schema=public",
    },
  },
  // tsconfig keeps `jsx: "preserve"` for Next.js, so the JSX runtime has to be
  // named here for tests that render .tsx (the email templates).
  esbuild: {
    jsx: "automatic",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
