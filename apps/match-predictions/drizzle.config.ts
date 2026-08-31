import { defineConfig } from "drizzle-kit";
import {
  DATABASE_AUTH_TOKEN,
  DATABASE_URL,
  ensureLocalDbDir,
} from "./db/url";

ensureLocalDbDir();

export default defineConfig({
  dialect: "turso",
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dbCredentials: { url: DATABASE_URL, authToken: DATABASE_AUTH_TOKEN },
});
