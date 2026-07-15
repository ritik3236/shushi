"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useTransition,
  type ReactNode,
} from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

type TransactionNav = { navigate: (url: string) => void; isPending: boolean }

const TransactionNavContext = createContext<TransactionNav | null>(null)

/**
 * The shared filter/pagination navigation for the transactions list. Wrapping
 * `router.replace` in a transition is what lets the panel show a loading overlay
 * while the server re-renders the filtered list (searchParams-only navigations
 * don't re-trigger `loading.tsx`). Used inside <TransactionsPanel> it drives that
 * overlay; used standalone it falls back to a local transition so the caller
 * still works on its own.
 */
export function useTransactionNav(): TransactionNav {
  const ctx = useContext(TransactionNavContext)
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const navigate = useCallback(
    (url: string) => startTransition(() => router.replace(url, { scroll: false })),
    [router]
  )
  return ctx ?? { navigate, isPending }
}

// Arm the overlay only after a beat so fast local navigations never flash it.
const OVERLAY_DELAY_MS = 120

/**
 * The transactions list surface: the raised card, its fixed toolbar, and the
 * scrolling list. Owns the navigation transition so applying a filter (or paging)
 * shows a loading spinner over the list until the new rows commit.
 */
export function TransactionsPanel({
  toolbar,
  children,
}: {
  toolbar: ReactNode
  children: ReactNode
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const navigate = useCallback(
    (url: string) => startTransition(() => router.replace(url, { scroll: false })),
    [router]
  )

  // Arm the overlay only after a short delay so fast local navigations never
  // flash it. `delayElapsed` resets in cleanup each time a navigation ends, so
  // every navigation waits out the delay afresh; and it can only flip true while
  // a transition is pending, so the overlay never shows on the first render.
  const [delayElapsed, setDelayElapsed] = useState(false)
  useEffect(() => {
    if (!isPending) return
    const timer = setTimeout(() => setDelayElapsed(true), OVERLAY_DELAY_MS)
    return () => {
      clearTimeout(timer)
      setDelayElapsed(false)
    }
  }, [isPending])
  const showOverlay = isPending && delayElapsed

  return (
    <TransactionNavContext.Provider value={{ navigate, isPending }}>
      <div className="flex h-full justify-center">
        {/* A raised card panel on the recessed page ground — the list's own surface. */}
        <div className="bg-card border-border/60 flex h-full w-full max-w-3xl flex-col border-x">
          {/* Fixed toolbar — part of the chrome, never scrolls, never covered. */}
          <div className="shrink-0 border-b">
            <div className="px-3 py-2">{toolbar}</div>
          </div>

          {/* The list region. The relative wrapper is the fixed box the loading
              overlay pins to; only the inner div scrolls, behind the overlay. */}
          <div className="relative min-h-0 flex-1">
            <div className="absolute inset-0 overflow-y-auto">
              <div className="pb-[calc(env(safe-area-inset-bottom)+5rem)] lg:pb-6">
                {children}
              </div>
            </div>

            {showOverlay ? (
              <div
                role="status"
                aria-live="polite"
                className="bg-background/70 animate-in fade-in-0 absolute inset-0 z-10 grid place-items-center duration-150"
              >
                <Loader2
                  className="text-muted-foreground size-6 animate-spin motion-reduce:animate-none"
                  aria-hidden
                />
                <span className="sr-only">Loading transactions</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </TransactionNavContext.Provider>
  )
}
