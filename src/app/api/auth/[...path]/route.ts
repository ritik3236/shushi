import { auth } from "@/lib/auth/server"

// Catch-all proxy for all Neon Auth API calls (sign in, sign up, OAuth
// callbacks, session, email verification, password reset). The client SDK and
// UI talk to these routes, which forward to the Neon Auth server.
const handlers = auth.handler()

export const GET = handlers.GET
export const POST = handlers.POST
