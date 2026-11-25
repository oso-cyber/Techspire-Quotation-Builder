import NativeDatabase from '@tauri-apps/plugin-sql'
import initSqlJs, { type Database as SqlDatabase } from 'sql.js'
import { unzipSync } from 'fflate'
import { referenceFirewallPackage, referenceHostedPackage, referenceIctSlaPackage, referenceLtePackage, referenceOnPremPackage, referencePackages, referenceStructuredNetworksPackage, withReferencePhotos } from './referencePackages'
import { referenceIneoMono300SeriesPackage, referenceIneoMonoAdditionalPackage, referenceIneoMonoB287B367Package, referenceIneoMonoB551iPackage, referenceIneoMonoHighVolumePackage, referenceIneoMonoPackage } from './referencePackages'
import { ADDITIONAL_PAYMENT_PLANS } from './paymentPlans'
import sqlWasm from 'sql.js/dist/sql-wasm.wasm?url&inline'
import { DEFAULT_ORDERING_TERMS, DEFAULT_SETTINGS, today, type AppData, type CompanySettings, type Quote, type QuoteTemplate } from './domain'

const DATABASE_KEY = 'techspire-quotation-builder.sqlite'

let sqliteRuntime: ReturnType<typeof initSqlJs> | undefined

function initializeSqlite() {
  if (!sqliteRuntime) {
    const binary = atob(sqlWasm.slice(sqlWasm.indexOf(',') + 1))
    const wasmBinary = Uint8Array.from(binary, (character) => character.charCodeAt(0)).buffer
    const config = { wasmBinary, locateFile: () => sqlWasm }
    sqliteRuntime = initSqlJs(config)
  }
  return sqliteRuntime
}
type NativeSqlDatabase = InstanceType<typeof NativeDatabase>
type SqlValue = string | number | Uint8Array | null
type DatabaseBackend =
  | { kind: 'browser'; db: SqlDatabase }
  | { kind: 'desktop'; db: NativeSqlDatabase }

let databasePromise: Promise<DatabaseBackend> | undefined
let writeQueue = Promise.resolve()

const schema = `
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, contact TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '', city TEXT NOT NULL DEFAULT '',
    province TEXT NOT NULL DEFAULT '', postal_code TEXT NOT NULL DEFAULT '',
    vat_number TEXT NOT NULL DEFAULT '', archived INTEGER NOT NULL DEFAULT 0, details_json TEXT
  );
  CREATE TABLE IF NOT EXISTS catalogue_items (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
    sku TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT '',
    unit TEXT NOT NULL DEFAULT 'each', price_cents INTEGER NOT NULL,
    vat_applicable INTEGER NOT NULL DEFAULT 1, active INTEGER NOT NULL DEFAULT 1,
    cost_cents INTEGER, monthly_cents INTEGER, item_details_json TEXT
  );
  CREATE TABLE IF NOT EXISTS quotations (
    id TEXT PRIMARY KEY, number TEXT NOT NULL UNIQUE, status TEXT NOT NULL,
    title TEXT NOT NULL, client_id TEXT NOT NULL, client_snapshot TEXT NOT NULL,
    lines_json TEXT NOT NULL, issue_date TEXT NOT NULL, valid_until TEXT NOT NULL,
    discount_type TEXT NOT NULL, discount_value REAL NOT NULL, notes TEXT NOT NULL,
    terms_json TEXT NOT NULL, subtotal_cents INTEGER NOT NULL,
    discount_cents INTEGER NOT NULL, vat_cents INTEGER NOT NULL,
    total_cents INTEGER NOT NULL, created_at TEXT NOT NULL,
    created_by TEXT NOT NULL DEFAULT '',
    exported_filename TEXT NOT NULL DEFAULT '', pricing_json TEXT, offer_options_json TEXT
  );
  CREATE TABLE IF NOT EXISTS packages (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL,
    items_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL,
    input_label TEXT NOT NULL, input_key TEXT NOT NULL, rules_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS quote_templates (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
    quote_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK(id = 1), json TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_quotations_client ON quotations(client_id);
  CREATE INDEX IF NOT EXISTS idx_quotations_created ON quotations(created_at);
`

function isTauri() {
  return '__TAURI_INTERNALS__' in window
}

function request<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

async function openStorage() {
  const opening = indexedDB.open('techspire-quotation-storage', 1)
  opening.onupgradeneeded = () => {
    opening.result.createObjectStore('files')
  }
  return request(opening)
}

async function loadDatabaseBytes(): Promise<Uint8Array | undefined> {
  const store = await openStorage()
  const transaction = store.transaction('files', 'readonly')
  return request(transaction.objectStore('files').get(DATABASE_KEY))
}

