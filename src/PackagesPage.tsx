import { useState, type ReactNode } from 'react'
import { ChevronRight, PackageOpen, Plus, Printer, Search } from 'lucide-react'
import { PackageThumbnail } from './PackageThumbnail'
import { CatalogueTree } from './CatalogueTree'
import { productAccessories } from './referencePackages'
import { matchesCatalogueItem, money, packageCategory, packageProducts, supportsProductAccessories, type CatalogueItem, type Package } from './domain'

function PackageItemRow({ item, quantity, children }: { item: CatalogueItem; quantity?: number; children: ReactNode }) {
  const metadata = [
    item.sku,
    quantity === undefined ? item.choiceGroup && `Choose one · ${item.choiceGroup}` : `Default qty ${quantity}`,
    item.minimumQuantity && `Minimum qty ${item.minimumQuantity}`,
    !item.active && !item.pricingPending && 'Unavailable',
  ].filter(Boolean).join(' · ')
  return <div className="package-product-row">
    <div className="package-item-identity">
      {item.imageDataUrl ? <img className="catalogue-thumb" src={item.imageDataUrl} alt="" /> :
        item.id.startsWith('reference-printer-') && quantity !== undefined && <span className="package-thumbnail" aria-hidden="true"><Printer size={17} /></span>}
      <div>
        <strong>{item.name}</strong>
        {metadata && <small>{metadata}</small>}
      </div>
    </div>
    <div className="package-product-price">
      {item.pricingPending ? <span className="package-price-pending">Price needed</span> : <>
        {(item.priceCents > 0 || !item.monthlyCents) && <span>{money(item.priceCents)}</span>}
        {!!item.monthlyCents && <span>{money(item.monthlyCents)} <small>/mo</small></span>}
      </>}
    </div>
    <div className="package-item-actions">{children}</div>
  </div>
}

