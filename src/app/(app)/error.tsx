"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"

// Treat a lost session as "log out cleanly", not an error screen: if an
// unauthenticated operation slips past the proxy (e.g. a server action fired
// just as the session expired), bounce to sign-in instead of showing the card.
// The proxy is the primary gate; this is the belt-and-suspenders fallback.
const isAuthError = (error: Error) =>
  /you need to sign in|unauthor/i.test(error.message)

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()
  const authError = isAuthError(error)

  useEffect(() => {
    if (authError) router.replace("/auth/sign-in")
  }, [authError, router])

  if (authError) return null

  return (
    <div
      role="alert"
      className="border-destructive/30 bg-destructive/5 mx-auto mt-16 flex max-w-md flex-col items-center gap-3 rounded-lg border p-6 text-center"
    >
      <p className="text-sm font-medium">Something went wrong.</p>
      <p className="text-muted-foreground text-sm">{error.message || "Unexpected error."}</p>
      <Button size="sm" onClick={reset}>
        Try again
      </Button>
    </div>
  )
}
