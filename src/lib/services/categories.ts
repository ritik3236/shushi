import "server-only"

import { prisma } from "@/lib/prisma"
import {
  invalidateCategoryData,
  readCategoryData,
  writeCategoryData,
} from "@/lib/services/category-cache"
import { NotFoundError, ValidationError } from "@/lib/errors"

export type CategoryNode = {
  id: string
  name: string
  kind: "EXPENSE" | "INCOME" | "TRANSFER"
  icon: string | null
  color: string | null
  isSystem: boolean
  transactionCount: number
  children: Omit<CategoryNode, "children">[]
}

export type CategoryOption = {
  id: string
  label: string
  kind: "EXPENSE" | "INCOME" | "TRANSFER"
  color: string | null
}

/** Full two-level tree (system + this user's own), with usage counts. */
export async function getCategoryTree(userId: string): Promise<CategoryNode[]> {
  const categories = await prisma.category.findMany({
    where: { OR: [{ userId }, { userId: null }] },
    include: { _count: { select: { transactions: { where: { userId } } } } },
    orderBy: { name: "asc" },
  })

  const parents = categories.filter((c) => !c.parentId)
  return parents.map((parent) => ({
    id: parent.id,
    name: parent.name,
    kind: parent.kind,
    icon: parent.icon,
    color: parent.color,
    isSystem: parent.isSystem,
    transactionCount: parent._count.transactions,
    children: categories
      .filter((c) => c.parentId === parent.id)
      .map((child) => ({
        id: child.id,
        name: child.name,
        kind: child.kind,
        icon: child.icon,
        color: child.color,
        isSystem: child.isSystem,
        transactionCount: child._count.transactions,
      })),
  }))
}

/** Flat "Parent › Child" options for pickers. */
export async function getCategoryOptions(userId: string): Promise<CategoryOption[]> {
  const categories = await prisma.category.findMany({
    where: { OR: [{ userId }, { userId: null }] },
    include: { parent: { select: { name: true } } },
    orderBy: [{ parentId: "asc" }, { name: "asc" }],
  })
  return categories
    .map((c) => ({
      id: c.id,
      label: c.parent ? `${c.parent.name} › ${c.name}` : c.name,
      kind: c.kind,
      color: c.color,
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

export async function createCategory(input: {
  userId: string
  name: string
  kind: "EXPENSE" | "INCOME" | "TRANSFER"
  parentId?: string | null
  icon?: string
  color?: string
}): Promise<{ id: string }> {
  const name = input.name.trim()
  if (!name) throw new ValidationError("Category name is required.")
  if (input.parentId) {
    const parent = await prisma.category.findFirst({
      where: { id: input.parentId, parentId: null, OR: [{ userId: input.userId }, { userId: null }] },
    })
    if (!parent) throw new NotFoundError("Parent category not found.")
  }
  const existing = await prisma.category.findFirst({
    where: { name, parentId: input.parentId ?? null },
  })
  if (existing) throw new ValidationError(`"${name}" already exists here.`)

  const category = await prisma.category.create({
    data: {
      userId: input.userId,
      name,
      kind: input.kind,
      parentId: input.parentId ?? null,
      icon: input.icon ?? null,
      color: input.color ?? null,
    },
  })
  invalidateCategoryData(input.userId)
  return { id: category.id }
}

export async function renameCategory(input: {
  userId: string
  categoryId: string
  name: string
}): Promise<void> {
  const name = input.name.trim()
  if (!name) throw new ValidationError("Category name is required.")
  const category = await prisma.category.findFirst({
    where: { id: input.categoryId, userId: input.userId },
  })
  if (!category) throw new NotFoundError("Only your own categories can be renamed.")
  await prisma.category.update({ where: { id: category.id }, data: { name } })
  invalidateCategoryData(input.userId)
}

/** Delete a user-created category; its transactions become uncategorized. */
export async function deleteCategory(userId: string, categoryId: string): Promise<void> {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, userId },
  })
  if (!category) throw new NotFoundError("Only your own categories can be deleted.")
  await prisma.category.delete({ where: { id: category.id } })
  invalidateCategoryData(userId)
}

export type RuleRow = {
  id: string
  pattern: string
  field: "NARRATION" | "COUNTERPARTY"
  match: "CONTAINS" | "REGEX"
  direction: "DEBIT" | "CREDIT" | null
  priority: number
  isSystem: boolean
  categoryLabel: string
  categoryId: string
}

export async function listRules(userId: string): Promise<RuleRow[]> {
  const rules = await prisma.categoryRule.findMany({
    where: { OR: [{ userId }, { isSystem: true }] },
    include: { category: { include: { parent: { select: { name: true } } } } },
    orderBy: [{ priority: "asc" }, { pattern: "asc" }],
  })
  return rules.map((rule) => ({
    id: rule.id,
    pattern: rule.pattern,
    field: rule.field,
    match: rule.match,
    direction: rule.direction,
    priority: rule.priority,
    isSystem: rule.isSystem,
    categoryId: rule.categoryId,
    categoryLabel: rule.category.parent
      ? `${rule.category.parent.name} › ${rule.category.name}`
      : rule.category.name,
  }))
}

export async function deleteRule(userId: string, ruleId: string): Promise<void> {
  const result = await prisma.categoryRule.deleteMany({
    where: { id: ruleId, userId, isSystem: false },
  })
  if (!result.count) throw new NotFoundError("Only your own rules can be deleted.")
  invalidateCategoryData(userId)
}

// Cached, SEQUENTIAL page loader. The three reads (tree, options, rules) barely
// change, and running them via Promise.all against the far, tiny compute is
// ~2× SLOWER than sequential (they contend) — so fetch in series on a cache
// miss and cache the result. Invalidated by every category/rule mutation above
// (and by createRuleFromTransaction in the transactions service).
export type CategoryPageData = {
  tree: CategoryNode[]
  options: CategoryOption[]
  rules: RuleRow[]
}

export async function getCategoryPageData(userId: string): Promise<CategoryPageData> {
  const cached = readCategoryData<CategoryPageData>(userId)
  if (cached) return cached

  const tree = await getCategoryTree(userId)
  const options = await getCategoryOptions(userId)
  const rules = await listRules(userId)
  const value: CategoryPageData = { tree, options, rules }
  writeCategoryData(userId, value)
  return value
}
