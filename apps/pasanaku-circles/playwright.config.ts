import { defineConfig } from "@playwright/test";

const PORT = 3333;
const HORIZON = 9876;

export default defineConfig({
  testDir: "./e2e",
  testIgnore: process.env.SCREENSHOTS === "1" ? undefined : /screenshots\.spec\.ts/,
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
  },
  webServer: [
    {
      command: "node e2e/helpers/horizon-server.mjs",
      url: `http://127.0.0.1:${HORIZON}/health`,
      reuseExistingServer: false,
      env: { MOCK_HORIZON_PORT: String(HORIZON) },
    },
    {
      command: `pnpm exec next dev --port ${PORT}`,
      url: `http://127.0.0.1:${PORT}`,
      reuseExistingServer: false,
      env: {
        TURSO_DATABASE_URL: "file:./data/e2e.db",
        STELLAR_HORIZON_URL: `http://127.0.0.1:${HORIZON}`,
        NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY:
          process.env.NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY ?? "pub_testnet_e2e_placeholder",
      },
    },
  ],
});
