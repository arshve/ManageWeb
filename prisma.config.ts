import { config } from 'dotenv';
import { existsSync } from 'fs';
import path from 'path';
import { defineConfig, env } from "prisma/config";

// Prefer .env.local (local dev) over .env (prod fallback) when present.
const localPath = path.join(process.cwd(), '.env.local');
config({
  path: existsSync(localPath) ? localPath : path.join(process.cwd(), '.env'),
  override: true,
});

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    url: env("DATABASE_URL"),
    directUrl: env("DIRECT_URL"),
  },
});
