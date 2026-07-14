import Link from "next/link"

import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3">
      <p className="text-muted-foreground text-sm">This page doesn&apos;t exist.</p>
      <Button asChild size="sm" variant="outline">
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  )
}
