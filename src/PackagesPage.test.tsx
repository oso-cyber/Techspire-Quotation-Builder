import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { type CatalogueItem, type Package } from './domain'
import { PackagesPage } from './PackagesPage'

const accessory: CatalogueItem = {
  id: 'feeder', name: 'Document feeder', category: 'Office Automation', description: '', sku: 'DF-1',
  priceCents: 1000, unit: 'each', vatApplicable: true, active: true,
}
const product = {
  ...accessory, id: 'device', name: 'Office device', sku: 'OD-1',
  accessories: [{ ...accessory, accessories: [{ ...accessory, id: 'nested', name: 'Nested feature' }] }],
}
const item = { itemId: product.id, product, quantity: 1 }

function renderPackage(category: string) {
  const entry: Package = { id: 'package', name: 'Test package', description: '', category, items: [item] }
  return renderToStaticMarkup(<PackagesPage packages={[entry]} legacyProducts={[]} selectedId={entry.id} busy={false}
    onSelect={vi.fn()} onAdd={vi.fn()} onEdit={vi.fn()} onAddToQuote={vi.fn()}
    onProduct={vi.fn()} onCopyProduct={vi.fn()} onRemoveProduct={vi.fn()}
    onAccessory={vi.fn()} onRemoveAccessory={vi.fn()} />)
}

it('renders flat package items without accessory controls even when legacy accessory data exists', () => {
  const markup = renderPackage('Networking')
  expect(markup).toContain('New package')
  expect(markup).toContain('Add product')
  expect(markup).toContain('Edit Office device')
  expect(markup).not.toContain('Document feeder')
  expect(markup).not.toContain('Add feature')
})

it('adds features only to Office Automation products and stops at one level', () => {
  const markup = renderPackage('Office Automation')
  expect(markup).toContain('Add feature to Office device')
  expect(markup).toContain('Features for Office device (1)')
  expect(markup).toContain('Edit Document feeder')
  expect(markup).not.toContain('Add feature to Document feeder')
  expect(markup).not.toContain('Nested feature')
})
