import { ArrowLeftRight, CreditCard } from "lucide-react"

import { Badge } from "@/components/ui/badge"

export function TransferBadge({ kind }: { kind: "SELF_TRANSFER" | "CC_PAYMENT" }) {
  const Icon = kind === "CC_PAYMENT" ? CreditCard : ArrowLeftRight
  return (
    <Badge variant="secondary" className="gap-1 px-1.5 text-[10px] font-normal">
      <Icon className="size-3" />
      {kind === "CC_PAYMENT" ? "CC payment" : "Self transfer"}
    </Badge>
  )
}
