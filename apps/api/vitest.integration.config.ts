import { join } from "node:path";
import { defineConfig } from "vitest/config";

// Loads .env.local so tests talk to the local stack; config refuses anything non-local.
process.loadEnvFile(join(import.meta.dirname, "../../.env.local"));

export default defineConfig({
  test: {
    name: "api-integration",
    include: ["test/integration/**/*.int.test.ts"],
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
