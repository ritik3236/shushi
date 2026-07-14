import { NextResponse, type NextRequest } from "next/server"

import { auth } from "@/lib/auth/server"

// Next.js 16 renames `middleware.ts` → `proxy.ts`. Neon Auth's middleware
// validates/refreshes the session cookie and redirects unauthenticated page
// requests to the sign-in view — BEFORE the route renders. Without it, an
// expired session lets the (app) layout redirect while the page renders
// concurrently and its requireUser() throws a stray UnauthorizedError into the
// server log; gating here means no unauthenticated request ever reaches render.
//
// Only PAGE routes belong here:
//   • /api/* guards itself (getCurrentUser → 401 JSON); a 307 → /auth/sign-in
//     would hand a fetch() the HTML login page instead of JSON.
//   • SERVER ACTION POSTs already self-guard via requireUser() and read the
//     CACHED session, so they work even when the Neon auth compute has
//     autosuspended. The proxy does a LIVE upstream get-session and would
//     bounce those POSTs to sign-in on cold start ("couldn't save"). We let
//     them through on the `next-action` header so only real server actions skip
//     the proxy; an ordinary unauthenticated page POST still gets the 307.
const authMiddleware = auth.middleware({ loginUrl: "/auth/sign-in" })

export default function proxy(request: NextRequest) {
  if (request.method === "POST" && request.headers.has("next-action")) {
    return NextResponse.next()
  }
  return authMiddleware(request)
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/transactions/:path*",
    "/accounts/:path*",
    "/imports/:path*",
    "/payslips/:path*",
    "/categories/:path*",
  ],
}