async function persistDatabase(db: SqlDatabase) {
  const store = await openStorage()
  const transaction = store.transaction('files', 'readwrite')
  transaction.objectStore('files').put(db.export(), DATABASE_KEY)
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('Could not save database'))
    transaction.onabort = () => reject(transaction.error ?? new Error('Database save was cancelled'))
  })
}

function rows(db: SqlDatabase, query: string): Array<Record<string, unknown>> {
  const result = db.exec(query)[0]
  if (!result) return []
  return result.values.map((values) =>
    Object.fromEntries(result.columns.map((column, index) => [column, values[index]])),
  )
}

async function selectRows(backend: DatabaseBackend, query: string) {
  if (backend.kind === 'desktop') {
    return backend.db.select<Array<Record<string, unknown>>>(query)
  }
  return rows(backend.db, query)
}

async function execute(backend: DatabaseBackend, query: string, values: SqlValue[] = []) {
  if (backend.kind === 'desktop') {
    let index = 0
    const nativeQuery = query.replace(/\?/g, () => `$${++index}`)
    await backend.db.execute(nativeQuery, values)
    return
  }
  backend.db.run(query, values)
}

async function persist(backend: DatabaseBackend) {
  if (backend.kind === 'browser') await persistDatabase(backend.db)
}

const optionalColumns = [
  { table: 'clients', name: 'details_json', type: 'TEXT' },
  { table: 'quotations', name: 'pricing_json', type: 'TEXT' },
  { table: 'quotations', name: 'offer_options_json', type: 'TEXT' },
  { table: 'quotations', name: 'created_by', type: "TEXT NOT NULL DEFAULT ''" },
  { table: 'catalogue_items', name: 'item_details_json', type: 'TEXT' },
  { table: 'catalogue_items', name: 'cost_cents', type: 'INTEGER' },
  { table: 'catalogue_items', name: 'monthly_cents', type: 'INTEGER' },
] as const

