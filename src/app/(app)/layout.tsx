import { Suspense } from "react"
import { redirect } from "next/navigation"

import { AppShell } from "@/components/layout/app-shell"
import { RevalidateOnRevisit } from "@/components/providers/revalidate-on-revisit"
import { getCurrentUser } from "@/lib/auth"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  if (!user) redirect("/auth/sign-in")

  return (
    <AppShell>
      {children}
      {/* Stale-while-revalidate: cached revisits repaint instantly, then quietly
          refresh. Suspense because it reads useSearchParams. Lives in the layout
          so it persists across client navigations. */}
      <Suspense fallback={null}>
        <RevalidateOnRevisit />
      </Suspense>
    </AppShell>
  )
}
