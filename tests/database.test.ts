import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { afterEach, expect, it, vi } from 'vitest'
import initSqlJs from 'sql.js'
import { zipSync } from 'fflate'
import { exportDatabase, loadAppData, restoreDatabase, saveCatalogueItem, saveClient, savePackage, saveQuote, saveSettings } from '../src/database'
import { calculateQuotePricing, createPackageLine, DEFAULT_SETTINGS, missingClientFields, type CatalogueItem, type Client, type Quote } from '../src/domain'

vi.mock('sql.js/dist/sql-wasm.wasm?url&inline', () => ({
  default: 'data:application/wasm;base64,' + readFileSync(createRequire(import.meta.url).resolve('sql.js/dist/sql-wasm.wasm')).toString('base64'),
}))

vi.mock('@tauri-apps/plugin-sql', () => ({
  default: { load: async () => nativeDatabase },
}))

let nativeDatabase: unknown
afterEach(() => vi.unstubAllGlobals())

it('upgrades a legacy SQLite database and keeps catalogue and quote pricing through backup and restore', async () => {
  const wasmPath = createRequire(import.meta.url).resolve('sql.js/dist/sql-wasm.wasm')
  const SQL = await initSqlJs({ wasmBinary: readFileSync(wasmPath) })
  const db = new SQL.Database()
  db.run(`
    CREATE TABLE catalogue_items (
      id TEXT PRIMARY KEY, name TEXT, description TEXT, sku TEXT, category TEXT,
      unit TEXT, price_cents INTEGER, vat_applicable INTEGER, active INTEGER
    );
    INSERT INTO catalogue_items VALUES ('old', 'Legacy router', '', '', 'General', 'each', 1000, 1, 1);
    CREATE TABLE packages (id TEXT PRIMARY KEY, name TEXT, description TEXT, items_json TEXT);
    INSERT INTO packages VALUES ('reference-lte', 'LTE', 'Existing package', '[{"itemId":"old","quantity":2}]');
    INSERT INTO packages VALUES ('reference-ict-sla', 'ICT SLA', '', '[]');
    INSERT INTO packages VALUES ('reference-firewall', 'Firewall Security', '', '[]');
    INSERT INTO packages VALUES ('reference-structured-networks', 'Structured Networks', '', '[]');
    INSERT INTO packages VALUES ('reference-hosted', 'Hosted Solution', '', '[]');
    INSERT INTO packages VALUES ('reference-on-prem', 'On-Prem Solution & Hardware', '', '[]');
  `)
  nativeDatabase = {
    async select(query: string) {
      const [result] = db.exec(query)
      return result?.values.map((row) => Object.fromEntries(result.columns.map((column, index) => [column, row[index]]))) ?? []
    },
    async execute(query: string, values: Array<number | string | null> = []) {
      const bindings = Object.fromEntries(values.map((value, index) => [`$${index + 1}`, value]))
      db.run(query, bindings)
    },
  }
  vi.stubGlobal('window', { __TAURI_INTERNALS__: {} })
  const initial = await loadAppData()
  expect(initial.catalogue[0]).toMatchObject({ id: 'old', priceCents: 1000 })
  const lte = initial.packages.find((entry) => entry.id === 'reference-lte')!
  expect(lte.items).toHaveLength(20)
  expect(lte.description).toBe('Existing package')
  expect(lte.items[0]).toEqual({ itemId: 'old', quantity: 2 })
  const vodacom = lte.items.filter((item) => item.product?.productGroup?.startsWith('Vodacom')).map(({ itemId, product }) => ({
    id: itemId, itemId, name: product!.name, description: '', sku: '', quantity: 1,
    unitPriceCents: product!.priceCents, monthlyCents: product!.monthlyCents, vatApplicable: product!.vatApplicable,
  }))
  expect(calculateQuotePricing({ lines: vodacom, discountType: 'none', discountValue: 0 }, 0).monthlyCents).toBe(250_400)
  const support = initial.packages.find((entry) => entry.id === 'reference-ict-sla')!
  const firewall = initial.packages.find((entry) => entry.id === 'reference-firewall')!
  expect(firewall.imageDataUrl).toMatch(/^data:image\/png;base64,/)
  expect(firewall.items).toHaveLength(24)
  const networks = initial.packages.find((entry) => entry.id === 'reference-structured-networks')!
  expect(networks.items).toHaveLength(37)
  const hosted = initial.packages.find((entry) => entry.id === 'reference-hosted')!
  const onPrem = initial.packages.find((entry) => entry.id === 'reference-on-prem')!
  expect(createPackageLine(onPrem, initial.catalogue).packageFeatures).toHaveLength(39)
  expect(onPrem.items.find((entry) => entry.product?.sku === 'INC')?.product?.priceCents).toBe(65_000)
  expect(onPrem.items.find((entry) => entry.product?.sku === 'SIPT')?.product).toMatchObject({ priceCents: 0, monthlyCents: 5000 })
  expect(createPackageLine(hosted, initial.catalogue).packageFeatures).toHaveLength(5)
  expect(hosted.items.find((entry) => entry.product?.sku === 'HPE')).toMatchObject({
    quantity: 5, product: { monthlyCents: 5500, minimumQuantity: 5 },
  })
  expect(networks.items.find((entry) => entry.product?.sku === 'HIC')?.product).toMatchObject({
    productGroup: 'Labour', costCents: 3_000_000, priceCents: 3_000_000, monthlyCents: 0,
  })
  expect(firewall.items.find((entry) => entry.itemId === 'reference-fortigate-40f-1y')?.product).toMatchObject({
    costCents: 1_888_700, priceCents: 2_018_700, choiceGroup: 'reference-fortigate-40f',
  })
  expect(support.category).toBe('Managed ICT Support')
  expect(createPackageLine(support, initial.catalogue).packageFeatures?.map(({ item }) => [item.unit, item.monthlyCents])).toEqual([
    ['user', 37_500], ['node', 5_000], ['user', 10_000], ['physical server', 65_000],
  ])

  const item: CatalogueItem = {
    id: 'new', name: 'Router and support', description: '', sku: 'R-1', category: 'Networking', unit: 'each',
    priceCents: 300_000, costCents: 250_000, monthlyCents: 15_000, vatApplicable: true, active: true,
    imageDataUrl: 'data:image/jpeg;base64,test-photo', featureItemIds: ['old'], productGroup: 'LTE',
  }
  const client: Client = {
    id: 'client', name: '', contact: 'Primary Contact', email: 'primary@example.com', phone: '011 555 1234', address: '10 Main Road', city: '',
    province: '', postalCode: '', vatNumber: '', archived: false,
    details: { position: 'Director', alternateEmail: 'alternate@example.com', postalAddress: 'PO Box 10', logo: item.imageDataUrl },
  }
  expect(missingClientFields(client)).toEqual([])
  expect(missingClientFields({ ...client, address: '  ', details: undefined })).toHaveLength(2)
  const plan = { id: 'test-plan', months: 36, escalation: 5, tiers: [{ limit: 20_000, factor: 0.04 }] }
  const quote: Quote = {
    id: 'q', number: 'QT-1', status: 'Draft', title: 'Test quote',
    clientId: client.id, clientSnapshot: client, lines: [{
      id: 'line', itemId: item.id, name: item.name, sku: item.sku, description: '', quantity: 1,
      unitPriceCents: item.priceCents, costCents: item.costCents, monthlyCents: item.monthlyCents, vatApplicable: true,
      imageDataUrl: item.imageDataUrl,
    }],
    primaryOptionName: 'Standard',
    details: { rating: 4, expectedClosure: '2026-12-01', reference: 'REF-10', privateNotes: 'Internal only' },
    alternatives: [{ id: 'plus', name: 'Plus', lines: [], discountType: 'none', discountValue: 0, pricing: { paymentOptions: [plan] } }],
    pricing: {
      paymentOptions: ['cash', plan], markupPercent: 12.5, marginPercent: 8, percentageBasis: 'markup',
      fixedSalesPriceCents: 50_000, additionalGpCents: 35_000, settlementCents: 15_000,
    },
    issueDate: '2026-11-18', validUntil: '2099-11-19', discountType: 'none', discountValue: 0,
    notes: '', terms: [], subtotalCents: 300_000, discountCents: 0, vatCents: 45_000,
    totalCents: 345_000, createdAt: '2026-11-18T00:00:00.000Z', createdBy: 'Praveen Gounder', exportedFilename: '',
  }
  await saveCatalogueItem(item)
  const product = { ...item, id: 'package-only', name: 'Package-only product', monthlyCents: 20_000 }
  const packageItem = {
    id: 'lte', name: 'LTE package', description: '', category: 'Connectivity', imageDataUrl: item.imageDataUrl,
    items: [{ itemId: item.id, quantity: 2 }, { itemId: product.id, quantity: 3, product }],
  }
  await savePackage(packageItem)
  await saveClient(client)
  await saveQuote(quote)
  const customProduct = { ...quote.lines[0], id: 'custom-product', itemId: null }
  const feature = {
    ...customProduct, id: 'custom-feature', name: 'Additional support', imageDataUrl: undefined,
    accessoryForId: customProduct.id, customFeature: true,
  }
  const draft: Quote = {
    ...quote, id: 'q-without-client', number: 'QT-2', clientId: '', clientSnapshot: { ...client, id: '', name: '' },
    alternatives: [{ ...quote.alternatives![0], lines: [customProduct, feature] }],
  }
  await saveQuote(draft)
  await saveSettings({ ...DEFAULT_SETTINGS, paymentPlans: [plan] })
  const backup = await exportDatabase()
  db.run("UPDATE quotations SET pricing_json = NULL, offer_options_json = NULL; UPDATE catalogue_items SET cost_cents = NULL, monthly_cents = NULL, item_details_json = NULL; UPDATE clients SET details_json = NULL")
  await expect(restoreDatabase(zipSync({ 'unrelated.sqlite': new SQL.Database().export() }))).rejects.toThrow('valid Techspire')
  await expect(restoreDatabase(zipSync({ 'first.db': backup, 'second.sqlite': backup }))).rejects.toThrow('more than one')
  await restoreDatabase(zipSync({ 'workspace/backup.sqlite': backup }))
  const restored = await loadAppData()
  expect(restored.catalogue.find((entry) => entry.id === item.id)).toEqual(item)
  expect(restored.clients.find((entry) => entry.id === client.id)).toEqual(client)
  expect(restored.quotations.find((entry) => entry.id === quote.id)).toEqual(quote)
  expect(restored.quotations.find((entry) => entry.id === draft.id)).toEqual(draft)
  expect(restored.settings.paymentPlans).toEqual([plan])
  const restoredPackage = restored.packages.find((entry) => entry.id === packageItem.id)!
  expect(restoredPackage).toEqual(packageItem)
  const printers = restored.packages.find((entry) => entry.id === 'reference-ineo')!
  expect(printers.items).toHaveLength(30)
  expect(printers.imageDataUrl).toMatch(/^data:image\/jpeg;base64,/)
  expect(printers.items.filter((entry) => entry.product?.productGroup === 'Colour').every((entry) =>
    entry.product?.imageDataUrl?.startsWith('data:image/jpeg;base64,'))).toBe(true)
  expect(createPackageLine(printers, restored.catalogue).packageFeatures?.map(({ item }) => item.priceCents)).toEqual([
    2595173, 3068609, 4044320, 4133759, 4252438, 4753111, 5543597,
    6422988, 8920700, 13609030, 15606050,
    22339572,
    490000, 952580, 1006720, 1309058, 1855879,
    1905234, 2332775, 3351500,
    3442446, 4029651,
    4317276, 4892924, 7696757,
    7925845, 12062572, 16078150, 18647200,
  ])
  expect(restored.catalogue.some((entry) => entry.id === product.id)).toBe(false)
  expect(createPackageLine(restoredPackage, restored.catalogue).packageFeatures).toEqual([
    { item, quantity: 2 }, { item: product, quantity: 3 },
  ])
  db.close()
})