async function runSchema(backend: DatabaseBackend) {
  for (const statement of schema.split(';').map((part) => part.trim()).filter(Boolean)) {
    if (statement !== 'PRAGMA foreign_keys = ON') await execute(backend, statement)
  }
  for (const { table, name, type } of optionalColumns) {
    const columns = await selectRows(backend, `PRAGMA table_info(${table})`)
    if (!columns.some((column) => column.name === name)) {
      await execute(backend, `ALTER TABLE ${table} ADD COLUMN ${name} ${type}`)
    }
  }
  const migration = await selectRows(backend, 'SELECT version FROM schema_migrations WHERE version = 1')
  if (!migration.length) {
    await execute(backend, 'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)', [
      1,
      new Date().toISOString(),
    ])
  }
  const settings = await selectRows(backend, 'SELECT json FROM settings WHERE id = 1')
  if (!settings.length) {
    await execute(backend, 'INSERT INTO settings (id, json) VALUES (?, ?)', [
      1,
      JSON.stringify(DEFAULT_SETTINGS),
    ])
  }
  const settingsMigration = await selectRows(backend, 'SELECT version FROM schema_migrations WHERE version = 2')
  if (!settingsMigration.length) {
    const savedSettings = await selectRows(backend, 'SELECT json FROM settings WHERE id = 1')
    if (savedSettings.length) {
      const current = JSON.parse(String(savedSettings[0].json)) as Partial<CompanySettings>
      if (/^QT-\d{4}-$/.test(current.quotationPrefix ?? '')) {
        await execute(
          backend,
          'UPDATE settings SET json = ? WHERE id = 1',
          [JSON.stringify({ ...DEFAULT_SETTINGS, ...current, quotationPrefix: 'QT-' })],
        )
      }
    }
    await execute(backend, 'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)', [
      2,
      new Date().toISOString(),
    ])
  }
  const companyMigration = await selectRows(backend, 'SELECT version FROM schema_migrations WHERE version = 3')
  if (!companyMigration.length) {
    const savedSettings = await selectRows(backend, 'SELECT json FROM settings WHERE id = 1')
    if (savedSettings.length) {
      const current = JSON.parse(String(savedSettings[0].json)) as Partial<CompanySettings>
      const updated: CompanySettings = { ...DEFAULT_SETTINGS, ...current }
      const companyFields = [
        'name',
        'registrationNumber',
        'vatNumber',
        'address',
        'phone',
        'email',
        'website',
        'preparedBy',
      ] as const
      companyFields.forEach((field) => {
        if (!current[field]?.trim()) updated[field] = DEFAULT_SETTINGS[field]
      })
      await execute(backend, 'UPDATE settings SET json = ? WHERE id = 1', [JSON.stringify(updated)])
    }
    await execute(backend, 'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)', [
      3,
      new Date().toISOString(),
    ])
  }
  const termsMigration = await selectRows(backend, 'SELECT version FROM schema_migrations WHERE version = 4')
  if (!termsMigration.length) {
    const savedSettings = await selectRows(backend, 'SELECT json FROM settings WHERE id = 1')
    if (savedSettings.length) {
      const current = JSON.parse(String(savedSettings[0].json)) as Partial<CompanySettings>
      const updated: CompanySettings = {
        ...DEFAULT_SETTINGS,
        ...current,
        defaultTerms: current.defaultTerms?.length ? current.defaultTerms : DEFAULT_ORDERING_TERMS,
      }
      await execute(backend, 'UPDATE settings SET json = ? WHERE id = 1', [JSON.stringify(updated)])
    }
    await execute(backend, 'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)', [
      4,
      new Date().toISOString(),
    ])
  }
  const quoteTemplatesMigration = await selectRows(backend, 'SELECT version FROM schema_migrations WHERE version = 5')
  if (!quoteTemplatesMigration.length) {
    await execute(backend, 'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)', [
      5,
      new Date().toISOString(),
    ])
  }
  if (!(await selectRows(backend, 'SELECT version FROM schema_migrations WHERE version = 6')).length) {
    for (const item of referencePackages) {
      await execute(backend, `INSERT OR IGNORE INTO packages (id,name,description,items_json)
        SELECT ?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM packages WHERE lower(trim(name)) = lower(?))`,
        [item.id, item.name, item.description, encodePackage(item), item.name])
    }
    await execute(backend, 'INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)', [6, new Date().toISOString()])
  }
  await populateReferenceProducts(backend, 7, referenceLtePackage)
  await populateReferenceProducts(backend, 8, referenceIctSlaPackage)
  await populateReferenceProducts(backend, 9, referenceFirewallPackage)
  await populateReferenceProducts(backend, 10, referenceStructuredNetworksPackage)
  await populateReferenceProducts(backend, 11, referenceHostedPackage)
  await populateReferenceProducts(backend, 12, referenceOnPremPackage)
  await populateReferenceProducts(backend, 13, referenceIneoMonoPackage)
  await populateReferenceProducts(backend, 14, referenceIneoMonoAdditionalPackage)
  await populateReferenceProducts(backend, 15, referenceIneoMonoB287B367Package)
  await populateReferenceProducts(backend, 16, referenceIneoMono300SeriesPackage)
  await populateReferenceProducts(backend, 17, referenceIneoMonoB551iPackage)
  await populateReferenceProducts(backend, 18, referenceIneoMonoHighVolumePackage)
  if (!(await selectRows(backend, 'SELECT version FROM schema_migrations WHERE version = 19')).length) {
    const [row] = await selectRows(backend, 'SELECT json FROM settings WHERE id = 1')
    const settings = JSON.parse(String(row.json)) as CompanySettings
    if (settings.paymentPlans) {
      const existing = settings.paymentPlans
      const additions = ADDITIONAL_PAYMENT_PLANS.filter((plan) => !existing.some((entry) =>
        entry.id === plan.id || (entry.months === plan.months && entry.escalation === plan.escalation &&
          (entry.name ?? '').trim().toLowerCase() === (plan.name ?? '').toLowerCase())))
      if (additions.length) {
        await execute(backend, 'UPDATE settings SET json = ? WHERE id = 1', [
          JSON.stringify({ ...settings, paymentPlans: [...existing, ...additions] }),
        ])
      }
    }
    await execute(backend, 'INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)', [19, new Date().toISOString()])
  }
  await persist(backend)
}

