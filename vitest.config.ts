import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // Modules under test import through the "@/..." alias, the same way the app does.
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  // tsconfig keeps jsx: "preserve" for Next's own compiler; tests are rendered
  // with react-dom/server here, so they need the runtime transform.
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: [
      "lib/**/*.test.ts",
      "lib/**/*.test.tsx",
      "components/**/*.test.tsx",
      // API routes, so the one that moves money is covered too (AUDIT TEST-01).
      "app/**/*.test.ts",
    ],
  },
});
