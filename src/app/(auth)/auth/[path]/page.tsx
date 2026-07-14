import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { AuthView } from "@neondatabase/auth-ui"
import { authViewPaths } from "@neondatabase/auth-ui/server"

import { getCurrentUser } from "@/lib/auth"

export const metadata: Metadata = { title: "Account" }

// Catch-all for the Neon Auth UI views (sign-in, sign-up, forgot-password, …).
// Lives in the (auth) route group so it inherits the branded auth layout. Base
// path is /auth (the provider default), so URLs are /auth/sign-in, /auth/sign-up.
export const dynamicParams = false

export function generateStaticParams() {
  return Object.values(authViewPaths).map((path) => ({ path }))
}

export default async function AuthPage({
  params,
}: {
  params: Promise<{ path: string }>
}) {
  const { path } = await params

  // Send already-signed-in users to the dashboard instead of letting them sit on
  // an auth view — EXCEPT the sign-out view, which is reached while authenticated
  // and must render so its client-side signOut() can run. Redirecting it would
  // bounce the user straight back and make logout impossible.
  if (path !== authViewPaths.SIGN_OUT) {
    const user = await getCurrentUser()
    if (user) redirect("/dashboard")
  }

  return <AuthView path={path} />
}
