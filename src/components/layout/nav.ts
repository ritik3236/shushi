import {
  ArrowLeftRight,
  HandCoins,
  Landmark,
  LayoutDashboard,
  ReceiptIndianRupee,
  Tags,
  Upload,
  type LucideIcon,
} from "lucide-react"

export type NavItem = {
  href: string
  label: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/people", label: "People", icon: HandCoins },
  { href: "/accounts", label: "Accounts", icon: Landmark },
  { href: "/imports", label: "Imports", icon: Upload },
  { href: "/payslips", label: "Payslips", icon: ReceiptIndianRupee },
  { href: "/categories", label: "Categories", icon: Tags },
]