async function populateReferenceProducts(backend: DatabaseBackend, version: number, reference: AppData['packages'][number]) {
  if (!(await selectRows(backend, `SELECT version FROM schema_migrations WHERE version = ${version}`)).length) {
    const rows = await selectRows(backend, 'SELECT id,name,description,items_json FROM packages ORDER BY id')
    const row = rows.find((entry) => entry.id === reference.id)
      ?? rows.find((entry) => String(entry.name).trim().toLowerCase() === reference.name.toLowerCase())
    if (row) {
      const existing = decodePackage(row)
      const byName = (product: { name: string; productGroup?: string }) =>
        [product.productGroup, product.name].map((value) => value?.trim().toLowerCase()).join(':')
      const legacyProducts = await selectRows(backend, 'SELECT id,name,item_details_json FROM catalogue_items')
      const keys = new Set(existing.items.flatMap((entry) => {
        if (entry.product) return [byName(entry.product)]
        const legacy = legacyProducts.find((item) => item.id === entry.itemId)
        if (!legacy) return []
        const { productGroup } = JSON.parse(String(legacy.item_details_json ?? '{}')) as { productGroup?: string }
        return [byName({ name: String(legacy.name), productGroup })]
      }))
      const additions = reference.items.filter((entry) => !existing.items.some((item) => item.itemId === entry.itemId)
        && entry.product && !keys.has(byName(entry.product)))
      if (additions.length) {
        await execute(backend, 'UPDATE packages SET items_json = ?, description = ? WHERE id = ?', [
          encodePackage({ ...existing, category: existing.category || reference.category, items: [...existing.items, ...additions] }),
          existing.description || reference.description,
          existing.id,
        ])
      }
    } else {
      await execute(backend, 'INSERT OR IGNORE INTO packages (id,name,description,items_json) VALUES (?,?,?,?)', [
        reference.id, reference.name, reference.description, encodePackage(reference),
      ])
    }
    await execute(backend, 'INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)', [version, new Date().toISOString()])
  }
}

export async function getDatabase(): Promise<DatabaseBackend> {
  if (!databasePromise) {
    databasePromise = (async () => {
      if (isTauri()) {
        const backend: DatabaseBackend = {
          kind: 'desktop',
          db: await NativeDatabase.load('sqlite:techspire.db'),
        }
        await runSchema(backend)
        return backend
      }
      const SQL = await initializeSqlite()
      const bytes = await loadDatabaseBytes()
      const backend: DatabaseBackend = {
        kind: 'browser',
        db: bytes ? new SQL.Database(bytes) : new SQL.Database(),
      }
      await runSchema(backend)
      return backend
    })()
  }
  return databasePromise
}

function appDataFromRows(
  clientRows: Array<Record<string, unknown>>,
  catalogueRows: Array<Record<string, unknown>>,
  quotationRows: Array<Record<string, unknown>>,
  packageRows: Array<Record<string, unknown>>,
  templateRows: Array<Record<string, unknown>>,
  quoteTemplateRows: Array<Record<string, unknown>>,
  settingsRows: Array<Record<string, unknown>>,
): AppData {
  const clients = clientRows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    contact: String(row.contact),
    email: String(row.email),
    phone: String(row.phone),
    address: String(row.address),
    city: String(row.city),
    province: String(row.province),
    postalCode: String(row.postal_code),
    vatNumber: String(row.vat_number),
    archived: Boolean(row.archived),
    details: row.details_json == null ? undefined : JSON.parse(String(row.details_json)) as AppData['clients'][number]['details'],
  }))
  const catalogue = catalogueRows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    description: String(row.description),
    sku: String(row.sku),
    category: String(row.category),
    unit: String(row.unit),
    priceCents: Number(row.price_cents),
    ...JSON.parse(String(row.item_details_json ?? '{}')) as Pick<AppData['catalogue'][number], 'imageDataUrl' | 'featureItemIds' | 'productGroup'>,
    costCents: row.cost_cents == null ? undefined : Number(row.cost_cents),
    monthlyCents: row.monthly_cents == null ? undefined : Number(row.monthly_cents),
    vatApplicable: Boolean(row.vat_applicable),
    active: Boolean(row.active),
  }))
  const quotations = quotationRows.map((row) => ({
    id: String(row.id),
    number: String(row.number),
    status: String(row.status) as Quote['status'],
    title: String(row.title),
    clientId: String(row.client_id),
    clientSnapshot: JSON.parse(String(row.client_snapshot)),
    lines: JSON.parse(String(row.lines_json)),
    ...JSON.parse(String(row.offer_options_json ?? '{}')) as Pick<Quote, 'primaryOptionName' | 'alternatives' | 'details'>,
    pricing: row.pricing_json ? JSON.parse(String(row.pricing_json)) as Quote['pricing'] : undefined,
    issueDate: String(row.issue_date),
    validUntil: String(row.valid_until),
    discountType: String(row.discount_type) as Quote['discountType'],
    discountValue: Number(row.discount_value),
    notes: String(row.notes),
    terms: JSON.parse(String(row.terms_json)),
    subtotalCents: Number(row.subtotal_cents),
    discountCents: Number(row.discount_cents),
    vatCents: Number(row.vat_cents),
    totalCents: Number(row.total_cents),
    createdAt: String(row.created_at),
    createdBy: String(row.created_by ?? '') || undefined,
    exportedFilename: String(row.exported_filename),
  })).map((quote) => ({
    ...quote,
    status:
      quote.status !== 'Accepted' &&
      quote.status !== 'Rejected' &&
      quote.status !== 'Cancelled' &&
      quote.validUntil < today()
        ? 'Expired' as const
        : quote.status,
  }))
  const packages = packageRows.map((row) => withReferencePhotos(decodePackage(row)))
  const templates = templateRows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    description: String(row.description),
    inputLabel: String(row.input_label),
    inputKey: String(row.input_key),
    rules: JSON.parse(String(row.rules_json)),
  }))
  const quoteTemplates: QuoteTemplate[] = quoteTemplateRows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    description: String(row.description),
    quote: JSON.parse(String(row.quote_json)) as Quote,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }))
  const settings = settingsRows.length
    ? { ...DEFAULT_SETTINGS, ...(JSON.parse(String(settingsRows[0].json)) as Partial<CompanySettings>) }
    : DEFAULT_SETTINGS
  return { clients, catalogue, quotations, packages, templates, quoteTemplates, settings }
}

