import Link from "next/link"

import { ShushiLogo } from "@/components/brand/shushi-logo"
import { APP_NAME, APP_TAGLINE } from "@/lib/constants"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // NOTE: the "already signed in → /dashboard" redirect lives in the auth view
  // page (auth/[path]/page.tsx), NOT here, so it can be skipped for the
  // `sign-out` view — that view is reached while still authenticated and must
  // render so its client-side signOut() can run.
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-12">
      <Link href="/" className="flex items-center gap-2.5">
        <ShushiLogo className="size-10" animated />
        <span className="flex flex-col leading-none">
          <span className="text-lg font-semibold tracking-tight">{APP_NAME}</span>
          <span className="text-muted-foreground text-xs">{APP_TAGLINE}</span>
        </span>
      </Link>
      {children}
    </div>
  )
}
