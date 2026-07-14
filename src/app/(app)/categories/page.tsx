import type { Metadata } from "next"
import { Tags, Wand2 } from "lucide-react"

import { EmptyState } from "@/components/finance/empty-state"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { requirePageUser } from "@/lib/auth"
import { getCategoryPageData, type CategoryNode } from "@/lib/services/categories"
import { cn } from "@/lib/utils"

import { CategoryMenu } from "./category-menu"
import { DeleteRuleButton } from "./delete-rule-button"
import { NewCategoryDialog } from "./new-category-dialog"
import { NewRuleDialog } from "./new-rule-dialog"

export const metadata: Metadata = { title: "Categories" }

const GROUPS = [
  { label: "Expense", kind: "EXPENSE" },
  { label: "Income", kind: "INCOME" },
  { label: "Transfers", kind: "TRANSFER" },
] as const

function CategoryRow({
  node,
  child = false,
}: {
  node: Omit<CategoryNode, "children">
  child?: boolean
}) {
  return (
    <div
      className={cn(
        "hover:bg-muted/50 flex h-8 items-center gap-2 rounded-md px-2",
        child && "ml-5 h-7"
      )}
    >
      <span
        aria-hidden
        className={cn("shrink-0 rounded-full", child ? "size-2" : "size-2.5")}
        style={{ background: node.color ? `var(--${node.color})` : "var(--muted-foreground)" }}
      />
      <span
        className={cn(
          "min-w-0 flex-1 truncate",
          child ? "text-muted-foreground text-xs" : "text-sm font-medium"
        )}
      >
        {node.name}
      </span>
      <span className="text-muted-foreground text-xs tabular-nums">{node.transactionCount}</span>
      {!node.isSystem ? (
        <span className="-mr-1">
          <CategoryMenu id={node.id} name={node.name} />
        </span>
      ) : null}
    </div>
  )
}

export default async function CategoriesPage() {
  const user = await requirePageUser()
  const { tree, options, rules } = await getCategoryPageData(user.id)
  const parents = tree.map(({ id, name, kind }) => ({ id, name, kind }))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <NewRuleDialog options={options} />
        <NewCategoryDialog parents={parents} />
      </div>

      {tree.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="No categories yet"
          hint="Create your first one with “New category”, or import a statement to seed the defaults."
        />
      ) : (
        GROUPS.map((group) => {
          const inGroup = tree.filter((node) => node.kind === group.kind)
          if (!inGroup.length) return null
          return (
            <section key={group.kind}>
              <h2 className="text-muted-foreground mb-1.5 px-2 text-xs font-medium tracking-wider uppercase">
                {group.label}
              </h2>
              <div className="grid gap-x-6 gap-y-2 md:grid-cols-2">
                {inGroup.map((parent) => (
                  <div key={parent.id}>
                    <CategoryRow node={parent} />
                    {parent.children.map((childNode) => (
                      <CategoryRow key={childNode.id} node={childNode} child />
                    ))}
                  </div>
                ))}
              </div>
            </section>
          )
        })
      )}

      <section>
        <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-2">
          <h2 className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            Auto-rules
          </h2>
          <p className="text-muted-foreground text-xs">
            Applied automatically on future imports.
          </p>
        </div>
        {rules.length === 0 ? (
          <EmptyState
            icon={Wand2}
            title="No rules yet"
            hint="Add one with “New rule”, or create it from a transaction’s narration or counterparty."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pattern</TableHead>
                  <TableHead>Field</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="hidden md:table-cell">Priority</TableHead>
                  <TableHead className="w-10 text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="max-w-56 truncate font-mono text-xs">
                      {rule.pattern}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="px-1.5 text-[10px] font-normal">
                        {rule.field}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {rule.direction === null
                        ? "—"
                        : rule.direction === "DEBIT"
                          ? "Debit"
                          : "Credit"}
                    </TableCell>
                    <TableCell className="text-sm">{rule.categoryLabel}</TableCell>
                    <TableCell className="text-muted-foreground hidden text-xs md:table-cell">
                      {rule.priority}
                    </TableCell>
                    <TableCell className="text-right">
                      {rule.isSystem ? (
                        <Badge variant="secondary" className="px-1.5 text-[10px] font-normal">
                          system
                        </Badge>
                      ) : (
                        <DeleteRuleButton ruleId={rule.id} pattern={rule.pattern} />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  )
}
