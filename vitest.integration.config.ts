import { defineConfig } from "vitest/config";
import path from "node:path";

// Integration tests hit a real PostgreSQL database (DATABASE_URL_TEST). They run serially
// because each file creates and deletes its own tenants.
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.int.test.ts"],
    setupFiles: ["./src/test/integration-setup.ts"],
    fileParallelism: false,
    testTimeout: 20_000,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
