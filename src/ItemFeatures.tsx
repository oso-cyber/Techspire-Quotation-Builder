import { useState } from 'react'
import { type CatalogueItem, type QuoteLine, matchesCatalogueItem, money } from './domain'
import { CatalogueTree } from './CatalogueTree'

function featurePrice(item: Pick<CatalogueItem, 'priceCents' | 'monthlyCents' | 'unit'>) {
  return [
    item.priceCents > 0 ? `${money(item.priceCents)}${item.unit === 'hour' ? '/hr' : ''}` : '',
    item.monthlyCents ? `${money(item.monthlyCents)}/mo` : '',
  ].filter(Boolean).join(' + ')
}

export function LineFeatures({ line, lines, onToggle }: {
  line: QuoteLine
  lines: QuoteLine[]
  onToggle: (feature: NonNullable<QuoteLine['featureChoices']>[number]) => void
}) {
  const [search, setSearch] = useState('')
  if (line.catalogueFeature || !line.featureChoices?.length) return null
  const children = lines.filter((entry) => entry.catalogueFeature && entry.accessoryForId === line.id)
  const selected = new Set(children.map((entry) => entry.itemId))
  const matches = line.featureChoices.filter((item) => matchesCatalogueItem(item, search))
  return <details className="item-feature-picker line-features" open={line.itemId?.startsWith('reference-printer-') ? true : undefined}>
    <summary>Accessories <span>{selected.size} selected</span></summary>
    <label className="field"><span>Find an accessory</span><input value={search} onChange={(event) => setSearch(event.target.value)} /></label>
    <div className="feature-list">
      <CatalogueTree items={matches.map((feature) => ({ ...feature, category: '' }))} showCategories={false} searching={!!search.trim()} renderItem={(feature) => <label className="check-field" key={feature.id}>
        <input type="checkbox" checked={selected.has(feature.id)} onChange={() => onToggle(feature)} />
        {feature.imageDataUrl && <img src={feature.imageDataUrl} alt="" className="catalogue-thumb" />}
        <span>{feature.name}{feature.sku && <small> · {feature.sku}</small>}</span><small>{featurePrice(feature)}</small>
      </label>} />
      {!matches.length && <small>No matching accessories.</small>}
    </div>
  </details>
}