export async function loadAppData(): Promise<AppData> {
  const db = await getDatabase()
  const [clients, catalogue, quotations, packages, templates, quoteTemplates, settings] = await Promise.all([
    selectRows(db, 'SELECT * FROM clients ORDER BY name'),
    selectRows(db, 'SELECT * FROM catalogue_items ORDER BY name'),
    selectRows(db, 'SELECT * FROM quotations ORDER BY created_at DESC'),
    selectRows(db, 'SELECT * FROM packages ORDER BY name'),
    selectRows(db, 'SELECT * FROM templates ORDER BY name'),
    selectRows(db, 'SELECT * FROM quote_templates ORDER BY name'),
    selectRows(db, 'SELECT json FROM settings WHERE id = 1'),
  ])
  const data = appDataFromRows(clients, catalogue, quotations, packages, templates, quoteTemplates, settings)
  if (data.settings.preparedBy === 'Vijay Naidoo') {
    data.settings = { ...data.settings, preparedBy: 'Praveen Naidoo' }
    await saveSettings(data.settings)
  }
  return data
}

function enqueueWrite<T>(operation: () => Promise<T>): Promise<T> {
  const current = writeQueue.then(operation)
  writeQueue = current.then(
    () => undefined,
    () => undefined,
  )
  return current
}

const insertClient = `INSERT OR REPLACE INTO clients
  (id,name,contact,email,phone,address,city,province,postal_code,vat_number,archived,details_json)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`

function clientValues(client: AppData['clients'][number]) {
  return [
    client.id, client.name, client.contact, client.email, client.phone, client.address,
    client.city, client.province, client.postalCode, client.vatNumber, Number(client.archived),
    client.details ? JSON.stringify(client.details) : null,
  ]
}

export async function saveClient(client: AppData['clients'][number]) {
  return enqueueWrite(async () => {
    const db = await getDatabase()
    await execute(db, insertClient, clientValues(client))
    await persist(db)
  })
}

function encodeItemDetails({ imageDataUrl, featureItemIds, productGroup }: AppData['catalogue'][number]) {
  return JSON.stringify({ imageDataUrl, featureItemIds, productGroup })
}

function encodeOfferOptions({ primaryOptionName, alternatives, details }: Quote) {
  return JSON.stringify({ primaryOptionName, alternatives, details })
}

export async function saveCatalogueItem(item: AppData['catalogue'][number]) {
  return enqueueWrite(async () => {
    const db = await getDatabase()
    await execute(
      db,
      `INSERT OR REPLACE INTO catalogue_items
      (id,name,description,sku,category,unit,price_cents,vat_applicable,active,cost_cents,monthly_cents,item_details_json)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        item.id,
        item.name,
        item.description,
        item.sku,
        item.category,
        item.unit,
        item.priceCents,
        Number(item.vatApplicable),
        Number(item.active),
        item.costCents ?? null,
        item.monthlyCents ?? null,
        encodeItemDetails(item),
      ],
    )
    await persist(db)
  })
}

export async function saveCatalogueItems(items: AppData['catalogue']) {
  return enqueueWrite(async () => {
    const db = await getDatabase()
    await execute(db, 'BEGIN TRANSACTION')
    try {
      for (const item of items) {
        await execute(
          db,
          `INSERT OR REPLACE INTO catalogue_items
          (id,name,description,sku,category,unit,price_cents,vat_applicable,active,cost_cents,monthly_cents,item_details_json)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            item.id,
            item.name,
            item.description,
            item.sku,
            item.category,
            item.unit,
            item.priceCents,
            Number(item.vatApplicable),
            Number(item.active),
            item.costCents ?? null,
            item.monthlyCents ?? null,
            encodeItemDetails(item),
          ],
        )
      }
      await execute(db, 'COMMIT')
      await persist(db)
    } catch (cause) {
      await execute(db, 'ROLLBACK')
      throw cause
    }
  })
}