export function PackagesPage({ packages, legacyProducts, selectedId, busy, onSelect, onAdd, onEdit, onAddToQuote, onProduct, onCopyProduct, onRemoveProduct, onAccessory, onRemoveAccessory }: {
  packages: Package[]
  legacyProducts: CatalogueItem[]
  selectedId: string | null
  busy: boolean
  onSelect: (id: string) => void
  onAdd: () => void
  onEdit: (item: Package) => void
  onAddToQuote: (item: Package) => void
  onProduct: (item: Package, product?: CatalogueItem) => void
  onCopyProduct: (item: Package, product: CatalogueItem) => void
  onRemoveProduct: (item: Package, product: CatalogueItem) => void
  onAccessory: (item: Package, product: CatalogueItem, accessory?: CatalogueItem) => void
  onRemoveAccessory: (item: Package, product: CatalogueItem, accessory: CatalogueItem) => void
}) {
  const [search, setSearch] = useState('')
  const [copyId, setCopyId] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const selected = packages.find((item) => item.id === selectedId) ?? packages[0]
  const visible = packages.map((item) => ({ ...item, category: packageCategory(item, legacyProducts) })).filter((item) =>
    `${item.name} ${item.category}`.toLowerCase().includes(search.trim().toLowerCase()) ||
    packageProducts(item, legacyProducts).some(({ item: product }) => matchesCatalogueItem(product, search)),
  )
  const storedProduct = legacyProducts.find((item) => item.id === copyId)
  const products = selected ? packageProducts(selected, legacyProducts) : []
  const category = selected ? packageCategory(selected, legacyProducts) : ''
  const supportsAccessories = supportsProductAccessories(category)
  const searchingProducts = !!productSearch.trim()
  const visibleProducts = products.map(({ item, quantity }) => {
    const accessories = supportsAccessories ? productAccessories(item, legacyProducts) : []
    const matchesProduct = matchesCatalogueItem(item, productSearch)
    const matchingAccessories = matchesProduct ? accessories : accessories.filter((accessory) => matchesCatalogueItem(accessory, productSearch))
    return { category: '', productGroup: item.productGroup, item, quantity, accessories, matchingAccessories, matchesProduct }
  }).filter(({ matchesProduct, matchingAccessories }) => matchesProduct || matchingAccessories.length)

  return <>
    <div className="page-heading heading-split"><div><h1>Packages</h1><p>Manage products, features and pricing for your quotes.</p></div>
      <button className="button button-primary" disabled={busy} onClick={onAdd}><Plus size={17} /> New package</button></div>
    {!selected ? <div className="panel empty-feature"><div className="empty-feature-icon"><PackageOpen size={25} /></div><h2>No packages yet</h2></div> :
      <div className="package-workspace">
        <aside className="panel package-workspace-sidebar">
          <label className="search-field"><Search size={16} /><input aria-label="Search packages" placeholder="Search packages or products…" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          <CatalogueTree items={visible} showGroups={false} searching={!!search.trim()} renderItem={(item) => {
            const count = packageProducts(item, legacyProducts).length
            return <button type="button" key={item.id} className="package-nav-item" aria-pressed={selected.id === item.id} onClick={() => { onSelect(item.id); setCopyId(''); setProductSearch('') }}>
              <PackageThumbnail item={item} />
              <span><strong>{item.name}</strong><small>{count} {count === 1 ? 'product' : 'products'}</small></span>
            </button>
          }} />
          {!visible.length && <p className="field-hint">No packages found.</p>}
        </aside>
        <section className="panel package-workspace-main">
          <div className="panel-heading">
            <div><p className="package-category-label">{category}</p><h2>{selected.name}</h2>{selected.description && <p>{selected.description}</p>}</div>
            <div className="package-workspace-actions">
              <button className="button button-secondary button-compact" disabled={busy} onClick={() => onEdit(selected)}>Edit package</button>
              <button className="button button-secondary button-compact" disabled={busy || !products.some(({ item }) => item.active)} onClick={() => onAddToQuote(selected)}>Add package to quote</button>
            </div>
          </div>
          <div className="package-products-heading">
            <h3>Products <span>{products.length}</span></h3>
            <button className="button button-secondary button-compact" disabled={busy} onClick={() => onProduct(selected)}><Plus size={15} /> Add product</button>
          </div>
          {products.length > 0 && <label className="search-field"><Search size={16} /><input aria-label="Search this package" placeholder={supportsAccessories ? 'Search products and features…' : 'Search package products…'} value={productSearch} onChange={(event) => setProductSearch(event.target.value)} /></label>}
          {visibleProducts.length ? <CatalogueTree key={selected.id} items={visibleProducts}
            showCategories={false} showGroups={products.some(({ item }) => !!item.productGroup)} searching={searchingProducts}
            renderItem={({ item, quantity, accessories, matchingAccessories, matchesProduct }) =>
              <article className="package-product-card" key={item.id}>
                <PackageItemRow item={item} quantity={quantity}>
                  {supportsAccessories && <button type="button" className="package-add-feature" disabled={busy} aria-label={`Add feature to ${item.name}`} onClick={() => {
                    const details = document.getElementById(`package-features-${item.id}`)
                    if (details instanceof HTMLDetailsElement) details.open = true
                    onAccessory(selected, item)
                  }}><Plus size={14} /> Add feature</button>}
                  <button disabled={busy} aria-label={`Edit ${item.name}`} onClick={() => onProduct(selected, item)}>Edit</button>
                  <button className="danger-link" disabled={busy} aria-label={`Remove ${item.name}`} onClick={() => onRemoveProduct(selected, item)}>Remove</button>
                </PackageItemRow>
                {supportsAccessories && <details id={`package-features-${item.id}`} className="package-accessories" open={searchingProducts && !matchesProduct ? true : undefined}>
                  <summary aria-label={`Features for ${item.name} (${accessories.length})`}>
                    <ChevronRight size={14} /> Features <span>{accessories.length}</span>
                  </summary>
                  <div className="package-accessory-list">
                    {matchingAccessories.length ? <CatalogueTree items={matchingAccessories.map((accessory) => ({ ...accessory, category: '' }))} showCategories={false}
                      showGroups={accessories.some((accessory) => !!accessory.productGroup)} searching={searchingProducts}
                      renderItem={(accessory) => <PackageItemRow key={accessory.id} item={accessory}>
                        <button disabled={busy} aria-label={`Edit ${accessory.name}`} onClick={() => onAccessory(selected, item, accessory)}>Edit</button>
                        <button className="danger-link" disabled={busy} aria-label={`Remove ${accessory.name}`} onClick={() => onRemoveAccessory(selected, item, accessory)}>Remove</button>
                      </PackageItemRow>} /> : <p className="field-hint">This product has no features yet.</p>}
                  </div>
                </details>}
              </article>} /> : <p className="field-hint">{products.length ? 'No matches in this package.' : 'This package has no products yet.'}</p>}
          {legacyProducts.length > 0 && <details className="quote-line-details">
            <summary>Copy an existing product</summary>
            <div className="package-workspace-actions">
              <label className="field"><span>Product from your previous catalogue</span><select value={copyId} onChange={(event) => setCopyId(event.target.value)}>
                <option value="">Choose a product…</option>{legacyProducts.map((item) => <option key={item.id} value={item.id}>{item.name}{item.sku ? ` · ${item.sku}` : ''}</option>)}
              </select></label>
              <button className="button button-secondary button-compact" disabled={!storedProduct || busy} onClick={() => {
                if (storedProduct) { onCopyProduct(selected, storedProduct); setCopyId('') }
              }}>Copy into package</button>
            </div>
          </details>}
        </section>
      </div>}
  </>
}
