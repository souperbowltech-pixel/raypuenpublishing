import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // Modules under test import through the "@/..." alias, the same way the app does.
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "lib/**/*.test.tsx"],
  },
});
