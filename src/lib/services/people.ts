import "server-only"

import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { invalidateFilterOptions } from "@/lib/services/filter-options-cache"
import { NotFoundError, ValidationError } from "@/lib/errors"

// People ledger ("khata"). You REGISTER a person and give them tag labels; any
// transaction carrying one of those tags rolls up under them. That's how bank
// name-variants merge — tag "PRANJAL KUSHWAHA SO K" and "PRANJAL K" both
// "pranjal", register a person Pranjal with tag "pranjal". Each person's ledger
// sums given (debits) vs received (credits); net > 0 means they still owe you.
//
// Model: people → tags → transactions. A tag maps to at most one person (we
// strip it from others on assign) so a transaction is never counted twice.

function cleanTags(tags: string[]): string[] {
  return [
    ...new Set(
      tags.map((t) => t.trim().toLowerCase()).filter((t) => t.length > 0 && t.length <= 24)
    ),
  ].slice(0, 12)
}

export type PersonRow = {
  id: string
  name: string
  tags: string[]
  note: string | null
  given: string
  received: string
  net: string
  count: number
  lastDate: string | null
}

/** Registered people with their tag-based ledger totals. */
export async function listPeople(userId: string): Promise<PersonRow[]> {
  const rows = await prisma.$queryRaw<
    {
      id: string
      name: string
      tags: string[]
      note: string | null
      given: number
      received: number
      cnt: bigint
      last: Date | null
    }[]
  >`
    SELECT
      p.id, p.name, p.tags, p.note,
      COALESCE(SUM(t.amount) FILTER (WHERE t.direction::text = 'DEBIT'), 0) AS given,
      COALESCE(SUM(t.amount) FILTER (WHERE t.direction::text = 'CREDIT'), 0) AS received,
      COUNT(t.id) AS cnt,
      MAX(t.date) AS last
    FROM "Person" p
    LEFT JOIN "Transaction" t
      ON t."userId" = p."userId"
      AND array_length(p.tags, 1) > 0
      AND t.tags && p.tags
      AND t."transferGroupId" IS NULL
    WHERE p."userId" = ${userId}::uuid
    GROUP BY p.id, p.name, p.tags, p.note
    ORDER BY p.name ASC
  `

  return rows.map((r) => {
    const given = Number(r.given)
    const received = Number(r.received)
    return {
      id: r.id,
      name: r.name,
      tags: r.tags,
      note: r.note,
      given: given.toFixed(2),
      received: received.toFixed(2),
      net: (given - received).toFixed(2),
      count: Number(r.cnt),
      lastDate: r.last ? r.last.toISOString().slice(0, 10) : null,
    }
  })
}

export type PeopleTotals = {
  peopleCount: number
  totalGiven: string
  totalReceived: string
  netOutstanding: string
}

export function peopleTotals(rows: PersonRow[]): PeopleTotals {
  let given = 0
  let received = 0
  for (const r of rows) {
    given += Number(r.given)
    received += Number(r.received)
  }
  return {
    peopleCount: rows.length,
    totalGiven: given.toFixed(2),
    totalReceived: received.toFixed(2),
    netOutstanding: (given - received).toFixed(2),
  }
}

// ── Person CRUD ──────────────────────────────────────────────────────────────

