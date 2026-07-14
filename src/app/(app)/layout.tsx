import { Suspense } from "react"
import { redirect } from "next/navigation"

import { AppShell } from "@/components/layout/app-shell"
import { PageFrame } from "@/components/layout/page-frame"
import { RevalidateOnRevisit } from "@/components/providers/revalidate-on-revisit"
import { getCurrentUser } from "@/lib/auth"

// Every route in this group is cookie-gated (getCurrentUser reads the session
// cookie), so it can never be static. Declaring it dynamic up front skips the
// build-time prerender probe — and the noisy neon-auth log it triggers.
export const dynamic = "force-dynamic"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  if (!user) redirect("/auth/sign-in")

  return (
    <AppShell>
      <PageFrame>{children}</PageFrame>
      {/* Stale-while-revalidate: cached revisits repaint instantly, then quietly
          refresh. Suspense because it reads useSearchParams. Lives in the layout
          so it persists across client navigations. */}
      <Suspense fallback={null}>
        <RevalidateOnRevisit />
      </Suspense>
    </AppShell>
  )
}
