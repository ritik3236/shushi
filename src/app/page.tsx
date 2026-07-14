import { redirect } from "next/navigation"

import { getCurrentUser } from "@/lib/auth"

// No marketing page — this is a personal tool. Straight to the app (or sign-in).
export default async function Home() {
  const user = await getCurrentUser()
  redirect(user ? "/dashboard" : "/auth/sign-in")
}
