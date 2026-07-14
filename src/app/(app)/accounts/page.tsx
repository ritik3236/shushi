import type { Metadata } from "next"
import Link from "next/link"
import { CreditCard, Landmark } from "lucide-react"

import { Amount } from "@/components/finance/amount"
import { EmptyState } from "@/components/finance/empty-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { requirePageUser } from "@/lib/auth"
import { formatDate, formatINR } from "@/lib/format"
import { getAccountSummaries, type AccountSummary } from "@/lib/services/analytics"

export const metadata: Metadata = { title: "Accounts" }

function maskedNumber(account: AccountSummary): string {
  if (account.accountNumber === "AXIS-FLIPKART-CC") return "Flipkart"
  return `···· ${account.accountNumber.slice(-4)}`
}

function AccountCard({ account }: { account: AccountSummary }) {
  const isCard = account.type === "CREDIT_CARD"
  const Icon = isCard ? CreditCard : Landmark
  const value = isCard ? account.due : account.balance
  const creditLimit = account.creditLimit
  const surplus = isCard && value !== null && Number(value) < 0

  return (
    <Card size="sm">
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <span className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-md">
            <Icon className="text-muted-foreground size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{account.name}</p>
            <p className="text-muted-foreground truncate text-xs">{account.bank}</p>
          </div>
          <span className="text-muted-foreground font-mono text-xs">{maskedNumber(account)}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5">
        <p className="text-muted-foreground text-xs">{isCard ? "Due" : "Balance"}</p>
        <div className="flex items-center gap-2">
          {value !== null ? (
            <Amount value={surplus ? value.replace(/^-/, "") : value} signed={false} className="text-xl" />
          ) : (
            <span className="text-muted-foreground text-xl">—</span>
          )}
          {surplus ? (
            <Badge variant="secondary" className="bg-success/10 text-success">
              Surplus
            </Badge>
          ) : null}
        </div>
        {isCard && value !== null && creditLimit !== null && Number(value) > 0 ? (
          <div className="space-y-1.5 pt-1">
            <Progress value={Math.min(100, (Number(value) / Number(creditLimit)) * 100)} />
            <p className="text-muted-foreground text-xs">of {formatINR(creditLimit)} limit</p>
          </div>
        ) : null}
      </CardContent>
      <CardFooter className="justify-between gap-2 py-2">
        <span className="text-muted-foreground text-xs">
          {account.transactionCount} transactions
          {account.lastActivity ? ` · last ${formatDate(account.lastActivity)}` : ""}
        </span>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/transactions?account=${account.id}`}>View</Link>
        </Button>
      </CardFooter>
    </Card>
  )
}

export default async function AccountsPage() {
  const user = await requirePageUser()
  const accounts = await getAccountSummaries(user.id)

  if (accounts.length === 0) {
    return (
      <EmptyState
        icon={Landmark}
        title="No accounts yet"
        hint="Accounts appear automatically when you import a bank or credit card statement."
        action={
          <Button asChild size="sm">
            <Link href="/imports">Import a statement</Link>
          </Button>
        }
      />
    )
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {accounts.map((account) => (
        <AccountCard key={account.id} account={account} />
      ))}
    </div>
  )
}
