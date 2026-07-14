import type { Metadata } from "next"
import Link from "next/link"
import { HandCoins } from "lucide-react"

import { Amount } from "@/components/finance/amount"
import { EmptyState } from "@/components/finance/empty-state"
import { Card, CardContent } from "@/components/ui/card"
import { requirePageUser } from "@/lib/auth"
import { formatDayMonth, formatINR } from "@/lib/format"
import { listPeople, peopleTotals, suggestPeople } from "@/lib/services/people"
import { cn } from "@/lib/utils"

import { NewPersonButton, PersonRowActions, SuggestionAdd } from "./person-dialogs"

export const metadata: Metadata = { title: "People" }

function Kpi({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Card size="sm">
      <CardContent className="min-w-0">
        <p className="text-muted-foreground truncate text-[11px] md:text-xs">{label}</p>
        <div className="mt-0.5 truncate text-sm font-semibold tabular-nums md:text-lg">
          {children}
        </div>
      </CardContent>
    </Card>
  )
}

/** Net styled + labelled by sign: positive = they owe you. */
function Net({ value }: { value: string }) {
  const n = Number(value)
  if (n === 0) return <span className="text-muted-foreground text-sm">settled</span>
  return (
    <span className="flex flex-col items-end leading-tight">
      <Amount
        value={Math.abs(n)}
        signed={false}
        className={cn("text-sm font-semibold", n > 0 ? "text-success" : "text-destructive")}
      />
      <span className="text-muted-foreground text-[10px]">{n > 0 ? "owes you" : "you owe"}</span>
    </span>
  )
}

export default async function PeoplePage() {
  const user = await requirePageUser()
  const [people, suggestions] = await Promise.all([
    listPeople(user.id),
    suggestPeople(user.id, 12),
  ])
  const totals = peopleTotals(people)
  const knownNames = new Set(people.map((p) => p.name.toLowerCase()))
  const freshSuggestions = suggestions.filter((s) => !knownNames.has(s.name.toLowerCase()))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          Net = opening + given − received. Positive means they still owe you.
        </p>
        <NewPersonButton />
      </div>

      {people.length === 0 ? (
        <EmptyState
          icon={HandCoins}
          title="No people yet"
          hint="Add a person, then open any transaction’s ⋯ menu → “Assign to person” to roll it up here. Their given / received / balance shows below."
          action={<NewPersonButton />}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
            <Kpi label="People">{totals.peopleCount}</Kpi>
            <Kpi label="Given">
              <Amount value={totals.totalGiven} signed={false} className="text-destructive" />
            </Kpi>
            <Kpi label="Received">
              <Amount value={totals.totalReceived} signed={false} className="text-success" />
            </Kpi>
            <Kpi label="Net outstanding">
              <Amount value={totals.netOutstanding} signed={false} />
            </Kpi>
          </div>

          <Card size="sm">
            <CardContent className="p-0">
              <div className="divide-border divide-y">
                {people.map((person) => (
                  <div key={person.id} className="flex items-center gap-3 px-3 py-2.5">
                    <Link
                      href={`/transactions?person=${encodeURIComponent(person.id)}`}
                      className="min-w-0 flex-1"
                    >
                      <p className="truncate text-sm font-medium">{person.name}</p>
                      <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-1 text-[11px]">
                        {person.note ? <span>{person.note} · </span> : null}
                        {person.count > 0 ? (
                          <span>
                            {person.count} txns
                            {person.lastDate ? ` · last ${formatDayMonth(person.lastDate)}` : ""}
                          </span>
                        ) : (
                          <span>no transactions assigned yet</span>
                        )}
                        {Number(person.openingBalance) !== 0 ? (
                          <span className="text-foreground/70">
                            · opening {formatINR(person.openingBalance)}
                          </span>
                        ) : null}
                      </div>
                    </Link>
                    <div className="hidden shrink-0 text-right sm:block">
                      <p className="text-muted-foreground text-[10px]">given</p>
                      <Amount value={person.given} signed={false} className="text-sm" />
                    </div>
                    <div className="hidden shrink-0 text-right sm:block">
                      <p className="text-muted-foreground text-[10px]">received</p>
                      <Amount value={person.received} signed={false} className="text-sm" />
                    </div>
                    <div className="w-24 shrink-0 text-right">
                      <Net value={person.net} />
                    </div>
                    <PersonRowActions person={person} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {freshSuggestions.length > 0 ? (
        <div className="space-y-2">
          <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
            Suggested from your transactions
          </p>
          <Card size="sm">
            <CardContent className="p-0">
              <div className="divide-border divide-y">
                {freshSuggestions.map((s) => (
                  <div key={s.name} className="flex items-center gap-3 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{s.name}</p>
                      <p className="text-muted-foreground text-[11px]">
                        {s.count} txns · net <Amount value={s.net} signed={false} />
                      </p>
                    </div>
                    <SuggestionAdd name={s.name} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  )
}
