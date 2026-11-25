import { useState, type DragEvent } from 'react'
import { PackageOpen, Plus, Search, X } from 'lucide-react'
import { ItemImage } from './ItemImage'
import { LineFeatures } from './ItemFeatures'
import { CatalogueTree } from './CatalogueTree'
import { PackageThumbnail } from './PackageThumbnail'
import { centsFromInput, createId, createPackageLine, matchesCatalogueItem, money, packageCategory, packageProducts, supportsProductAccessories, type AppData, type CatalogueItem, type QuoteLine, type calculateQuotePricing } from './domain'

interface Props {
  data: AppData
  lines: QuoteLine[]
  totals: ReturnType<typeof calculateQuotePricing>
  onChange: (lines: QuoteLine[]) => void
  makeLine: (item: CatalogueItem, includeAccessories?: boolean) => QuoteLine
  onCustom: () => void
}

const packageType = 'application/x-techspire-package'
const lineType = 'application/x-techspire-line'
const printerType = 'application/x-techspire-printer'

const isAttachedFeature = (line: QuoteLine) => line.catalogueFeature || line.customFeature

export function QuoteWorkbench({ data, lines, totals, onChange, makeLine, onCustom }: Props) {
  const [search, setSearch] = useState('')
  const [target, setTarget] = useState<string | null>(null)
  const packages = data.packages.map((item) => ({ ...item, category: packageCategory(item, data.catalogue) }))
    .filter((item) => `${item.name} ${item.category} ${item.description}`.toLowerCase().includes(search.trim().toLowerCase()) ||
      packageProducts(item, data.catalogue).some(({ item: product }) => (product.active || item.id === 'reference-ineo') && matchesCatalogueItem(product, search)))
  const packageIds = new Set(lines.filter((line) => line.packageFeatures).map((line) => line.packageInstanceId))
  const directProducts = packages.filter((item) => item.id === 'reference-ineo' || item.id === 'reference-papercut')
    .flatMap((entry) => packageProducts(entry, data.catalogue).map(({ item, quantity }) => ({ item: { ...item, category: entry.category }, quantity })))
  const isMember = (line: QuoteLine) => !line.packageFeatures && packageIds.has(line.packageInstanceId)
  const customFeatures = new Map<string, Array<{ line: QuoteLine; index: number }>>()
  lines.forEach((line, index) => {
    if (!line.customFeature || !line.accessoryForId) return
    const entries = customFeatures.get(line.accessoryForId) ?? []
    entries.push({ line, index })
    customFeatures.set(line.accessoryForId, entries)
  })
  const topLevel = lines.filter((line) => !isMember(line) && !line.customFeature)

  function update(id: string, patch: Partial<QuoteLine>) {
    onChange(lines.map((line) => line.id === id ? { ...line, ...patch } : line))
  }

  function remove(ids: string[]) {
    const removed = new Set(ids)
    for (const line of lines) {
      if (isAttachedFeature(line) && line.accessoryForId && removed.has(line.accessoryForId)) removed.add(line.id)
    }
    onChange(lines.filter((line) => !removed.has(line.id)).map((line) =>
      line.accessoryForId && removed.has(line.accessoryForId) ? { ...line, accessoryForId: undefined } : line,
    ))
  }

  function addCustomFeature(parent: QuoteLine, position: number) {
    const children = customFeatures.get(parent.id)
    const lastIndex = children?.at(-1)?.index ?? position
    const next = [...lines]
    next.splice(lastIndex + 1, 0, {
      id: createId(), itemId: null, name: 'Custom feature', description: '', sku: '',
      quantity: 1, unitPriceCents: 0, vatApplicable: parent.vatApplicable,
      accessoryForId: parent.id, customFeature: true,
    })
    onChange(next)
  }

  function toggleFeature(parent: QuoteLine, feature: CatalogueItem) {
    const existing = lines.find((line) => line.catalogueFeature && line.itemId === feature.id && line.accessoryForId === parent.id)
    if (existing) remove([existing.id])
    else {
      const alternatives = new Set(feature.choiceGroup
        ? parent.featureChoices?.filter((choice) => choice.choiceGroup === feature.choiceGroup).map((choice) => choice.id)
        : [])
      const next = lines.filter((line) => !(line.catalogueFeature && line.accessoryForId === parent.id && line.itemId && alternatives.has(line.itemId)))
      const index = next.findIndex((line) => line.id === parent.id)
      next.splice(index + 1, 0, { ...makeLine(feature, false), accessoryForId: parent.id, catalogueFeature: true })
      onChange(next)
    }
  }

  function insert(line: QuoteLine, before?: string) {
    if (line.id === before) return
    const members = line.packageFeatures ? lines.filter((entry) => entry.id !== line.id && entry.packageInstanceId === line.packageInstanceId) : []
    const parents = new Set([line.id, ...members.map((entry) => entry.id)])
    const related = lines.filter((entry) => entry.id !== line.id && (parents.has(entry.id) ||
      (isAttachedFeature(entry) && parents.has(entry.accessoryForId ?? ''))))
    const moving = new Set([line.id, ...related.map((entry) => entry.id)])
    const next = lines.filter((entry) => !moving.has(entry.id))
    const index = before ? next.findIndex((entry) => entry.id === before) : next.length
    next.splice(index < 0 ? next.length : index, 0, line, ...related)
    onChange(next)
  }

  function addPrinter(item: CatalogueItem, quantity: number, before?: string) {
    if (!item.active) return
    insert({ ...makeLine(item), quantity }, before)
  }

  function selectPackageFeatures(parent: QuoteLine, selected: Set<string>) {
    const existing = lines.filter((entry) => isMember(entry) && entry.packageInstanceId === parent.packageInstanceId)
    const memberIds = new Set(existing.map((entry) => entry.id))
    const removed = new Set(existing.filter((entry) => !selected.has(entry.itemId ?? '')).map((entry) => entry.id))
    const next = lines.filter((entry) => !memberIds.has(entry.id) && !(isAttachedFeature(entry) && memberIds.has(entry.accessoryForId ?? '')))
      .map((entry) => removed.has(entry.accessoryForId ?? '') ? { ...entry, accessoryForId: undefined } : entry)
    const features = (parent.packageFeatures ?? []).flatMap(({ item, quantity }) => {
      if (!selected.has(item.id)) return []
      const member = existing.find((entry) => entry.itemId === item.id) ?? {
        ...makeLine(item, supportsProductAccessories(parent.packageCategory ?? item.category)),
        quantity: Math.max(quantity, item.minimumQuantity ?? 0), packageId: parent.packageId, packageInstanceId: parent.packageInstanceId, packageName: parent.name,
      }
      return [member, ...lines.filter((entry) => isAttachedFeature(entry) && entry.accessoryForId === member.id)]
    })
    const index = next.findIndex((entry) => entry.id === parent.id)
    next.splice(index + 1, 0, ...features)
    onChange(next)
  }

  function dropZone(before?: string) {
    const key = before ?? 'end'
    return {
      onDragOver(event: DragEvent) {
        const types = event.dataTransfer.types
        if (!types.includes(packageType) && !types.includes(lineType) && !types.includes(printerType)) return
        event.preventDefault()
        event.stopPropagation()
        event.dataTransfer.dropEffect = types.includes(lineType) ? 'move' : 'copy'
        setTarget(key)
      },
      onDragLeave(event: DragEvent) {
        if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) {
          setTarget((current) => current === key ? null : current)
        }
      },
      onDrop(event: DragEvent) {
        event.preventDefault()
        event.stopPropagation()
        const item = packages.find((entry) => entry.id === event.dataTransfer.getData(packageType))
        const line = lines.find((entry) => entry.id === event.dataTransfer.getData(lineType))
        const printer = directProducts.find(({ item }) => item.id === event.dataTransfer.getData(printerType))
        if (printer) addPrinter(printer.item, printer.quantity, before)
        else if (item && packageProducts(item, data.catalogue).some(({ item: product }) => product.active)) insert(createPackageLine(item, data.catalogue), before)
        else if (line) insert(line, before)
        setTarget(null)
      },
    }
  }

  return <section className="panel quote-workbench">
    <div className="quote-catalogue">
      <h2>Packages</h2>
      <label className="search-field"><Search size={16} /><input aria-label="Search packages" placeholder="Search packages…" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      <div className="quote-catalogue-list">
        <CatalogueTree items={packages} showGroups={false} searching={!!search.trim()} renderItem={(item) => {
          if (item.id === 'reference-ineo' || item.id === 'reference-papercut') {
            const matches = packageProducts(item, data.catalogue).filter(({ item: product }) => matchesCatalogueItem(product, search)
              || item.name.toLowerCase().includes(search.trim().toLowerCase()))
            return <details key={item.id} className="printer-navigation" open>
              <summary>{item.name}</summary>
              <CatalogueTree items={matches.map(({ item: product, quantity }) => ({ ...product, quantity, category: '' }))}
                  showCategories={false} showGroups={item.id === 'reference-ineo'} searching={!!search.trim()} renderItem={(printer) =>
                  <button type="button" key={printer.id} className="quote-catalogue-item" disabled={!printer.active}
                    draggable={printer.active} onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = 'copy'
                      event.dataTransfer.setData(printerType, printer.id)
                    }} onDragEnd={() => setTarget(null)} onClick={() => addPrinter({ ...printer, category: item.category }, printer.quantity)}>
                    {printer.imageDataUrl && <img className="catalogue-thumb" src={printer.imageDataUrl} alt="" draggable={false} />}
                    <span><b>{printer.name}</b><small>{printer.sku} · {printer.active ? `${money(printer.priceCents)}${printer.unit === 'hour' ? '/hr' : ''}` : 'Price needed'}</small></span>
                    <Plus size={15} />
                  </button>} />
            </details>
          }
          const count = packageProducts(item, data.catalogue).filter(({ item }) => item.active).length
          return <button type="button" key={item.id} className="quote-catalogue-item" aria-label={`Add ${item.name}`}
          disabled={!count} draggable={count > 0} onDragStart={(event) => {
            event.dataTransfer.effectAllowed = 'copy'
            event.dataTransfer.setData(packageType, item.id)
          }} onDragEnd={() => setTarget(null)} onClick={() => insert(createPackageLine(item, data.catalogue))}>
          <PackageThumbnail item={item} />
          <span><b>{item.name}</b><small>{count ? `${count} selectable items` : 'Add priced items in Packages'}</small></span><Plus size={15} />
        </button>}} />
        {!packages.length && <p className="field-hint">{data.packages.length ? 'No packages found.' : 'Create a package in Packages to add it here.'}</p>}
      </div>
    </div>
    <div className="quote-queue" {...dropZone()}>
      <div className="quote-queue-heading"><h2>Quote items <span className="line-count">{lines.length}</span></h2>
        <button className="button button-secondary button-compact" onClick={onCustom}><Plus size={15} /> Custom item</button></div>
      {lines.map((line, index) => {
        if (line.customFeature) return null
        const member = isMember(line)
        const position = topLevel.indexOf(line)
        const canAddFeatures = !line.accessoryForId && !line.catalogueFeature && !line.packageFeatures
        const hourly = line.unit === 'hour'
        const selected = new Set(lines.filter((entry) => isMember(entry) && entry.packageInstanceId === line.packageInstanceId).map((entry) => entry.itemId ?? ''))
        return <article key={line.id} className={`quote-line ${member ? 'package-feature-line' : ''} ${target === line.id ? 'drop-before' : ''}`} {...(member ? {} : dropZone(line.id))}>
        <div className="quote-line-heading">
          {!member && <span className="quote-grip" draggable title="Drag to reorder" aria-hidden="true" onDragStart={(event) => {
            event.dataTransfer.effectAllowed = 'move'
            event.dataTransfer.setData(lineType, line.id)
          }} onDragEnd={() => setTarget(null)}>⠿</span>}
          <ItemImage compact value={line.imageDataUrl} name={line.name || 'product'} onChange={(imageDataUrl) => update(line.id, { imageDataUrl })} />
          <div><b>{line.name || 'Untitled item'}</b><small>{line.accessoryForId
            ? `Accessory for ${lines.find((item) => item.id === line.accessoryForId)?.name ?? 'product'}`
            : line.packageFeatures ? 'Package' : line.packageName || line.sku || (line.itemId ? '' : 'Custom item')}</small></div>
          <button className="row-remove" aria-label={`Remove ${line.name}`} onClick={() =>
            remove(line.packageFeatures ? lines.filter((entry) => entry.packageInstanceId === line.packageInstanceId).map((entry) => entry.id) : [line.id])}><X size={15} /></button>
        </div>
        {line.packageFeatures ? <details className="item-feature-picker line-features" open>
          <summary>Package items <span>{selected.size} selected</span></summary>
          <div className="feature-list">
            {line.packageFeatures.some(({ item }) => item.choiceGroup) && <p className="field-hint">Choose one installation term per model. Advanced Configuration can be selected separately.</p>}
            <CatalogueTree items={line.packageFeatures.map(({ item }) => ({ ...item, category: '' }))} showCategories={false} searching={false} renderItem={(feature) =>
              <label className="check-field" key={feature.id}><input type="checkbox" checked={selected.has(feature.id)} onChange={(event) => {
                if (event.target.checked) {
                  if (feature.choiceGroup) {
                    for (const { item } of line.packageFeatures ?? []) {
                      if (item.choiceGroup === feature.choiceGroup) selected.delete(item.id)
                    }
                  }
                  selected.add(feature.id)
                }
                else selected.delete(feature.id)
                selectPackageFeatures(line, selected)
              }} />{feature.imageDataUrl && <img src={feature.imageDataUrl} alt="" className="catalogue-thumb" />}
                <span>{feature.name}</span><small>{money(feature.priceCents)}{feature.unit === 'hour' ? '/hr' : ''}{feature.monthlyCents ? ` + ${money(feature.monthlyCents)}/mo` : ''}</small></label>} />
            {!line.packageFeatures.length && <p className="field-hint">This package has no available items.</p>}
            {!!line.packageFeatures.length && !line.packageFeatures.some(({ item }) => item.choiceGroup) &&
              <button type="button" className="button button-secondary button-compact" onClick={() =>
                selectPackageFeatures(line, new Set(line.packageFeatures?.map(({ item }) => item.id)))}>Include all</button>}
            <div className="builder-tools">
              <button className="button button-secondary button-compact" disabled={position === 0} onClick={() => insert(line, topLevel[position - 1]?.id)}>Move up</button>
              <button className="button button-secondary button-compact" disabled={position === topLevel.length - 1} onClick={() => insert(line, topLevel[position + 2]?.id)}>Move down</button>
            </div>
          </div>
        </details> : <>
        <LineFeatures line={line} lines={lines} onToggle={(feature) => toggleFeature(line, feature)} />
        <div className="quote-line-prices">
          <label className="field"><span>{hourly ? 'Hours' : line.minimumQuantity ? `Qty (min ${line.minimumQuantity})` : 'Qty'}</span><input type="number" min={line.minimumQuantity ?? 0.01} step="any" value={line.quantity} onChange={(event) => update(line.id, { quantity: Math.max(0, Number(event.target.value) || 0) })} onBlur={() => {
            if (line.minimumQuantity && line.quantity < line.minimumQuantity) update(line.id, { quantity: line.minimumQuantity })
          }} /></label>
          <label className="field"><span>{hourly ? 'Hourly rate' : 'Once-off / unit'}</span><input type="number" min="0" step="0.01" value={line.unitPriceCents / 100} onChange={(event) => update(line.id, { unitPriceCents: Math.max(0, centsFromInput(event.target.value)) })} /></label>
          <label className="field"><span>Monthly / unit</span><input type="number" min="0" step="0.01" value={(line.monthlyCents ?? 0) / 100} onChange={(event) => update(line.id, { monthlyCents: Math.max(0, centsFromInput(event.target.value)) })} /></label>
        </div>
        <div className="quote-line-totals"><span>{hourly ? `Service total ${money(totals.lineTotals[index])}` : `${money(totals.lineTotals[index])} once-off`}</span>{totals.recurring.lineTotals[index] > 0 && <span>{money(totals.recurring.lineTotals[index])}/mo</span>}</div>
        <details className="quote-line-details"><summary>Edit details</summary>
          <div className="form-grid form-grid-two">
            <label className="field span-two"><span>Name</span><input value={line.name} onChange={(event) => update(line.id, { name: event.target.value })} /></label>
            <label className="field span-two"><span>Description</span><textarea rows={2} value={line.description} onChange={(event) => update(line.id, { description: event.target.value })} /></label>
            <label className="field"><span>Part number</span><input value={line.sku} onChange={(event) => update(line.id, { sku: event.target.value })} /></label>
            <label className="field"><span>{hourly ? 'Base cost / hour' : 'Base cost / unit'}</span><input type="number" min="0" step="0.01" value={line.costCents === undefined ? '' : line.costCents / 100} onChange={(event) => update(line.id, { costCents: event.target.value === '' ? undefined : Math.max(0, centsFromInput(event.target.value)) })} /></label>
            {lines.length > 1 && !member && !line.catalogueFeature && !lines.some((item) => item.accessoryForId === line.id) && <label className="field span-two"><span>Accessory for</span>
              <select value={line.accessoryForId ?? ''} onChange={(event) => update(line.id, { accessoryForId: event.target.value || undefined })}>
                <option value="">Standalone item</option>
                {lines.map((item, position) => item.id !== line.id && !item.accessoryForId && !item.catalogueFeature && !item.packageFeatures && !isMember(item)
                  ? <option key={item.id} value={item.id}>{position + 1}. {item.name}</option> : null)}
              </select></label>}
            <label className="check-field span-two"><input type="checkbox" checked={line.vatApplicable} onChange={(event) => update(line.id, { vatApplicable: event.target.checked })} /><span>Apply VAT</span></label>
          </div>
          {!member && <div className="builder-tools">
            <button className="button button-secondary button-compact" disabled={position === 0} onClick={() => insert(line, topLevel[position - 1]?.id)}>Move up</button>
            <button className="button button-secondary button-compact" disabled={position === topLevel.length - 1} onClick={() => insert(line, topLevel[position + 2]?.id)}>Move down</button>
            {line.packageInstanceId && <button className="button button-secondary button-compact" onClick={() => remove(lines.filter((item) => item.packageInstanceId === line.packageInstanceId).map((item) => item.id))}>Remove package</button>}
          </div>}
        </details>
        {canAddFeatures && <details className="item-feature-picker line-features custom-features" open>
          <summary>Features <span>{customFeatures.get(line.id)?.length ?? 0} added</span></summary>
          <div className="custom-features-list">
            {customFeatures.get(line.id)?.map(({ line: feature, index: featureIndex }) => <div className="quote-line custom-feature" key={feature.id}>
              <div className="quote-line-heading">
                <ItemImage compact value={feature.imageDataUrl} name={feature.name || 'feature'} onChange={(imageDataUrl) => update(feature.id, { imageDataUrl })} />
                <label className="field"><span>Feature name</span><input value={feature.name} onChange={(event) => update(feature.id, { name: event.target.value })} /></label>
                <button type="button" className="row-remove" aria-label={`Remove feature ${feature.name}`} onClick={() => remove([feature.id])}><X size={15} /></button>
              </div>
              <div className="quote-line-prices">
                <label className="field"><span>Qty</span><input type="number" min="0.01" step="any" value={feature.quantity} onChange={(event) => update(feature.id, { quantity: Math.max(0, Number(event.target.value) || 0) })} /></label>
                <label className="field"><span>Once-off / unit</span><input type="number" min="0" step="0.01" value={feature.unitPriceCents / 100} onChange={(event) => update(feature.id, { unitPriceCents: Math.max(0, centsFromInput(event.target.value)) })} /></label>
                <label className="field"><span>Monthly / unit</span><input type="number" min="0" step="0.01" value={(feature.monthlyCents ?? 0) / 100} onChange={(event) => update(feature.id, { monthlyCents: Math.max(0, centsFromInput(event.target.value)) })} /></label>
              </div>
              <div className="quote-line-totals"><span>{money(totals.lineTotals[featureIndex])} once-off</span>{totals.recurring.lineTotals[featureIndex] > 0 && <span>{money(totals.recurring.lineTotals[featureIndex])}/mo</span>}</div>
              <details className="quote-line-details"><summary>Edit feature details</summary>
                <div className="form-grid form-grid-two">
                  <label className="field span-two"><span>Description</span><textarea rows={2} value={feature.description} onChange={(event) => update(feature.id, { description: event.target.value })} /></label>
                  <label className="field"><span>Part number</span><input value={feature.sku} onChange={(event) => update(feature.id, { sku: event.target.value })} /></label>
                  <label className="field"><span>Base cost / unit</span><input type="number" min="0" step="0.01" value={feature.costCents === undefined ? '' : feature.costCents / 100} onChange={(event) => update(feature.id, { costCents: event.target.value === '' ? undefined : Math.max(0, centsFromInput(event.target.value)) })} /></label>
                  <label className="check-field span-two"><input type="checkbox" checked={feature.vatApplicable} onChange={(event) => update(feature.id, { vatApplicable: event.target.checked })} /><span>Apply VAT</span></label>
                </div>
              </details>
            </div>)}
            <button type="button" className="button button-secondary button-compact" onClick={() => addCustomFeature(line, index)}><Plus size={15} /> Add feature</button>
          </div>
        </details>}
        </>}
      </article>})}
      <div className={`quote-drop ${target === 'end' ? 'drop-before' : ''}`} {...dropZone()}>
        <PackageOpen size={20} /><span>{lines.length ? 'Drop to add at the end' : 'Drag a package here or use + to add one'}</span>
      </div>
    </div>
  </section>
}
