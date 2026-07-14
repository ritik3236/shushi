# shushi

Personal expense tracker. Drop in bank statements, credit-card statements, and payslips — get categorized spending, income tracking, self-transfer detection, and payout matching.

**Stack:** Next.js 16 (App Router, RSC-first) · React 19 · Tailwind v4 + shadcn (radix-nova) · Prisma 7 (pg driver adapter) · Neon Postgres + Neon Auth (Better Auth) · vitest · pnpm.

## What it understands

| Format | File | Parser |
|---|---|---|
| Axis Bank savings statement | `.csv` | `axis-savings-csv.ts` |
| HDFC Bank savings statement | `.xls` (BIFF) | `hdfc-savings-xls.ts` |
| Axis Flipkart credit card monthly statement | `.xlsx` | `axis-cc-xlsx.ts` |
| BizDaddy payslip / contractor fee statement | `.pdf` | `payslip-pdf.ts` |

Password-protected files are decrypted on upload (`officecrypto-tool`). Format detection is content-based, never filename-based.

## Pipeline

```
upload → detect + parse (pure) → enrich (channel/counterparty, rules, dedupe keys)
      → PENDING import + preview (new vs duplicate rows)
      → commit (idempotent createMany, skipDuplicates)
      → transfer detection (UPI-ref exact / CC payment / self-name heuristic)
      → payslip ↔ bank-credit matching
```

Re-importing the same or overlapping statements is safe by construction: row identity is `(account, date, direction, amount, narration, occurrence)`.

## Setup

```bash
pnpm install
cp .env.example .env        # fill: DATABASE_URL (pooled), DIRECT_URL, NEON_AUTH_BASE_URL, NEON_AUTH_COOKIE_SECRET
pnpm db:deploy              # apply migrations (direct connection)
pnpm db:seed                # system categories + auto-categorization rules (idempotent)
pnpm dev
```

Neon Auth must be provisioned on the Neon project (Console → Branch → Auth); `neon_auth.*` tables are externally managed — see `prisma.config.ts`.

## Verify

```bash
pnpm typecheck && pnpm lint && pnpm test   # parser suites run against test/fixtures/ (git-ignored real data)
pnpm tsx --conditions=react-server scripts/integration-import.ts   # full pipeline vs real DB, self-cleaning
pnpm build:check                           # prod build in .next-verify (never clashes with dev)
```

Engineering rules: [AGENTS.md](AGENTS.md).
