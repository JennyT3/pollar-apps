import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Same `@/…` alias the app uses, so tests import modules exactly as the
    // app does instead of through relative paths that drift when files move.
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: { include: ["lib/**/*.test.ts"] },
});
