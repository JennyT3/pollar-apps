import { defineConfig } from 'drizzle-kit';

const isLocal = !process.env.DATABASE_URL;

export default defineConfig({
  schema: './db/schema.ts',
  out: './drizzle',
  dialect: isLocal ? 'sqlite' : 'postgresql',
  dbCredentials: { url: isLocal ? 'file:./data/local.db' : process.env.DATABASE_URL! },
});

