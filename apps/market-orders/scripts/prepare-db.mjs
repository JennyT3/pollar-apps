import { execSync } from "node:child_process";

const url = process.env.DATABASE_URL ?? "";

if (url.startsWith("libsql://")) {
  console.log("Remote libsql URL detected — skipping local database prep.");
  process.exit(0);
}

try {
  execSync("npx prisma db push --skip-generate", { stdio: "inherit" });
} catch (e) {
  console.error("Failed to prepare the local database:", e.message);
  process.exitCode = 1;
}