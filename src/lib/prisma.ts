import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

// node-postgres (via pg-connection-string) emits a one-time SECURITY deprecation
// warning when the connection string uses sslmode=prefer|require|verify-ca, because
// pg v9 will give those weaker libpq semantics. Today they're all aliases for
// verify-full — which is exactly what we want against Neon's publicly-trusted certs —
// so we rewrite to the explicit mode: identical behavior, no warning.
const withExplicitSslMode = (connectionString: string) =>
  connectionString.replace(/([?&]sslmode=)(prefer|require|verify-ca)\b/i, "$1verify-full")

// Prisma 7 requires a driver adapter at runtime. PrismaPg (node-postgres) talks
// to any Postgres, including Neon over the pooled connection string.
const createPrismaClient = () => {
  const adapter = new PrismaPg(withExplicitSslMode(process.env.DATABASE_URL as string))
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  })
}

// Reuse a single client across hot-reloads in dev to avoid exhausting connections.
const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}