export async function saveQuote(quote: Quote) {
  return enqueueWrite(async () => {
    const db = await getDatabase()
    await execute(
      db,
      `INSERT INTO quotations
      (id,number,status,title,client_id,client_snapshot,lines_json,issue_date,valid_until,
       discount_type,discount_value,notes,terms_json,subtotal_cents,discount_cents,vat_cents,
       total_cents,created_at,created_by,exported_filename,pricing_json,offer_options_json)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
      number=excluded.number,status=excluded.status,title=excluded.title,
      client_id=excluded.client_id,client_snapshot=excluded.client_snapshot,
      lines_json=excluded.lines_json,issue_date=excluded.issue_date,valid_until=excluded.valid_until,
      discount_type=excluded.discount_type,discount_value=excluded.discount_value,
      notes=excluded.notes,terms_json=excluded.terms_json,subtotal_cents=excluded.subtotal_cents,
      discount_cents=excluded.discount_cents,vat_cents=excluded.vat_cents,
      total_cents=excluded.total_cents,created_at=excluded.created_at,
      created_by=excluded.created_by,
      exported_filename=excluded.exported_filename,pricing_json=excluded.pricing_json,offer_options_json=excluded.offer_options_json`,
      [
        quote.id,
        quote.number,
        quote.status,
        quote.title,
        quote.clientId,
        JSON.stringify(quote.clientSnapshot),
        JSON.stringify(quote.lines),
        quote.issueDate,
        quote.validUntil,
        quote.discountType,
        quote.discountValue,
        quote.notes,
        JSON.stringify(quote.terms),
        quote.subtotalCents,
        quote.discountCents,
        quote.vatCents,
        quote.totalCents,
        quote.createdAt,
        quote.createdBy ?? '',
        quote.exportedFilename,
        quote.pricing ? JSON.stringify(quote.pricing) : null,
        encodeOfferOptions(quote),
      ],
    )
    await persist(db)
  })
}

export async function saveSettings(settings: CompanySettings) {
  return enqueueWrite(async () => {
    const db = await getDatabase()
    await execute(db, 'INSERT OR REPLACE INTO settings (id,json) VALUES (?,?)', [
      1,
      JSON.stringify(settings),
    ])
    await persist(db)
  })
}

function decodePackage(row: Record<string, unknown>): AppData['packages'][number] {
  const saved = JSON.parse(String(row.items_json)) as AppData['packages'][number]['items'] | Pick<AppData['packages'][number], 'items' | 'category' | 'imageDataUrl'>
  return {
    id: String(row.id),
    name: String(row.name),
    description: String(row.description),
    ...(Array.isArray(saved) ? { items: saved } : saved),
  }
}

function encodePackage({ items, category, imageDataUrl }: AppData['packages'][number]) {
  return JSON.stringify({ items, category, imageDataUrl })
}

export async function savePackage(item: AppData['packages'][number]) {
  return enqueueWrite(async () => {
    const db = await getDatabase()
    await execute(db, 'INSERT OR REPLACE INTO packages (id,name,description,items_json) VALUES (?,?,?,?)', [
      item.id,
      item.name,
      item.description,
      encodePackage(item),
    ])
    await persist(db)
  })
}

export async function saveTemplate(item: AppData['templates'][number]) {
  return enqueueWrite(async () => {
    const db = await getDatabase()
    await execute(
      db,
      'INSERT OR REPLACE INTO templates (id,name,description,input_label,input_key,rules_json) VALUES (?,?,?,?,?,?)',
      [
        item.id,
        item.name,
        item.description,
        item.inputLabel,
        item.inputKey,
        JSON.stringify(item.rules),
      ],
    )
    await persist(db)
  })
}

export async function saveQuoteTemplate(item: QuoteTemplate) {
  return enqueueWrite(async () => {
    const db = await getDatabase()
    await execute(
      db,
      `INSERT INTO quote_templates (id,name,description,quote_json,created_at,updated_at)
      VALUES (?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,description=excluded.description,quote_json=excluded.quote_json,
      updated_at=excluded.updated_at`,
      [item.id, item.name, item.description, JSON.stringify(item.quote), item.createdAt, item.updatedAt],
    )
    await persist(db)
  })
}

