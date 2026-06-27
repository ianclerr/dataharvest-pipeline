import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/index.ts",         // entry point, no lógica testeable
        "src/db/migrations/**", // migraciones SQL
        "src/api/server.ts",    // setup de Express
      ],
      thresholds: {
        lines: 70,
      },
    },
    testTimeout: 90000, // Testcontainers necesita tiempo
  },
});