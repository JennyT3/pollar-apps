import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@libsql/client', 'better-sqlite3'],
};

export default nextConfig;