export async function deleteQuoteTemplate(id: string) {
  return enqueueWrite(async () => {
    const db = await getDatabase()
    await execute(db, 'DELETE FROM quote_templates WHERE id = ?', [id])
    await persist(db)
  })
}

async function writeAppData(db: SqlDatabase, data: AppData) {
  db.run(schema)
  db.run('BEGIN TRANSACTION')
  for (const client of data.clients) {
    db.run(insertClient, clientValues(client))
  }
  for (const item of data.catalogue) {
    db.run(
      'INSERT OR REPLACE INTO catalogue_items (id,name,description,sku,category,unit,price_cents,vat_applicable,active,cost_cents,monthly_cents,item_details_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [item.id, item.name, item.description, item.sku, item.category, item.unit, item.priceCents, Number(item.vatApplicable), Number(item.active), item.costCents ?? null, item.monthlyCents ?? null, encodeItemDetails(item)],
    )
  }
  for (const quote of data.quotations) {
    db.run(
      `INSERT OR REPLACE INTO quotations
      (id,number,status,title,client_id,client_snapshot,lines_json,issue_date,valid_until,
       discount_type,discount_value,notes,terms_json,subtotal_cents,discount_cents,vat_cents,
       total_cents,created_at,created_by,exported_filename,pricing_json,offer_options_json)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [quote.id, quote.number, quote.status, quote.title, quote.clientId, JSON.stringify(quote.clientSnapshot), JSON.stringify(quote.lines), quote.issueDate, quote.validUntil, quote.discountType, quote.discountValue, quote.notes, JSON.stringify(quote.terms), quote.subtotalCents, quote.discountCents, quote.vatCents, quote.totalCents, quote.createdAt, quote.createdBy ?? '', quote.exportedFilename, quote.pricing ? JSON.stringify(quote.pricing) : null, encodeOfferOptions(quote)],
    )
  }
  for (const item of data.packages) {
    db.run('INSERT OR REPLACE INTO packages (id,name,description,items_json) VALUES (?,?,?,?)', [item.id, item.name, item.description, encodePackage(item)])
  }
  for (const item of data.templates) {
    db.run('INSERT OR REPLACE INTO templates (id,name,description,input_label,input_key,rules_json) VALUES (?,?,?,?,?,?)', [item.id, item.name, item.description, item.inputLabel, item.inputKey, JSON.stringify(item.rules)])
  }
  for (const item of data.quoteTemplates) {
    db.run('INSERT OR REPLACE INTO quote_templates (id,name,description,quote_json,created_at,updated_at) VALUES (?,?,?,?,?,?)', [item.id, item.name, item.description, JSON.stringify(item.quote), item.createdAt, item.updatedAt])
  }
  db.run('INSERT OR REPLACE INTO settings (id,json) VALUES (1,?)', [JSON.stringify(data.settings)])
  db.run('INSERT OR REPLACE INTO schema_migrations (version,applied_at) VALUES (1,?)', [new Date().toISOString()])
  db.run('INSERT OR REPLACE INTO schema_migrations (version,applied_at) VALUES (2,?)', [new Date().toISOString()])
  db.run('INSERT OR REPLACE INTO schema_migrations (version,applied_at) VALUES (3,?)', [new Date().toISOString()])
  db.run('INSERT OR REPLACE INTO schema_migrations (version,applied_at) VALUES (4,?)', [new Date().toISOString()])
  db.run('INSERT OR REPLACE INTO schema_migrations (version,applied_at) VALUES (5,?)', [new Date().toISOString()])
  db.run('COMMIT')
}

export async function exportDatabase() {
  const backend = await getDatabase()
  if (backend.kind === 'browser') return backend.db.export()
  const SQL = await initializeSqlite()
  const temporary = new SQL.Database()
  try {
    await writeAppData(temporary, await loadAppData())
    return temporary.export()
  } finally {
    temporary.close()
  }
}

function readBackupDatabase(bytes: Uint8Array) {
  const sqliteHeader = 'SQLite format 3\0'
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    let entries = 0
    const files = unzipSync(bytes, {
      filter: ({ name }) => {
        if (name.startsWith('__MACOSX/') || !/\.(sqlite3?|db)$/i.test(name)) return false
        entries += 1
        if (entries > 1) throw new Error('The ZIP contains more than one database. Choose a single backup.')
        return true
      },
    })
    if (entries === 0) throw new Error('The ZIP does not contain a .sqlite, .sqlite3 or .db backup.')
    bytes = Object.values(files)[0]
  }
  if (new TextDecoder().decode(bytes.subarray(0, sqliteHeader.length)) !== sqliteHeader) {
    throw new Error('Choose a Techspire SQLite database or a ZIP containing one.')
  }
  return bytes
}

export async function restoreDatabase(bytes: Uint8Array) {
  return enqueueWrite(async () => {
    const databaseBytes = readBackupDatabase(bytes)
    const SQL = await initializeSqlite()
    const restored = new SQL.Database(databaseBytes)
    let retained = false
    try {
      const tableNames = rows(restored, "SELECT name FROM sqlite_master WHERE type='table'").map((row) => String(row.name))
      const integrity = rows(restored, 'PRAGMA integrity_check')
      if (integrity[0]?.integrity_check !== 'ok' || !tableNames.includes('quotations') || !tableNames.includes('settings')) {
        throw new Error('The selected file is not a valid Techspire quotation database.')
      }
      restored.run(schema)
      for (const { table, name, type } of optionalColumns) {
        if (!rows(restored, `PRAGMA table_info(${table})`).some((column) => column.name === name)) {
          restored.run(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`)
        }
      }
      const data = appDataFromRows(
        rows(restored, 'SELECT * FROM clients'),
        rows(restored, 'SELECT * FROM catalogue_items'),
        rows(restored, 'SELECT * FROM quotations'),
        rows(restored, 'SELECT * FROM packages'),
        rows(restored, 'SELECT * FROM templates'),
        rows(restored, 'SELECT * FROM quote_templates'),
        rows(restored, 'SELECT json FROM settings WHERE id = 1'),
      )
      const backend = await getDatabase()
      if (backend.kind === 'browser') {
        await persistDatabase(restored)
        databasePromise = Promise.resolve({ kind: 'browser', db: restored })
        retained = true
        backend.db.close()
        return
      }
      await backend.db.execute('BEGIN')
      try {
        for (const table of ['quotations', 'clients', 'catalogue_items', 'packages', 'templates', 'quote_templates', 'settings']) {
          await backend.db.execute(`DELETE FROM ${table}`)
        }
        for (const client of data.clients) {
          await execute(backend, insertClient, clientValues(client))
        }
        for (const item of data.catalogue) {
          await execute(backend, 'INSERT INTO catalogue_items (id,name,description,sku,category,unit,price_cents,vat_applicable,active,cost_cents,monthly_cents,item_details_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', [item.id, item.name, item.description, item.sku, item.category, item.unit, item.priceCents, Number(item.vatApplicable), Number(item.active), item.costCents ?? null, item.monthlyCents ?? null, encodeItemDetails(item)])
        }
        for (const quote of data.quotations) {
          await execute(backend, 'INSERT INTO quotations (id,number,status,title,client_id,client_snapshot,lines_json,issue_date,valid_until,discount_type,discount_value,notes,terms_json,subtotal_cents,discount_cents,vat_cents,total_cents,created_at,created_by,exported_filename,pricing_json,offer_options_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [quote.id, quote.number, quote.status, quote.title, quote.clientId, JSON.stringify(quote.clientSnapshot), JSON.stringify(quote.lines), quote.issueDate, quote.validUntil, quote.discountType, quote.discountValue, quote.notes, JSON.stringify(quote.terms), quote.subtotalCents, quote.discountCents, quote.vatCents, quote.totalCents, quote.createdAt, quote.createdBy ?? '', quote.exportedFilename, quote.pricing ? JSON.stringify(quote.pricing) : null, encodeOfferOptions(quote)])
        }
        for (const item of data.packages) {
          await execute(backend, 'INSERT INTO packages (id,name,description,items_json) VALUES (?,?,?,?)', [item.id, item.name, item.description, encodePackage(item)])
        }
        for (const item of data.templates) {
          await execute(backend, 'INSERT INTO templates (id,name,description,input_label,input_key,rules_json) VALUES (?,?,?,?,?,?)', [item.id, item.name, item.description, item.inputLabel, item.inputKey, JSON.stringify(item.rules)])
        }
        for (const item of data.quoteTemplates) {
          await execute(backend, 'INSERT INTO quote_templates (id,name,description,quote_json,created_at,updated_at) VALUES (?,?,?,?,?,?)', [item.id, item.name, item.description, JSON.stringify(item.quote), item.createdAt, item.updatedAt])
        }
        await execute(backend, 'INSERT INTO settings (id,json) VALUES (?,?)', [1, JSON.stringify(data.settings)])
        await backend.db.execute('COMMIT')
      } catch (cause) {
        await backend.db.execute('ROLLBACK')
        throw cause
      }
    } finally {
      if (!retained) restored.close()
    }
  })
}
