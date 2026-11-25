import { useState, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
export function CatalogueTree<T extends { category: string; productGroup?: string }>({ items, searching, renderItem, showGroups = true, showCategories = true }: {
  items: T[]
  searching: boolean
  renderItem: (item: T) => ReactNode
  showGroups?: boolean
  showCategories?: boolean
}) {
  const [collapsed, setCollapsed] = useState(new Set<string>())
  const categories = new Map<string, Map<string, T[]>>()
  for (const item of items) {
    const category = item.category.trim() || 'General'
    const group = item.productGroup?.trim() || 'Products'
    const headings = categories.get(category) ?? new Map<string, T[]>()
    const products = headings.get(group) ?? []
    products.push(item)
    headings.set(group, products)
    categories.set(category, headings)
  }
  function heading(label: string, key: string, count: number) {
    const open = searching || !collapsed.has(key)
    return <button type="button" className="catalogue-tree-heading" aria-expanded={open} onClick={() => {
      if (searching) return
      setCollapsed((current) => {
        const next = new Set(current)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        return next
      })
    }}><ChevronRight size={14} /><span>{label}</span><small>{count}</small></button>
  }
  return <div className="catalogue-tree">
    {[...categories].sort(([a], [b]) => a.localeCompare(b)).map(([category, groups]) => {
      const categoryKey = JSON.stringify([category])
      return <section className="catalogue-tree-category" key={category}>
        {showCategories && heading(category, categoryKey, [...groups.values()].reduce((count, entries) => count + entries.length, 0))}
        {(!showCategories || searching || !collapsed.has(categoryKey)) && <div className={showCategories ? 'catalogue-tree-branches' : 'catalogue-tree'}>
          {[...groups].sort(([a], [b]) => a.localeCompare(b)).map(([group, entries]) => {
            const groupKey = JSON.stringify([category, group])
            return <div className="catalogue-tree-group" key={group}>
              {showGroups && heading(group, groupKey, entries.length)}
              {(!showGroups || searching || !collapsed.has(groupKey)) && <div className="catalogue-tree-products">
                {entries.map(renderItem)}
              </div>}
            </div>
          })}
        </div>}
      </section>
    })}
  </div>
}
