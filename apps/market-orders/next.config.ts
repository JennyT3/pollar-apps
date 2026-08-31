import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prisma's generated client lives under node_modules/.pnpm and Turbopack
  // can't resolve it when it externalizes @prisma/client on its own, which
  // 500s every API route in `pnpm dev` from a fresh clone. Listing the
  // packages here makes Node resolve them directly. Build/start and the
  // Vercel deploy were unaffected.
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-libsql",
    "@libsql/client",
  ],
};

export default nextConfig;
