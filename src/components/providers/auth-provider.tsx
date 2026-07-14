"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { NeonAuthUIProvider } from "@neondatabase/auth-ui"

import { authClient } from "@/lib/auth/client"

// Wires the Neon Auth UI components (AuthView, UserButton, SignedIn/Out) to our
// auth client and to Next's router for navigation. Wraps the whole app so the
// session context is available in both the auth views and the app shell.
export function AuthUIProvider({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const router = useRouter()

  // Guard against open redirects: the auth UI derives its post-login destination
  // from an unvalidated `?redirectTo=` query param and hands it to navigate().
  // Reduce any target to a same-origin path (rejecting absolute cross-origin and
  // protocol-relative URLs) before routing, so a crafted sign-in link can't
  // bounce a freshly authenticated user to an attacker site.
  const toSafeInternalPath = (href: string) => {
    try {
      const url = new URL(href, window.location.origin)
      return url.origin === window.location.origin
        ? url.pathname + url.search + url.hash
        : "/dashboard"
    } catch {
      return "/dashboard"
    }
  }

  return (
    <NeonAuthUIProvider
      authClient={authClient}
      navigate={(href) => router.push(toSafeInternalPath(href))}
      replace={(href) => router.replace(toSafeInternalPath(href))}
      onSessionChange={() => router.refresh()}
      Link={Link}
      redirectTo="/dashboard"
      defaultTheme="light"
      className={className}
    >
      {children}
    </NeonAuthUIProvider>
  )
}
