import "dotenv/config"

import { PrismaClient, CategoryKind, TxDirection } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

// System categories + auto-categorization rules (userId null, isSystem true).
// Idempotent: existing rows are matched by name/pattern and left alone, so the
// seed can run after every migrate without duplicating.

const prisma = new PrismaClient({
  adapter: new PrismaPg(process.env.DATABASE_URL as string),
})

type CategorySeed = {
  name: string
  kind: CategoryKind
  icon: string
  color: string
  children?: string[]
}

const CATEGORIES: CategorySeed[] = [
  { name: "Food & Dining", kind: "EXPENSE", icon: "utensils", color: "chart-4", children: ["Delivery", "Restaurants & Cafes", "Snacks & Sweets"] },
  { name: "Groceries", kind: "EXPENSE", icon: "shopping-basket", color: "chart-7", children: ["Quick Commerce", "Provisions"] },
  { name: "Shopping", kind: "EXPENSE", icon: "shopping-bag", color: "chart-1", children: ["Amazon", "Flipkart", "General"] },
  { name: "Travel", kind: "EXPENSE", icon: "train-front", color: "chart-6", children: ["Train", "Flights & Hotels", "Fuel", "Local Transport"] },
  { name: "Utilities & Bills", kind: "EXPENSE", icon: "receipt", color: "chart-3", children: ["Mobile & Internet", "Electricity", "Rent"] },
  { name: "Subscriptions", kind: "EXPENSE", icon: "repeat", color: "chart-5", children: ["AI Tools", "Cloud & Dev", "Entertainment"] },
  { name: "Health", kind: "EXPENSE", icon: "heart-pulse", color: "chart-2", children: ["Hospital", "Pharmacy"] },
  { name: "Education & Stationery", kind: "EXPENSE", icon: "book-open", color: "chart-8" },
  { name: "Family & Friends", kind: "EXPENSE", icon: "users", color: "chart-5" },
  { name: "Fees & Charges", kind: "EXPENSE", icon: "landmark", color: "chart-4", children: ["Bank Fees", "Card Fees & Interest", "Taxes"] },
  { name: "Investments", kind: "EXPENSE", icon: "trending-up", color: "chart-2", children: ["Gold"] },
  { name: "Wallet Top-ups", kind: "EXPENSE", icon: "wallet-cards", color: "chart-8" },
  { name: "Cash", kind: "EXPENSE", icon: "banknote", color: "chart-8" },
  { name: "Income", kind: "INCOME", icon: "wallet", color: "chart-2", children: ["Salary", "Contractor Fee", "Interest", "Cashback & Rewards", "Refunds", "Borrowed & Returned"] },
  { name: "Transfers", kind: "TRANSFER", icon: "arrow-left-right", color: "chart-8", children: ["Self Transfer", "CC Payment"] },
]

type RuleSeed = {
  pattern: string
  category: string // "Parent" or "Parent>Child"
  direction?: TxDirection
  priority?: number
}

