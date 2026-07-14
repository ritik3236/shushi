"use client"

import { createAuthClient } from "@neondatabase/auth/next"

// Browser-side Neon Auth client. Talks to our own /api/auth/[...path] proxy,
// which forwards to the Neon Auth server. Used by the UI components (via
// NeonAuthUIProvider) and any client-side auth calls (e.g. sign-out).
export const authClient = createAuthClient()
