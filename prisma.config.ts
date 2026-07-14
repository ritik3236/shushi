import path from "node:path"

import { config as loadEnv } from "dotenv"
import { defineConfig, env } from "prisma/config"

// Prisma 7 no longer auto-loads .env when evaluating this config file.
loadEnv()

// Prisma 7 keeps connection + migration config out of schema.prisma and here
// instead. Migrations run against the DIRECT (non-pooled) connection; the
// runtime client uses the pooled DATABASE_URL via a driver adapter (src/lib/prisma.ts).
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  experimental: {
    externalTables: true,
  },
  // The whole neon_auth schema is created and managed by Neon Auth (Better
  // Auth) — `user` is mapped in schema.prisma for FKs and reads, the rest are
  // invisible to the app. All must be external so Prisma neither migrates nor
  // flags them as drift.
  tables: {
    external: [
      "neon_auth.user",
      "neon_auth.account",
      "neon_auth.session",
      "neon_auth.verification",
      "neon_auth.organization",
      "neon_auth.member",
      "neon_auth.invitation",
      "neon_auth.jwks",
      "neon_auth.project_config",
    ],
  },
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
    // The shadow database Prisma diffs against knows nothing about Neon Auth,
    // so recreate the external table there for FK resolution.
    initShadowDb: `
      CREATE SCHEMA IF NOT EXISTS neon_auth;
      CREATE TABLE neon_auth."user" (
        "id" uuid PRIMARY KEY,
        "name" text NOT NULL,
        "email" text NOT NULL UNIQUE,
        "emailVerified" boolean NOT NULL,
        "image" text,
        "role" text,
        "banned" boolean,
        "banReason" text,
        "banExpires" timestamptz(3),
        "createdAt" timestamptz(3) NOT NULL,
        "updatedAt" timestamptz(3) NOT NULL
      );
    `,
  },
  datasource: {
    // Migrations use the direct (non-pooled) connection. Prisma auto-creates a
    // temporary shadow database for dev migrations (neondb_owner has CREATEDB).
    url: env("DIRECT_URL"),
  },
})
