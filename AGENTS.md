<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# shushi — build rules

Personal expense tracker: import bank/CC statements + payslips, categorize spending, track payouts. The full engineering guide lives at `~/dev-notes/guideline/` — this file is the binding, auto-loaded subset, adapted for this repo's Neon-in-app architecture.

## Precedence — which instruction wins

**User's explicit instruction (this session) > this file > `~/dev-notes/guideline/` > your defaults.**
- Silent → follow the guide. A "from now on" override → edit this file so it persists.

## Non-negotiables

- **Package manager: pnpm** — exclusively (never npm/yarn).
- **Architecture:** RSC-first; thin pages (`PageHeader` + client filter row + data). No client data-cache library; the **URL is list state**; mutations = `server action → toast → router.refresh()`.
- **Data access:** Prisma is touched ONLY inside `src/lib/services/*` (+ `src/lib/transfers`, seeds, scripts). Components and actions call services; **never inline Prisma in a page/component**. Server actions live in `src/app/(app)/<route>/actions.ts`, are zod-validated, and return `ActionResult<T>` (`src/lib/actions.ts`).
- **Auth:** Neon Auth (Better Auth) owns identity; `neon_auth.user` is mapped read-only (external tables in `prisma.config.ts` — NEVER migrated by Prisma). Server-side user = `getCurrentUser()`/`requireUser()` from `@/lib/auth` (React-cache-deduped). Auth UI = `@neondatabase/auth-ui` views at `/auth/[path]`.
- **Money = decimal strings** end to end (Prisma `Decimal(14,2)` → `.toFixed(2)` → string over the wire). Never JS float arithmetic on money; `Number()` only at the display/chart edge. Render via the `Amount` atom; format via `src/lib/format.ts` only.
- **Dashboards read precomputed rollups, never re-aggregate on load.** `MonthlySummary` / `CategorySummary` are materialized in `src/lib/services/summaries.ts` (`rebuildSummaries(userId, months?)`, delete-then-insert per month) and rebuilt on EVERY write that changes transactions (import commit, category edit, exclude toggle, rule apply, transfer unlink). `getDashboardData` sums those rows for Month/Year/FY (`src/lib/periods.ts`; FY = Apr–Mar, keyed by start year). When you add a transaction-mutating path, call `rebuildSummaries` for the affected month(s) or the whole user. Rollup definitions must stay identical to the analytics rules (exclude `excludeFromSpend` + TRANSFER-kind; count uncategorized).
- **Parsers are pure** (`src/lib/imports/parsers/*`): Buffer in → `ParsedStatement`/`ParsedPayslip` out (contract: `src/lib/imports/types.ts`). No DB, no enrichment — channel/counterparty extraction lives in `narration.ts`, dedupe in `dedupe.ts`, orchestration in `services/imports.ts`. Every parser has vitest tests against the real fixtures in `test/fixtures/` (git-ignored — real bank data, never commit).
- **Tokens only:** no raw hex, no Tailwind palette classes, **no `dark:` utilities** (dark = `.dark` variable swap in `globals.css`). Category/chart colors are token keys (`chart-1`…`chart-8`) resolved as `var(--chart-N)`.
- **One control height (`h-8`);** shadcn/Radix for every overlay/menu/dialog — never hand-rolled, never native `<select>`/`<input type="date">`.
- **Never disable CTAs** for validation: validate on submit, toast the first unmet requirement; busy = in-flight only, with a gerund label.
- **States always present:** loading (layout-mirroring skeleton) · empty (`EmptyState` + directional hint) · error (`role="alert"`). Never render a chart with empty data.
- **Hygiene:** delete the loser when a replacement wins; no `any` on shared surfaces; sweep the whole bug class, not just the reported case.

## Commands

- `pnpm dev` · `pnpm typecheck` · `pnpm lint` · `pnpm test` (vitest, parser suites need `test/fixtures/`)
- `pnpm build:check` — verification build in `.next-verify` so it never corrupts a live `next dev` cache. Never `next build`/`rm -rf .next` against a running dev server.
- `pnpm db:migrate` (dev, uses `DIRECT_URL`) · `pnpm db:deploy` · `pnpm db:seed` (idempotent categories/rules)
- `pnpm tsx --conditions=react-server scripts/integration-import.ts` — full pipeline check against the real DB with the real fixtures under a self-cleaning synthetic user.

## Environment

`.env`: `DATABASE_URL` (pooled `-pooler` host — runtime), `DIRECT_URL` (direct host — migrations), `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`. Credentials vault: `~/dev-notes/_private/shushi-credentials.md`. The Neon MCP connector is scoped to a different org — manage this DB via the connection string, not MCP tools.

## Definition of done (every change)

typecheck + lint + tests clean · looked at in light AND dark · loading/empty/error states exist · money renders through `Amount` · data access stayed inside services · parser changes covered by a fixture test.
