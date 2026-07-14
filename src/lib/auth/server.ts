import "server-only"

import { createNeonAuth } from "@neondatabase/auth/next/server"

// The unified server-side Neon Auth instance. Provides:
//   • auth.handler()    — API route proxy (src/app/api/auth/[...path]/route.ts)
//   • auth.getSession() — session in Server Components / Actions / Route Handlers
// plus all Better Auth server methods (signIn, signUp, signOut, …).
//
// NEON_AUTH_BASE_URL comes from the Neon Console (Branch → Auth → Configuration).
// NEON_AUTH_COOKIE_SECRET signs the session-data cookie (32+ chars).
//
// sessionDataTtl: how long the signed `session_data` cookie caches the session
// before getSession must re-validate against the upstream auth backend. The
// default 5 min means an idle Neon compute cold-start can bounce a still-valid
// user to sign-in; 1 day keeps the fast cookie path for a personal app.
//
// sameSite "lax" (package default is "strict"): strict withholds the cookie on
// navigations that originate outside the site, so Safari shows a logged-in user
// the sign-in screen when returning via bookmark. Lax keeps CSRF safety on
// cross-site POSTs while surviving top-level navigations.
export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: {
    secret: process.env.NEON_AUTH_COOKIE_SECRET!,
    sessionDataTtl: 60 * 60 * 24,
    sameSite: "lax",
  },
})