export async function createPerson(input: {
  userId: string
  name: string
  tags?: string[]
  note?: string
  /**
   * When registering from a suggestion, the exact counterparty string — every
   * transaction with this counterparty gets the person's first tag, so the
   * ledger populates immediately (no manual tagging needed). Returns how many
   * were tagged.
   */
  assignCounterparty?: string
}): Promise<{ id: string; tagged: number }> {
  const name = input.name.trim()
  if (!name) throw new ValidationError("Name is required.")
  const existing = await prisma.person.findFirst({
    where: { userId: input.userId, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  })
  if (existing) throw new ValidationError(`"${name}" already exists.`)

  const tags = cleanTags(input.tags ?? [])
  if (tags.length) await releaseTags(input.userId, tags)

  const person = await prisma.person.create({
    data: { userId: input.userId, name, tags, note: input.note?.trim() || null },
  })

  let tagged = 0
  if (input.assignCounterparty && tags.length) {
    tagged = await tagCounterparty(input.userId, input.assignCounterparty, tags[0])
  }
  return { id: person.id, tagged }
}

/** Append a tag to every transaction with the given counterparty (idempotent). */
async function tagCounterparty(
  userId: string,
  counterparty: string,
  tag: string
): Promise<number> {
  const result = await prisma.$executeRaw`
    UPDATE "Transaction"
    SET tags = array_append(tags, ${tag})
    WHERE "userId" = ${userId}::uuid
      AND counterparty = ${counterparty}
      AND NOT (${tag} = ANY(tags))
  `
  if (result > 0) invalidateFilterOptions(userId)
  return result
}

export async function updatePerson(input: {
  userId: string
  personId: string
  name?: string
  note?: string | null
}): Promise<void> {
  const person = await prisma.person.findFirst({
    where: { id: input.personId, userId: input.userId },
  })
  if (!person) throw new NotFoundError("Person not found.")
  const data: Prisma.PersonUpdateInput = {}
  if (input.name !== undefined) {
    const name = input.name.trim()
    if (!name) throw new ValidationError("Name is required.")
    data.name = name
  }
  if (input.note !== undefined) data.note = input.note?.trim() || null
  await prisma.person.update({ where: { id: person.id }, data })
}

/** Replace a person's tags, taking each tag away from any other person. */
export async function setPersonTags(
  userId: string,
  personId: string,
  tags: string[]
): Promise<void> {
  const person = await prisma.person.findFirst({ where: { id: personId, userId } })
  if (!person) throw new NotFoundError("Person not found.")
  const clean = cleanTags(tags)
  await releaseTags(userId, clean, personId)
  await prisma.person.update({ where: { id: person.id }, data: { tags: clean } })
}

export async function deletePerson(userId: string, personId: string): Promise<void> {
  const result = await prisma.person.deleteMany({ where: { id: personId, userId } })
  if (!result.count) throw new NotFoundError("Person not found.")
}

/** Strip the given tags from every other person so a tag maps to one person. */
async function releaseTags(userId: string, tags: string[], exceptPersonId?: string): Promise<void> {
  if (!tags.length) return
  const others = await prisma.person.findMany({
    where: {
      userId,
      tags: { hasSome: tags },
      ...(exceptPersonId ? { id: { not: exceptPersonId } } : {}),
    },
    select: { id: true, tags: true },
  })
  for (const other of others) {
    await prisma.person.update({
      where: { id: other.id },
      data: { tags: other.tags.filter((t) => !tags.includes(t)) },
    })
  }
}

// ── Discovery: suggest people from frequent counterparties ───────────────────

export type CounterpartySuggestion = {
  name: string
  given: string
  received: string
  net: string
  count: number
}

const PEER_CHANNELS = ["UPI_P2A", "IMPS", "UPI", "NEFT", "FT"]

/**
 * Top peer counterparties NOT yet covered by any registered person's tags —
 * quick candidates to register. Uses the raw counterparty string.
 */
export async function suggestPeople(userId: string, limit = 20): Promise<CounterpartySuggestion[]> {
  const rows = await prisma.$queryRaw<
    { name: string; given: number; received: number; cnt: bigint }[]
  >`
    SELECT
      counterparty AS name,
      COALESCE(SUM(amount) FILTER (WHERE direction::text = 'DEBIT'), 0) AS given,
      COALESCE(SUM(amount) FILTER (WHERE direction::text = 'CREDIT'), 0) AS received,
      COUNT(*) AS cnt
    FROM "Transaction"
    WHERE "userId" = ${userId}::uuid
      AND counterparty IS NOT NULL
      AND "transferGroupId" IS NULL
      AND channel = ANY(${PEER_CHANNELS}::text[])
      AND upper(counterparty) NOT LIKE '%RITIK KUS%'
      AND upper(counterparty) NOT LIKE '%RITIKKUS%'
      AND upper(counterparty) NOT LIKE '%BIZDADDY%'
      AND trim(counterparty) !~ '^[0-9]+$'
    GROUP BY counterparty
    ORDER BY COUNT(*) DESC, given DESC
    LIMIT ${limit}
  `
  return rows.map((r) => {
    const given = Number(r.given)
    const received = Number(r.received)
    return {
      name: r.name,
      given: given.toFixed(2),
      received: received.toFixed(2),
      net: (given - received).toFixed(2),
      count: Number(r.cnt),
    }
  })
}