// First match (lowest priority number) wins. Credits that must never fall into
// merchant buckets (cashback, salary, interest) sit at priority 10.
const RULES: RuleSeed[] = [
  { pattern: "CASHBACK", category: "Income>Cashback & Rewards", direction: "CREDIT", priority: 10 },
  { pattern: "BIZDADDY", category: "Income>Salary", direction: "CREDIT", priority: 10 },
  { pattern: "INT.PD", category: "Income>Interest", direction: "CREDIT", priority: 10 },
  { pattern: "REFUND", category: "Income>Refunds", direction: "CREDIT", priority: 15 },

  { pattern: "AMAZON PAY GIFT", category: "Wallet Top-ups", direction: "DEBIT", priority: 40 },
  { pattern: "Top-up", category: "Wallet Top-ups", direction: "DEBIT", priority: 40 },

  { pattern: "BLINKIT", category: "Groceries>Quick Commerce" },
  { pattern: "INSTAMART", category: "Groceries>Quick Commerce" },
  { pattern: "GROFERS", category: "Groceries>Quick Commerce" },
  { pattern: "DMART", category: "Groceries>Provisions" },
  { pattern: "PROVISION", category: "Groceries>Provisions" },

  { pattern: "SWIGGY", category: "Food & Dining>Delivery" },
  { pattern: "ZOMATO", category: "Food & Dining>Delivery" },
  { pattern: "BUNDL TECHNOLOGIES", category: "Food & Dining>Delivery" },
  { pattern: "DOMINOS", category: "Food & Dining>Delivery" },
  { pattern: "KFC", category: "Food & Dining>Restaurants & Cafes" },
  { pattern: "RESTAURANT", category: "Food & Dining>Restaurants & Cafes" },
  { pattern: "CAFE", category: "Food & Dining>Restaurants & Cafes" },
  { pattern: "DHABA", category: "Food & Dining>Restaurants & Cafes" },
  { pattern: "CHAAT", category: "Food & Dining>Snacks & Sweets" },
  { pattern: "SWEETS", category: "Food & Dining>Snacks & Sweets" },
  { pattern: "DAIRY", category: "Food & Dining>Snacks & Sweets" },
  { pattern: "EGG ROLL", category: "Food & Dining>Snacks & Sweets" },

  { pattern: "FLIPKART", category: "Shopping>Flipkart" },
  { pattern: "AMAZON", category: "Shopping>Amazon" },

  { pattern: "IRCTC", category: "Travel>Train" },
  { pattern: "INDIAN RAILWAY", category: "Travel>Train" },
  { pattern: "MAKEMYTRIP", category: "Travel>Flights & Hotels" },
  { pattern: "CLEARTRIP", category: "Travel>Flights & Hotels" },
  { pattern: "FUEL", category: "Travel>Fuel" },
  { pattern: "FILLING", category: "Travel>Fuel" },
  { pattern: "PETROL", category: "Travel>Fuel" },
  { pattern: "UBER", category: "Travel>Local Transport" },
  { pattern: "OLA ", category: "Travel>Local Transport" },

  { pattern: "JIO", category: "Utilities & Bills>Mobile & Internet" },
  { pattern: "AIRTEL", category: "Utilities & Bills>Mobile & Internet" },
  { pattern: "TACHYON", category: "Utilities & Bills>Mobile & Internet" },

  { pattern: "ANTHROPIC", category: "Subscriptions>AI Tools" },
  { pattern: "CLAUDE", category: "Subscriptions>AI Tools" },
  { pattern: "OPENAI", category: "Subscriptions>AI Tools" },
  { pattern: "VERCEL", category: "Subscriptions>Cloud & Dev" },
  { pattern: "MICROSOFTBUS", category: "Subscriptions>Cloud & Dev" },
  { pattern: "GOOGLE INDIA", category: "Subscriptions>Cloud & Dev" },
  { pattern: "GODADDY", category: "Subscriptions>Cloud & Dev" },
  { pattern: "APPLE", category: "Subscriptions>Entertainment" },
  { pattern: "NETFLIX", category: "Subscriptions>Entertainment" },
  { pattern: "SPOTIFY", category: "Subscriptions>Entertainment" },
  { pattern: "PVR", category: "Subscriptions>Entertainment" },

  { pattern: "NARAYANA", category: "Health>Hospital" },
  { pattern: "HOSPITAL", category: "Health>Hospital" },
  { pattern: "MEDICAL", category: "Health>Pharmacy" },
  { pattern: "PHARMA", category: "Health>Pharmacy" },
  { pattern: "SKINLELO", category: "Health>Pharmacy" },

  { pattern: "STATIONARY", category: "Education & Stationery" },
  { pattern: "STATIONERY", category: "Education & Stationery" },

  { pattern: "MMTC", category: "Investments>Gold" },
  { pattern: "PAMP", category: "Investments>Gold" },

  { pattern: "GST", category: "Fees & Charges>Taxes", priority: 60 },
  { pattern: "FOREIGN CURRENCY TRANSACTION FEE", category: "Fees & Charges>Card Fees & Interest", priority: 50 },
  { pattern: "DEBIT INTEREST", category: "Fees & Charges>Card Fees & Interest", priority: 50 },
  { pattern: "INT.COLL", category: "Fees & Charges>Bank Fees", priority: 50 },
  { pattern: "CONSOLIDATED CHARGES", category: "Fees & Charges>Bank Fees", priority: 50 },

  { pattern: "CWDR", category: "Cash" },
  { pattern: "ATM-CASH", category: "Cash" },
  { pattern: "CASH WDL", category: "Cash" },
]

async function main() {
  // Categories — parents first, then children.
  const idByPath = new Map<string, string>()
  for (const seed of CATEGORIES) {
    let parent = await prisma.category.findFirst({
      where: { name: seed.name, parentId: null, isSystem: true },
    })
    if (!parent) {
      parent = await prisma.category.create({
        data: {
          name: seed.name,
          kind: seed.kind,
          icon: seed.icon,
          color: seed.color,
          isSystem: true,
        },
      })
    }
    idByPath.set(seed.name, parent.id)
    for (const childName of seed.children ?? []) {
      let child = await prisma.category.findFirst({
        where: { name: childName, parentId: parent.id },
      })
      if (!child) {
        child = await prisma.category.create({
          data: {
            name: childName,
            kind: seed.kind,
            parentId: parent.id,
            icon: seed.icon,
            color: seed.color,
            isSystem: true,
          },
        })
      }
      idByPath.set(`${seed.name}>${childName}`, child.id)
    }
  }

  // Rules.
  let created = 0
  for (const rule of RULES) {
    const categoryId = idByPath.get(rule.category)
    if (!categoryId) throw new Error(`Seed rule points at unknown category: ${rule.category}`)
    const existing = await prisma.categoryRule.findFirst({
      where: { pattern: rule.pattern, categoryId, isSystem: true },
    })
    if (existing) continue
    await prisma.categoryRule.create({
      data: {
        pattern: rule.pattern,
        field: "NARRATION",
        match: "CONTAINS",
        direction: rule.direction ?? null,
        categoryId,
        priority: rule.priority ?? 100,
        isSystem: true,
      },
    })
    created += 1
  }

  const categories = await prisma.category.count()
  const rules = await prisma.categoryRule.count()
  console.log(`Seed done: ${categories} categories, ${rules} rules (${created} new).`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
