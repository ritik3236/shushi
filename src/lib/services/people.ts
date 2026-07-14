import "server-only"

import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { NotFoundError, ValidationError } from "@/lib/errors"

// People ledger ("khata"). You REGISTER a person, then assign transactions to
// them directly from the transaction row. Each person's ledger sums given
// (debits) vs received (credits); net > 0 means they still owe you.
//
// Model: people → transactions, a direct link (Transaction.personId). No tag
// indirection — assignment is explicit, so nothing silently fails to roll up.

export type PersonRow = {
  id: string
  name: string
  note: string | null
  given: string
  received: string
  net: string
  count: number
  lastDate: string | null
}

/** Registered people with their ledger totals from directly-assigned rows. */
export async function listPeople(userId: string): Promise<PersonRow[]> {
  const rows = await prisma.$queryRaw<
    {
      id: string
      name: string
      note: string | null
      given: number
      received: number
      cnt: bigint
      last: Date | null
    }[]
  >`
    SELECT
      p.id, p.name, p.note,
      COALESCE(SUM(t.amount) FILTER (WHERE t.direction::text = 'DEBIT'), 0) AS given,
      COALESCE(SUM(t.amount) FILTER (WHERE t.direction::text = 'CREDIT'), 0) AS received,
      COUNT(t.id) AS cnt,
      MAX(t.date) AS last
    FROM "Person" p
    LEFT JOIN "Transaction" t ON t."personId" = p.id
    WHERE p."userId" = ${userId}::uuid
    GROUP BY p.id, p.name, p.note
    ORDER BY p.name ASC
  `

  return rows.map((r) => {
    const given = Number(r.given)
    const received = Number(r.received)
    return {
      id: r.id,
      name: r.name,
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

/** People as options for an assign control (id + name only). */
export async function listPersonOptions(userId: string): Promise<{ id: string; name: string }[]> {
  return prisma.person.findMany({
    where: { userId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  })
}

// ── Person CRUD ──────────────────────────────────────────────────────────────

export async function createPerson(input: {
  userId: string
  name: string
  note?: string
  /**
   * When registering from a counterparty suggestion: assign every transaction
   * with this exact counterparty to the new person, so the ledger populates
   * immediately. Returns how many rows were assigned.
   */
  assignCounterparty?: string
}): Promise<{ id: string; assigned: number }> {
  const name = input.name.trim()
  if (!name) throw new ValidationError("Name is required.")
  const existing = await prisma.person.findFirst({
    where: { userId: input.userId, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  })
  if (existing) throw new ValidationError(`"${name}" already exists.`)

  const person = await prisma.person.create({
    data: { userId: input.userId, name, note: input.note?.trim() || null },
  })

  let assigned = 0
  if (input.assignCounterparty) {
    assigned = await assignCounterpartyToPerson(input.userId, input.assignCounterparty, person.id)
  }
  return { id: person.id, assigned }
}

/** Assign every transaction with the given counterparty to a person. */
export async function assignCounterpartyToPerson(
  userId: string,
  counterparty: string,
  personId: string
): Promise<number> {
  return prisma.$executeRaw`
    UPDATE "Transaction"
    SET "personId" = ${personId}
    WHERE "userId" = ${userId}::uuid
      AND counterparty = ${counterparty}
      AND "personId" IS DISTINCT FROM ${personId}
  `
}

/** Assign a single transaction to a person, or clear it (personId = null). */
export async function assignTransactionToPerson(
  userId: string,
  transactionId: string,
  personId: string | null
): Promise<void> {
  if (personId) {
    const person = await prisma.person.findFirst({
      where: { id: personId, userId },
      select: { id: true },
    })
    if (!person) throw new NotFoundError("Person not found.")
  }
  const result = await prisma.transaction.updateMany({
    where: { id: transactionId, userId },
    data: { personId },
  })
  if (!result.count) throw new NotFoundError("Transaction not found.")
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

export async function deletePerson(userId: string, personId: string): Promise<void> {
  // Transaction.personId is ON DELETE SET NULL — rows are unassigned, not lost.
  const result = await prisma.person.deleteMany({ where: { id: personId, userId } })
  if (!result.count) throw new NotFoundError("Person not found.")
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
 * Top peer counterparties not yet assigned to a person — quick candidates to
 * register. Uses the raw counterparty string.
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
      AND "personId" IS NULL
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
