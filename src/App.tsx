import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  Archive,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  Calculator,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Copy,
  FileClock,
  FilePlus2,
  FileText,
  FolderOpen,
  LayoutDashboard,
  LifeBuoy,
  ListFilter,
  PackageOpen,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Upload,
  Users,
  X,
  RotateCcw,
} from 'lucide-react'
import { open, save } from '@tauri-apps/plugin-dialog'
import { readFile, writeFile } from '@tauri-apps/plugin-fs'
import { downloadDir, join } from '@tauri-apps/api/path'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import {
  calculateTotals,
  catalogueNetPriceCents,
  centsFromInput,
  createId,
  createQuoteFromTemplate,
  dateAfter,
  money,
  today,
  type AppData,
  type CatalogueItem,
  type Client,
  type CompanySettings,
  type Package as QuotePackage,
  type Quote,
  type QuoteLine,
  type QuoteStatus,
  type QuoteTemplate,
  type Section,
} from './domain'
import {
  exportDatabase,
  deleteQuoteTemplate,
  loadAppData,
  restoreDatabase,
  saveCatalogueItem,
  saveCatalogueItems,
  saveClient,
  savePackage,
  saveQuote,
  saveQuoteTemplate,
  saveSettings,
} from './database'
import { parseCsv } from './csv'
import './App.css'

const navigation: Array<{
  label: string
  section: Section
  icon: typeof LayoutDashboard
  group: 'main' | 'manage' | 'system'
}> = [
  { label: 'Dashboard', section: 'dashboard', icon: LayoutDashboard, group: 'main' },
  { label: 'New quotation', section: 'builder', icon: FilePlus2, group: 'main' },
  { label: 'Catalogue', section: 'catalogue', icon: ShoppingBag, group: 'manage' },
  { label: 'Packages', section: 'packages', icon: PackageOpen, group: 'manage' },
  { label: 'Quotation templates', section: 'templates', icon: Copy, group: 'manage' },
  { label: 'Clients', section: 'clients', icon: Users, group: 'manage' },
  { label: 'Quotation history', section: 'history', icon: FileClock, group: 'manage' },
  { label: 'Settings', section: 'settings', icon: Settings, group: 'system' },
  { label: 'Backup & restore', section: 'backup', icon: Archive, group: 'system' },
]

const blankClient = (): Client => ({
  id: createId(),
  name: '',
  contact: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  province: '',
  postalCode: '',
  vatNumber: '',
  archived: false,
})

const blankCatalogueItem = (): CatalogueItem => ({
  id: createId(),
  name: '',
  description: '',
  sku: '',
  category: 'General',
  unit: 'each',
  priceCents: 0,
  vatApplicable: true,
  active: true,
})

const makeLine = (item: CatalogueItem): QuoteLine => ({
  id: createId(),
  itemId: item.id,
  unit: item.unit,
  name: item.name,
  description: item.description,
  sku: item.sku,
  quantity: 1,
  unitPriceCents: item.priceCents,
  vatApplicable: item.vatApplicable,
})

function isTauri() {
  return '__TAURI_INTERNALS__' in window
}

function quoteNumber(data: AppData, currentQuote: Quote | null = null) {
  const year = new Date().getFullYear()
  const prefix = `${data.settings.quotationPrefix}${year}-`
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const allQuotes = currentQuote && !data.quotations.some((quote) => quote.id === currentQuote.id)
    ? [...data.quotations, currentQuote]
    : data.quotations
  const highest = allQuotes.reduce((max, quote) => {
    const match = quote.number.match(new RegExp(`^${escapedPrefix}(\\d+)$`))
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)
  return `${prefix}${String(highest + 1).padStart(3, '0')}`
}

function statusTone(status: QuoteStatus) {
  return `status status-${status.toLowerCase()}`
}

function App() {
  const [data, setData] = useState<AppData | null>(null)
  const [section, setSection] = useState<Section>('dashboard')
  const [quote, setQuote] = useState<Quote | null>(null)
  const [activeQuoteId, setActiveQuoteId] = useState<string | null>(null)
  const [generatedPdf, setGeneratedPdf] = useState<{ url: string; filename: string; quote: Quote } | null>(null)
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false)
  const [modal, setModal] = useState<'client' | 'item' | 'package' | 'quote-template' | null>(null)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [editingItem, setEditingItem] = useState<CatalogueItem | null>(null)
  const [search, setSearch] = useState('')
  const [catalogueFilter, setCatalogueFilter] = useState('All categories')
  const [historyFilter, setHistoryFilter] = useState('All statuses')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loadError, setLoadError] = useState('')
  const [displayDate] = useState(() =>
    new Intl.DateTimeFormat('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date()),
  )
  const lastAutoSavedQuote = useRef('')

  useEffect(() => {
    loadAppData()
      .then(setData)
      .catch((cause: unknown) =>
        setLoadError(cause instanceof Error ? cause.message : 'Unable to open the quotation database.'),
      )
  }, [])

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(''), 3500)
    return () => window.clearTimeout(timeout)
  }, [notice])

  useEffect(() => () => {
    if (generatedPdf) URL.revokeObjectURL(generatedPdf.url)
  }, [generatedPdf])

  useEffect(() => {
    if (
      busy ||
      !quote ||
      !data ||
      quote.status !== 'Draft' ||
      !quote.clientId ||
      !quote.clientSnapshot.name.trim() ||
      !quote.lines.length ||
      quote.lines.some((line) => line.quantity <= 0 || line.unitPriceCents < 0)
    ) return
    const draft = applyTotals({ ...quote, status: 'Draft' }, data)
    const signature = JSON.stringify(draft)
    if (signature === lastAutoSavedQuote.current) return
    const timeout = window.setTimeout(() => {
      void saveQuote(draft).then(() => {
        lastAutoSavedQuote.current = signature
        setData((current) => current
          ? { ...current, quotations: [draft, ...current.quotations.filter((item) => item.id !== draft.id)] }
          : current)
      }).catch((cause: unknown) => {
        setError(cause instanceof Error ? `Draft auto-save failed: ${cause.message}` : 'Draft auto-save failed.')
      })
    }, 800)
    return () => window.clearTimeout(timeout)
  }, [busy, data, quote])

  const pageTitle = navigation.find((item) => item.section === section)?.label ?? 'Dashboard'
  const activeQuote = useMemo(
    () => data?.quotations.find((item) => item.id === activeQuoteId) ?? null,
    [activeQuoteId, data],
  )

  async function persist<T>(
    operation: () => Promise<T>,
    successMessage?: string,
    update?: () => void,
  ) {
    setError('')
    try {
      await operation()
      update?.()
      if (successMessage) setNotice(successMessage)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The requested change could not be saved.')
      throw cause
    }
  }

  function startNewQuote() {
    if (!data) return
    const issueDate = today()
    setActiveQuoteId(null)
    setQuote({
      id: createId(),
      number: quoteNumber(data, quote),
      status: 'Draft',
      title: 'Solution Proposal',
      clientId: '',
      clientSnapshot: blankClient(),
      lines: [],
      issueDate,
      validUntil: dateAfter(issueDate, data.settings.validityDays),
      discountType: 'none',
      discountValue: 0,
      notes: '',
      terms: [
        ...data.settings.defaultTerms,
        data.settings.paymentTerms,
        data.settings.warrantyTerms,
        data.settings.exclusions,
        data.settings.acceptanceWording,
      ].filter(Boolean),
      subtotalCents: 0,
      discountCents: 0,
      vatCents: 0,
      totalCents: 0,
      createdAt: new Date().toISOString(),
      exportedFilename: '',
    })
    setSection('builder')
  }

  function startQuoteWithPackage(item: QuotePackage) {
    if (!data) return
    const draft: Quote = {
      id: createId(),
      number: quoteNumber(data, quote),
      status: 'Draft',
      title: item.name,
      clientId: '',
      clientSnapshot: blankClient(),
      lines: item.items.flatMap((entry) => {
        const source = data.catalogue.find((catalogueItem) => catalogueItem.id === entry.itemId)
        return source
          ? [{ ...makeLine(source), quantity: entry.quantity, packageId: item.id, packageInstanceId: item.id, packageName: item.name }]
          : []
      }),
      issueDate: today(),
      validUntil: dateAfter(today(), data.settings.validityDays),
      discountType: 'none',
      discountValue: 0,
      notes: '',
      terms: [
        ...data.settings.defaultTerms,
        data.settings.paymentTerms,
        data.settings.warrantyTerms,
        data.settings.exclusions,
        data.settings.acceptanceWording,
      ].filter(Boolean),
      subtotalCents: 0,
      discountCents: 0,
      vatCents: 0,
      totalCents: 0,
      createdAt: new Date().toISOString(),
      exportedFilename: '',
    }
    setActiveQuoteId(null)
    setQuote(applyTotals(draft, data))
    setSection('builder')
  }

  function startQuoteFromTemplate(template: QuoteTemplate) {
    if (!data) return
    setActiveQuoteId(null)
    setQuote(createQuoteFromTemplate(template, quoteNumber(data, quote), data.clients, data.settings))
    setSection('builder')
  }

  function openQuote(selected: Quote) {
    if (!data) return
    if (selected.status !== 'Draft') {
      const revised = {
        ...structuredClone(selected),
        id: createId(),
        number: quoteNumber(data, quote),
        status: 'Draft' as const,
        issueDate: today(),
        validUntil: dateAfter(today(), data!.settings.validityDays),
        createdAt: new Date().toISOString(),
        exportedFilename: '',
      }
      setQuote(revised)
      setActiveQuoteId(null)
      setNotice(`A new draft revision was created. ${selected.number} remains unchanged.`)
      setSection('builder')
      return
    }
    setQuote(structuredClone(selected))
    setActiveQuoteId(selected.id)
    setSection('builder')
  }

  function applyTotals(value: Quote, source: AppData): Quote {
    const totals = calculateTotals(value.lines, value.discountType, value.discountValue, source.settings.vatRate)
    return {
      ...value,
      subtotalCents: totals.subtotalCents,
      discountCents: totals.discountCents,
      vatCents: totals.vatCents,
      totalCents: totals.totalCents,
    }
  }

  function updateQuote(patch: Partial<Quote>) {
    if (!quote || !data) return
    setQuote(applyTotals({ ...quote, ...patch }, data))
  }

  function selectClient(clientId: string) {
    const client = data?.clients.find((item) => item.id === clientId)
    if (!client || !quote) return
    updateQuote({ clientId, clientSnapshot: { ...client } })
  }

  function addItemToQuote(item: CatalogueItem) {
    if (!quote) return
    setQuote(applyTotals({ ...quote, lines: [...quote.lines, makeLine(item)] }, data!))
  }

  function addPackageToQuote(item: QuotePackage) {
    if (!quote || !data) return
    const packageInstanceId = createId()
    const lines = item.items.flatMap((entry) => {
      const source = data.catalogue.find((catalogueItem) => catalogueItem.id === entry.itemId)
      return source
        ? [{ ...makeLine(source), quantity: entry.quantity, packageId: item.id, packageInstanceId, packageName: item.name }]
        : []
    })
    if (!lines.length) {
      setError(`The package “${item.name}” has no available catalogue items. Edit the package and try again.`)
      return
    }
    setQuote(applyTotals({ ...quote, lines: [...quote.lines, ...lines] }, data))
  }

  async function saveDraft() {
    if (!quote || !data) return
    if (!quote.clientId || !quote.clientSnapshot.name.trim()) {
      if (!data.clients.some((client) => !client.archived)) {
        setError('Add a client to this quotation, then save the draft.')
        setEditingClient(null)
        setModal('client')
      } else {
        setError('Select a client before saving this quotation.')
        document.getElementById('quote-client')?.focus()
      }
      return
    }
    if (!quote.lines.length) {
      setError('Add at least one product or service before saving.')
      return
    }
    const saved = applyTotals({ ...quote, status: 'Draft' }, data)
    try {
      await persist(
        () => saveQuote(saved),
        'Draft saved',
        () => {
          lastAutoSavedQuote.current = JSON.stringify(saved)
          setData({ ...data, quotations: [saved, ...data.quotations.filter((item) => item.id !== saved.id)] })
          setQuote(saved)
          setActiveQuoteId(saved.id)
        },
      )
    } catch {
      return
    }
  }

  async function generatePdf() {
    if (!quote || !data) return
    if (!quote.clientId || !quote.clientSnapshot.name.trim()) {
      if (!data.clients.some((client) => !client.archived)) {
        setError('Add a client to this quotation before generating its PDF.')
        setEditingClient(null)
        setModal('client')
      } else {
        setError('Select a client and make sure their company name is recorded.')
        document.getElementById('quote-client')?.focus()
      }
      return
    }
    if (!quote.lines.length || quote.lines.some((line) => line.quantity <= 0 || line.unitPriceCents < 0)) {
      setError('Add at least one item and check that all quantities and prices are valid.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const finalQuote = applyTotals({ ...quote, status: 'Finalised' }, data)
      const { createQuotationPdf, quotationFilename } = await import('./quotationPdf')
      const document = createQuotationPdf(finalQuote, data.settings)
      const filename = quotationFilename(finalQuote)
      const bytes = new Uint8Array(document.output('arraybuffer'))
      if (isTauri()) {
        const path = await join(await downloadDir(), filename)
        await writeFile(path, bytes)
        const savedQuote = { ...finalQuote, exportedFilename: filename }
        await saveQuote(savedQuote)
        setQuote(savedQuote)
        setData({ ...data, quotations: [savedQuote, ...data.quotations.filter((item) => item.id !== savedQuote.id)] })
        setActiveQuoteId(savedQuote.id)
        setGeneratedPdf({ url: URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })), filename, quote: savedQuote })
        setPdfViewerOpen(true)
        setNotice('PDF saved to Downloads and quotation finalised.')
      } else {
        document.save(filename)
        const savedQuote = { ...finalQuote, exportedFilename: filename }
        await saveQuote(savedQuote)
        setQuote(savedQuote)
        setData({ ...data, quotations: [savedQuote, ...data.quotations.filter((item) => item.id !== savedQuote.id)] })
        setActiveQuoteId(savedQuote.id)
        setGeneratedPdf({ url: URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })), filename, quote: savedQuote })
        setPdfViewerOpen(true)
        setNotice('PDF downloaded and quotation finalised.')
      }
    } catch (cause) {
      setError(cause instanceof Error ? `PDF export failed: ${cause.message}` : 'PDF export failed.')
    } finally {
      setBusy(false)
    }
  }

  async function saveClientForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!data) return
    const form = new FormData(event.currentTarget)
    const client: Client = {
      ...(editingClient ?? blankClient()),
      name: String(form.get('name') ?? '').trim(),
      contact: String(form.get('contact') ?? '').trim(),
      email: String(form.get('email') ?? '').trim(),
      phone: String(form.get('phone') ?? '').trim(),
      address: String(form.get('address') ?? '').trim(),
      city: String(form.get('city') ?? '').trim(),
      province: String(form.get('province') ?? '').trim(),
      postalCode: String(form.get('postalCode') ?? '').trim(),
      vatNumber: String(form.get('vatNumber') ?? '').trim(),
    }
    try {
      await persist(
        () => saveClient(client),
        editingClient ? 'Client updated' : 'Client added',
        () => {
          setData({ ...data, clients: [client, ...data.clients.filter((item) => item.id !== client.id)] })
          if (quote && section === 'builder' && (!quote.clientId || quote.clientId === client.id)) {
            updateQuote({ clientId: client.id, clientSnapshot: client })
          }
          setModal(null)
          setEditingClient(null)
        },
      )
    } catch {
      return
    }
  }

  async function saveItemForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!data) return
    const form = new FormData(event.currentTarget)
    const item: CatalogueItem = {
      ...(editingItem ?? blankCatalogueItem()),
      name: String(form.get('name') ?? '').trim(),
      description: String(form.get('description') ?? '').trim(),
      sku: String(form.get('sku') ?? '').trim(),
      category: String(form.get('category') ?? '').trim() || 'General',
      unit: String(form.get('unit') ?? '').trim() || 'each',
      priceCents: catalogueNetPriceCents(
        centsFromInput(String(form.get('price') ?? '0')),
        form.get('priceIncludesVat') === 'on',
        form.get('vatApplicable') === 'on',
        data.settings.vatRate,
      ),
      vatApplicable: form.get('vatApplicable') === 'on',
      active: true,
    }
    if (form.get('pricingType') === 'hourly') item.unit = 'hour'
    const saveToCatalogue = form.get('saveToCatalogue') !== 'off'
    try {
      await persist(
        () => saveToCatalogue ? saveCatalogueItem(item) : Promise.resolve(),
        editingItem ? 'Catalogue item updated' : saveToCatalogue ? 'Catalogue item added' : 'Item added to quotation',
        () => {
          if (saveToCatalogue) {
            setData({ ...data, catalogue: [item, ...data.catalogue.filter((entry) => entry.id !== item.id)] })
          }
          if (quote) addItemToQuote(item)
          setModal(null)
          setEditingItem(null)
        },
      )
    } catch {
      return
    }
  }

  async function savePackageForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!data) return
    const form = new FormData(event.currentTarget)
    const itemIds = form.getAll('itemIds').map(String).filter(Boolean)
    if (!itemIds.length) {
      setError('Select at least one product or service for this package.')
      return
    }
    const entry: QuotePackage = {
      id: createId(),
      name: String(form.get('name') ?? '').trim(),
      description: String(form.get('description') ?? '').trim(),
      items: itemIds.map((itemId) => ({
        itemId,
        quantity: Math.max(1, Number(form.get('quantity')) || 1),
      })),
    }
    try {
      await persist(
        () => savePackage(entry),
        'Package created',
        () => {
          setData({ ...data, packages: [entry, ...data.packages] })
          setModal(null)
        },
      )
    } catch {
      return
    }
  }

  async function saveQuoteTemplateForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!data) return
    const form = new FormData(event.currentTarget)
    const source = data.quotations.find((item) => item.id === String(form.get('quoteId') ?? ''))
    if (!source) {
      setError('Choose a saved quotation to use as the template starting point.')
      return
    }
    const entry: QuoteTemplate = {
      id: createId(),
      name: String(form.get('name') ?? '').trim(),
      description: String(form.get('description') ?? '').trim(),
      quote: structuredClone(source),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    if (!entry.name) {
      setError('Enter a name for this reusable quotation template.')
      return
    }
    try {
      await persist(
        () => saveQuoteTemplate(entry),
        'Quotation template saved',
        () => {
          setData({ ...data, quoteTemplates: [entry, ...data.quoteTemplates] })
          setModal(null)
        },
      )
    } catch {
      return
    }
  }

  async function removeQuoteTemplate(template: QuoteTemplate) {
    if (!data || !window.confirm(`Delete the template “${template.name}”? Existing quotations will not be affected.`)) return
    try {
      await persist(
        () => deleteQuoteTemplate(template.id),
        'Quotation template deleted',
        () => setData({ ...data, quoteTemplates: data.quoteTemplates.filter((item) => item.id !== template.id) }),
      )
    } catch {
      return
    }
  }

  async function saveSettingsForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!data) return
    const form = new FormData(event.currentTarget)
    const settings: CompanySettings = {
      name: String(form.get('name') ?? '').trim(),
      logoDataUrl: String(form.get('logoDataUrl') ?? ''),
      registrationNumber: String(form.get('registrationNumber') ?? '').trim(),
      vatNumber: String(form.get('vatNumber') ?? '').trim(),
      address: String(form.get('address') ?? '').trim(),
      phone: String(form.get('phone') ?? '').trim(),
      email: String(form.get('email') ?? '').trim(),
      website: String(form.get('website') ?? '').trim(),
      preparedBy: String(form.get('preparedBy') ?? '').trim(),
      quotationPrefix: String(form.get('quotationPrefix') ?? 'QT-').trim() || 'QT-',
      validityDays: Math.max(1, Number(form.get('validityDays')) || 7),
      vatRate: Math.max(0, Number(form.get('vatRate')) || 0),
      paymentTerms: String(form.get('paymentTerms') ?? '').trim(),
      warrantyTerms: String(form.get('warrantyTerms') ?? '').trim(),
      exclusions: String(form.get('exclusions') ?? '').trim(),
      acceptanceWording: String(form.get('acceptanceWording') ?? '').trim(),
      defaultTerms: String(form.get('defaultTerms') ?? '')
        .split('\n')
        .map((term) => term.trim())
        .filter(Boolean),
    }
    await persist(
      () => saveSettings(settings),
      'Settings saved',
      () => setData({ ...data, settings }),
    )
  }

  function applySelectedPackage(packageId: string) {
    const item = data?.packages.find((entry) => entry.id === packageId)
    if (item) addPackageToQuote(item)
  }

  async function exportBackup() {
    setError('')
    try {
      const bytes = await exportDatabase()
      if (isTauri()) {
        const path = await save({
          defaultPath: `Techspire-Backup-${today()}.sqlite`,
          filters: [{ name: 'SQLite database', extensions: ['sqlite', 'db'] }],
        })
        if (path) {
          await writeFile(path, bytes)
          setNotice('Database backup created.')
        }
      } else {
        const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
        const url = URL.createObjectURL(new Blob([arrayBuffer], { type: 'application/vnd.sqlite3' }))
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = `Techspire-Backup-${today()}.sqlite`
        anchor.click()
        URL.revokeObjectURL(url)
        setNotice('Database backup downloaded.')
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create database backup.')
    }
  }

  async function importBackup() {
    setError('')
    try {
      let bytes: Uint8Array
      if (isTauri()) {
        const path = await open({ multiple: false, filters: [{ name: 'SQLite database', extensions: ['sqlite', 'db'] }] })
        if (!path || Array.isArray(path)) return
        bytes = await readFile(path)
      } else {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.sqlite,.db'
        input.click()
        const file = await new Promise<File | null>((resolve) => {
          input.onchange = () => resolve(input.files?.[0] ?? null)
          input.oncancel = () => resolve(null)
        })
        if (!file) return
        bytes = new Uint8Array(await file.arrayBuffer())
      }
      await restoreDatabase(bytes)
      setData(await loadAppData())
      setNotice('Database restored.')
    } catch (cause) {
      setError(cause instanceof Error ? `Restore failed: ${cause.message}` : 'Restore failed.')
    }
  }

  async function exportCatalogueCsv() {
    if (!data) return
    const quoteCsv = (value: string) => `"${value.replaceAll('"', '""')}"`
    const lines = [
      ['Name', 'Description', 'SKU', 'Category', 'Unit', 'Price ex VAT (ZAR)', 'VAT applicable'].join(','),
      ...data.catalogue.map((item) =>
        [
          item.name,
          item.description,
          item.sku,
          item.category,
          item.unit,
          (item.priceCents / 100).toFixed(2),
          item.vatApplicable ? 'Yes' : 'No',
        ]
          .map(quoteCsv)
          .join(','),
      ),
    ]
    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'Techspire-Catalogue.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  async function importCatalogueCsv(file: File) {
    if (!data) return
    setError('')
    try {
      const rows = parseCsv(await file.text())
      const headers = rows[0]?.map((value) => value.trim().toLowerCase()) ?? []
      const requiredHeaders = ['name', 'description', 'sku', 'category', 'unit', 'price ex vat (zar)', 'vat applicable']
      if (requiredHeaders.some((header) => !headers.includes(header))) {
        throw new Error('CSV headers must match the exported catalogue format.')
      }
      const parsed = rows.slice(1).map((columns, rowIndex) => {
        const get = (header: string) => columns[headers.indexOf(header)]?.trim() ?? ''
        const priceText = get('price ex vat (zar)')
        const price = Number(priceText)
        if (!get('name') || !priceText || !Number.isFinite(price) || price < 0) {
          throw new Error(`CSV row ${rowIndex + 2} needs an item name and a valid non-negative price.`)
        }
        const vat = get('vat applicable').toLowerCase()
        if (vat && !['yes', 'no'].includes(vat)) {
          throw new Error(`CSV row ${rowIndex + 2} VAT applicability must be Yes or No.`)
        }
        return {
          ...blankCatalogueItem(),
          name: get('name'),
          description: get('description'),
          sku: get('sku'),
          category: get('category') || 'General',
          unit: get('unit') || 'each',
          priceCents: centsFromInput(price),
          vatApplicable: vat !== 'no',
        }
      })
      await saveCatalogueItems(parsed)
      setData({ ...data, catalogue: [...parsed, ...data.catalogue] })
      setNotice(`${parsed.length} catalogue item${parsed.length === 1 ? '' : 's'} imported.`)
    } catch (cause) {
      setError(cause instanceof Error ? `CSV import failed: ${cause.message}` : 'CSV import failed.')
    }
  }

  async function updateQuoteStatus(item: Quote, status: QuoteStatus) {
    if (!data) return
    if (item.exportedFilename && ['Draft', 'Finalised'].includes(status) && item.status !== status) {
      setError('Exported quotations cannot be reverted to a draft. Create a new revision instead.')
      return
    }
    if (status === 'Finalised' && !item.exportedFilename) {
      setError('Export the quotation PDF before marking it finalised.')
      return
    }
    if (
      ['Sent', 'Accepted', 'Rejected', 'Expired'].includes(status) &&
      item.status === 'Draft' &&
      !item.exportedFilename
    ) {
      setError('Export the quotation PDF before changing a draft to a post-export status.')
      return
    }
    const updated = { ...item, status }
    await persist(
      () => saveQuote(updated),
      `Quotation marked ${status.toLowerCase()}`,
      () =>
        setData({
          ...data,
          quotations: data.quotations.map((quoteItem) => (quoteItem.id === item.id ? updated : quoteItem)),
        }),
    )
  }

  if (loadError) {
    return (
      <div className="fatal-error">
        <ShieldCheck size={30} />
        <h1>Database unavailable</h1>
        <p>{loadError}</p>
        <button className="button button-primary" onClick={() => window.location.reload()}>Retry</button>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="app-loading">
        <div className="brand-mark">ts</div>
        <strong>TECHSPIRE IT</strong>
        <span>Opening your local quotation workspace…</span>
      </div>
    )
  }

  const filteredCatalogue = data.catalogue.filter((item) => {
    const matchesSearch = `${item.name} ${item.description} ${item.sku} ${item.category}`.toLowerCase().includes(search.toLowerCase())
    return matchesSearch && item.active && (catalogueFilter === 'All categories' || item.category === catalogueFilter)
  })
  const categories = ['All categories', ...new Set(data.catalogue.map((item) => item.category).filter(Boolean))]
  const filteredClients = data.clients.filter((client) =>
    `${client.name} ${client.contact} ${client.email}`.toLowerCase().includes(search.toLowerCase()),
  )
  const filteredQuotes = data.quotations.filter((item) => {
    const matchesText = `${item.number} ${item.clientSnapshot.name} ${item.title}`.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = historyFilter === 'All statuses' || item.status === historyFilter
    return matchesText && matchesStatus
  })

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand-lockup" onClick={() => setSection('dashboard')} aria-label="Techspire IT dashboard">
          <span className="brand-mark">ts</span>
          <span className="brand-copy"><strong>TECHSPIRE IT</strong><small>QUOTATION BUILDER</small></span>
        </button>
        <div className="workspace-pill"><span className="workspace-dot" /> Local workspace <ChevronDown size={14} /></div>
        <nav className="nav-list" aria-label="Main navigation">
          {(['main', 'manage', 'system'] as const).map((group) => (
            <div className="nav-group" key={group}>
              <span className="nav-label">{group === 'main' ? 'WORKSPACE' : group === 'manage' ? 'MANAGE' : 'PREFERENCES'}</span>
              {navigation.filter((item) => item.group === group).map(({ label, section: target, icon: Icon }) => (
                <button
                  className={`nav-item ${section === target ? 'active' : ''}`}
                  key={target}
                  onClick={() => {
                    if (target === 'builder') startNewQuote()
                    else setSection(target)
                  }}
                >
                  <Icon size={17} strokeWidth={1.8} /><span>{label}</span>
                  {target === 'history' && data.quotations.length > 0 && <span className="nav-count">{data.quotations.length}</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="offline-indicator"><span className="workspace-dot" /><span><b>Offline ready</b><small>Your data stays on this device</small></span></div>
          <button className="help-link" onClick={() => setNotice('Your local SQLite database is stored on this device.')}><LifeBuoy size={16} /> Help & support <CircleHelp size={15} /></button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14} /><b>{pageTitle}</b></div>
          <div className="topbar-right">
            <span className="topbar-date">{displayDate}</span>
            <button className="icon-button" aria-label="Notifications" onClick={() => setNotice('You’re all caught up.')}><Bell size={18} /></button>
            <div className="avatar">{(data.settings.preparedBy || data.settings.name).slice(0, 1).toUpperCase()}</div>
          </div>
        </header>

        <div className="page-content">
          {error && <div className="alert alert-error"><ShieldCheck size={17} /><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError('')}><X size={15} /></button></div>}
          {notice && <div className="alert alert-success"><Check size={17} /><span>{notice}</span><button aria-label="Dismiss message" onClick={() => setNotice('')}><X size={15} /></button></div>}

          {section === 'dashboard' && (
            <Dashboard
              data={data}
              onNew={startNewQuote}
              onOpenQuote={openQuote}
              onNavigate={setSection}
              onManageProducts={() => setSection('catalogue')}
            />
          )}

          {section === 'builder' && quote && (
            <Builder
              data={data}
              quote={quote}
              existingQuote={activeQuote}
              generatedPdf={generatedPdf?.quote.id === quote.id ? generatedPdf : null}
              onViewGeneratedPdf={() => setPdfViewerOpen(true)}
              busy={busy}
              onUpdate={updateQuote}
              onSelectClient={selectClient}
              onAddItem={addItemToQuote}
              onSaveDraft={saveDraft}
              onGeneratePdf={generatePdf}
              onAddClient={() => {
                setEditingClient(null)
                setModal('client')
              }}
              onEditClient={(client) => {
                setEditingClient(client)
                setModal('client')
              }}
              onAddItemForm={() => {
                setEditingItem(null)
                setModal('item')
              }}
              onApplyPackage={applySelectedPackage}
            />
          )}

          {section === 'catalogue' && (
            <CataloguePage
              items={filteredCatalogue}
              categories={categories}
              filter={catalogueFilter}
              search={search}
              onSearch={setSearch}
              onFilter={setCatalogueFilter}
              onAdd={() => {
                setEditingItem(null)
                setModal('item')
              }}
              onEdit={(item) => {
                setEditingItem(item)
                setModal('item')
              }}
              onExport={exportCatalogueCsv}
              onImport={importCatalogueCsv}
            />
          )}

          {section === 'clients' && (
            <ClientsPage
              clients={filteredClients}
              search={search}
              onSearch={setSearch}
              onAdd={() => {
                setEditingClient(null)
                setModal('client')
              }}
              onEdit={(client) => {
                setEditingClient(client)
                setModal('client')
              }}
              onArchive={async (client) => {
                if (!window.confirm(`Archive ${client.name}? Existing quotations will remain unchanged.`)) return
                const archived = { ...client, archived: true }
                try {
                  await persist(() => saveClient(archived), 'Client archived', () =>
                    setData({ ...data, clients: data.clients.map((item) => item.id === client.id ? archived : item) }),
                  )
                } catch { return }
              }}
            />
          )}

          {section === 'history' && (
            <HistoryPage
              quotes={filteredQuotes}
              search={search}
              status={historyFilter}
              onSearch={setSearch}
              onStatus={setHistoryFilter}
              onOpen={openQuote}
              onStatusChange={updateQuoteStatus}
              onDuplicate={(item) => {
                setQuote({
                  ...structuredClone(item),
                  id: createId(),
                  number: quoteNumber(data, quote),
                  status: 'Draft',
                  issueDate: today(),
                  validUntil: dateAfter(today(), data.settings.validityDays),
                  createdAt: new Date().toISOString(),
                  exportedFilename: '',
                })
                setActiveQuoteId(null)
                setSection('builder')
              }}
            />
          )}

          {section === 'packages' && (
            <PackagesPage
              packages={data.packages}
              catalogue={data.catalogue}
              onAdd={() => setModal('package')}
              onAddToQuote={(item) => quote ? addPackageToQuote(item) : startQuoteWithPackage(item)}
            />
          )}

          {section === 'templates' && (
            <QuoteTemplatesPage
              templates={data.quoteTemplates}
              quotations={data.quotations}
              onAdd={() => setModal('quote-template')}
              onUse={startQuoteFromTemplate}
              onDelete={(item) => void removeQuoteTemplate(item)}
            />
          )}

          {section === 'settings' && <SettingsPage settings={data.settings} onSave={saveSettingsForm} />}
          {section === 'backup' && <BackupPage onExport={exportBackup} onImport={importBackup} />}
        </div>
      </main>

      {modal && (
        <Modal
          title={
            modal === 'client'
              ? editingClient ? 'Edit client' : 'Add a client'
              : modal === 'item'
                ? editingItem ? 'Edit catalogue item' : 'Add a catalogue item'
                : modal === 'package' ? 'Create a package' : 'Create a reusable quotation template'
          }
          onClose={() => {
            setModal(null)
            setEditingClient(null)
            setEditingItem(null)
          }}
        >
          {modal === 'client' && (
            <ClientForm client={editingClient} onSubmit={saveClientForm} />
          )}
          {modal === 'item' && (
            <CatalogueForm item={editingItem} allowTransient={section === 'builder' && !editingItem} onSubmit={saveItemForm} />
          )}
          {modal === 'package' && (
            <PackageForm catalogue={data.catalogue} onSubmit={savePackageForm} />
          )}
          {modal === 'quote-template' && (
            <QuoteTemplateForm quotations={data.quotations} onSubmit={saveQuoteTemplateForm} />
          )}
        </Modal>
      )}
      {generatedPdf && pdfViewerOpen && data && (
        <div className="pdf-viewer-backdrop">
          <section className="pdf-viewer" role="dialog" aria-modal="true" aria-labelledby="generated-pdf-heading">
            <header className="pdf-viewer-header">
              <div><span className="eyebrow">QUOTATION READY</span><h2 id="generated-pdf-heading">{generatedPdf.filename}</h2><p>Saved automatically in your Downloads folder.</p></div>
              <div className="pdf-viewer-actions">
                <button className="button button-primary" onClick={() => {
                  const frame = document.getElementById('generated-pdf-frame') as HTMLIFrameElement | null
                  frame?.contentWindow?.focus()
                  frame?.contentWindow?.print()
                }}><FileText size={16} /> Print PDF</button>
                <button className="icon-button" aria-label="Close PDF preview" onClick={() => setPdfViewerOpen(false)}><X size={19} /></button>
              </div>
            </header>
            <PdfPreview quote={generatedPdf.quote} settings={data.settings} large />
            <iframe id="generated-pdf-frame" className="pdf-print-frame" title={`Print source for ${generatedPdf.filename}`} src={generatedPdf.url} />
          </section>
        </div>
      )}
    </div>
  )
}

function Dashboard({
  data,
  onNew,
  onOpenQuote,
  onNavigate,
  onManageProducts,
}: {
  data: AppData
  onNew: () => void
  onOpenQuote: (quote: Quote) => void
  onNavigate: (section: Section) => void
  onManageProducts: () => void
}) {
  const statuses: QuoteStatus[] = ['Draft', 'Finalised', 'Sent', 'Accepted', 'Rejected', 'Expired']
  const counts = statuses.map((status) => data.quotations.filter((quote) => quote.status === status).length)
  const month = today().slice(0, 7)
  const thisMonth = data.quotations.filter((quote) => quote.createdAt.slice(0, 7) === month).length
  const total = data.quotations.reduce((sum, quote) => sum + quote.totalCents, 0)
  const cards = [
    { label: 'Total quotations', value: String(data.quotations.length), icon: FileText, tint: 'red' },
    { label: 'Drafts in progress', value: String(counts[0]), icon: ClipboardList, tint: 'amber' },
    { label: 'Accepted', value: String(counts[3]), icon: BadgeCheck, tint: 'green' },
    { label: 'Created this month', value: String(thisMonth), icon: BarChart3, tint: 'blue' },
  ]
  return (
    <>
      <div className="page-heading heading-split">
        <div><div className="eyebrow">OVERVIEW</div><h1>Good day{data.settings.preparedBy ? `, ${data.settings.preparedBy.split(' ')[0]}` : ''}.</h1><p>Here’s what’s happening with your quotations.</p></div>
        <button className="button button-primary" onClick={onNew}><Plus size={17} /> New quotation</button>
      </div>
      <div className="stat-grid">
        {cards.map(({ label, value, icon: Icon, tint }) => <div className="stat-card" key={label}>
          <div className={`stat-icon ${tint}`}><Icon size={18} /></div><div><span>{label}</span><strong>{value}</strong></div>
        </div>)}
      </div>
      <section className="dashboard-row">
        <div className="panel recent-panel">
          <div className="panel-heading"><div><h2>Recent quotations</h2><p>Your latest activity at a glance.</p></div><button className="text-button" onClick={() => onNavigate('history')}>View all <ArrowRight size={14} /></button></div>
          {data.quotations.length ? <div className="table-wrap">
            <table><thead><tr><th>QUOTE</th><th>CLIENT</th><th>STATUS</th><th className="align-right">TOTAL INCL. VAT</th></tr></thead>
              <tbody>{data.quotations.slice(0, 5).map((quote) => <tr key={quote.id} onClick={() => onOpenQuote(quote)}>
                <td><b>{quote.number}</b><small>{quote.title}</small></td><td>{quote.clientSnapshot.name || 'No client'}</td><td><span className={statusTone(quote.status)}>{quote.status}</span></td><td className="align-right amount">{money(quote.totalCents)}</td>
              </tr>)}</tbody>
            </table>
          </div> : <EmptyState title="Your first quotation starts here" text="Add a client and choose your products to create a polished PDF." action="Create quotation" onAction={onNew} />}
        </div>
        <div className="panel quick-panel">
          <div className="panel-heading"><div><h2>Quick actions</h2><p>Keep the work moving.</p></div><Sparkles size={17} className="muted-icon" /></div>
          <button className="quick-action" onClick={onNew}><span className="quick-icon red"><FilePlus2 size={17} /></span><span><b>Create a quotation</b><small>Build and export a PDF</small></span><ChevronRight size={16} /></button>
          <button className="quick-action" onClick={onManageProducts}><span className="quick-icon dark"><ShoppingBag size={17} /></span><span><b>Manage catalogue</b><small>Products and services</small></span><ChevronRight size={16} /></button>
          <button className="quick-action" onClick={() => onNavigate('clients')}><span className="quick-icon blue"><Users size={17} /></span><span><b>Manage clients</b><small>Keep customer details ready</small></span><ChevronRight size={16} /></button>
          <div className="total-value"><span>QUOTATION VALUE</span><strong>{money(total)}</strong><small>Across {data.quotations.length} saved quotation{data.quotations.length === 1 ? '' : 's'}</small></div>
        </div>
      </section>
      <div className="dashboard-bottom">
        <div className="tip-card"><div className="tip-icon"><ShieldCheck size={20} /></div><div><b>Your workspace is stored locally</b><p>Your clients, catalogue and quotations remain on this device. Create a backup regularly from Backup & Restore.</p></div><button onClick={() => onNavigate('backup')}>Open backups <ArrowRight size={14} /></button></div>
      </div>
    </>
  )
}

function Builder({
  data,
  quote,
  existingQuote,
  generatedPdf,
  onViewGeneratedPdf,
  busy,
  onUpdate,
  onSelectClient,
  onAddItem,
  onSaveDraft,
  onGeneratePdf,
  onAddClient,
  onEditClient,
  onAddItemForm,
  onApplyPackage,
}: {
  data: AppData
  quote: Quote
  existingQuote: Quote | null
  generatedPdf: { filename: string } | null
  onViewGeneratedPdf: () => void
  busy: boolean
  onUpdate: (patch: Partial<Quote>) => void
  onSelectClient: (id: string) => void
  onAddItem: (item: CatalogueItem) => void
  onSaveDraft: () => Promise<void>
  onGeneratePdf: () => void
  onAddClient: () => void
  onEditClient: (client: Client) => void
  onAddItemForm: () => void
  onApplyPackage: (id: string) => void
}) {
  const [itemSearch, setItemSearch] = useState('')
  const totals = calculateTotals(quote.lines, quote.discountType, quote.discountValue, data.settings.vatRate)
  const client = data.clients.find((item) => item.id === quote.clientId)
  const availableItems = data.catalogue.filter((item) =>
    item.active && `${item.name} ${item.sku} ${item.category}`.toLowerCase().includes(itemSearch.toLowerCase()),
  )
  const packageGroups = new Map<string, { id: string; name: string; lines: QuoteLine[] }>()
  quote.lines.forEach((line) => {
    if (!line.packageInstanceId) return
    const group = packageGroups.get(line.packageInstanceId) ?? {
      id: line.packageId ?? '',
      name: line.packageName ?? 'Quotation package',
      lines: [],
    }
    group.lines.push(line)
    packageGroups.set(line.packageInstanceId, group)
  })
  const individualLines = quote.lines.filter((line) => !line.packageInstanceId)
  const packagePrice = (item: QuotePackage) => item.items.reduce((sum, entry) => {
    const catalogueItem = data.catalogue.find((source) => source.id === entry.itemId)
    return sum + (catalogueItem ? catalogueItem.priceCents * entry.quantity : 0)
  }, 0)
  function changeLine(id: string, patch: Partial<QuoteLine>) {
    onUpdate({ lines: quote.lines.map((line) => line.id === id ? { ...line, ...patch } : line) })
  }
  function removePackage(instanceId: string) {
    onUpdate({ lines: quote.lines.filter((line) => line.packageInstanceId !== instanceId) })
  }
  return (
    <>
      <div className="page-heading heading-split">
        <div><div className="eyebrow">QUOTE BUILDER · {quote.number}</div><h1>{existingQuote ? 'Edit quotation' : 'New quotation'}</h1><p>Select a client, add packages to your quotation, and review the total before export.</p></div>
        <div className="heading-actions"><button className="button button-secondary" onClick={() => void onSaveDraft()}><Check size={16} /> Save draft</button><button className="button button-primary" onClick={onGeneratePdf} disabled={busy}><FileText size={16} /> {busy ? 'Generating…' : 'Generate PDF'}</button></div>
      </div>
      <div className="builder-layout">
        <div className="builder-main">
          <section className="panel builder-section">
            <div className="section-title"><span className="step-number">01</span><div><h2>Client & quotation details</h2><p>Choose who this proposal is prepared for.</p></div></div>
            <div className="form-grid form-grid-three">
              <label className="field span-two"><span>Client <i>*</i></span><div className="select-with-action"><select id="quote-client" value={quote.clientId} onChange={(event) => onSelectClient(event.target.value)}><option value="">Select a client…</option>{data.clients.filter((item) => !item.archived).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select><button className="mini-add" onClick={onAddClient} title="Add client"><Plus size={16} /></button></div></label>
              <label className="field"><span>Quotation title</span><input value={quote.title} onChange={(event) => onUpdate({ title: event.target.value })} /></label>
              <label className="field"><span>Issue date</span><input type="date" value={quote.issueDate} onChange={(event) => onUpdate({ issueDate: event.target.value })} /></label>
              <label className="field"><span>Valid until</span><input type="date" value={quote.validUntil} onChange={(event) => onUpdate({ validUntil: event.target.value })} /></label>
              <div className="client-summary span-three">{client ? <><div className="client-avatar">{client.name.slice(0, 1).toUpperCase()}</div><div><b>{quote.clientSnapshot.name}</b><small>{[quote.clientSnapshot.contact, quote.clientSnapshot.email, quote.clientSnapshot.phone].filter(Boolean).join(' · ') || 'Client contact details can be edited in Clients.'}</small></div><button className="text-button" onClick={() => onEditClient(client)}>Edit details</button></> : <><Users size={17} /><span>{data.clients.some((item) => !item.archived) ? 'Select a saved client to automatically populate the quotation.' : 'Add your first client to enable saving and PDF export.'}</span><button className="text-button" onClick={onAddClient}>{data.clients.some((item) => !item.archived) ? 'Add client' : 'Create first client'} <Plus size={14} /></button></>}</div>
            </div>
          </section>

          <section className="panel builder-section">
            <div className="section-title"><span className="step-number">02</span><div><h2>Add items</h2><p>Add products or services from your catalogue, or create a custom item.</p></div></div>
            <div className="builder-tools">
              <label className="search-field item-search"><Search size={16} /><input placeholder="Search catalogue…" value={itemSearch} onChange={(event) => setItemSearch(event.target.value)} /></label>
              <button className="button button-secondary button-compact" onClick={onAddItemForm}><Plus size={15} /> Custom item</button>
            </div>
            <div className="catalogue-suggestions">
              {availableItems.slice(0, 5).map((item) => <button className="suggestion" key={item.id} onClick={() => onAddItem(item)}><span className="suggestion-plus"><Plus size={14} /></span><span className="suggestion-copy"><b>{item.name}</b><small>{item.sku || item.category || item.unit}</small></span><strong>{money(item.priceCents)}</strong></button>)}
              {!availableItems.length && <div className="suggestion-empty">No active catalogue items match this search. Add items in Catalogue.</div>}
            </div>
          </section>

          <section className="panel builder-section">
            <div className="section-title"><span className="step-number">03</span><div><h2>Packages</h2><p>Choose from packages created in the Packages section. Package contents are included in the quotation total.</p></div><span className="line-count">{packageGroups.size} selected</span></div>
            {data.packages.length ? <div className="builder-package-grid">{data.packages.map((item) => {
              const selectedCount = [...packageGroups.values()].filter((group) => group.id === item.id).length
              return <article className="builder-package-card" key={item.id}>
                <div className="builder-package-heading"><span className="builder-package-icon"><PackageOpen size={17} /></span><span className="builder-package-price">{money(packagePrice(item))}</span></div>
                <h3>{item.name}</h3>
                <p>{item.description || 'Reusable product and service package.'}</p>
                <div className="package-items">{item.items.map((entry) => <span key={entry.itemId}>{data.catalogue.find((source) => source.id === entry.itemId)?.name ?? 'Unavailable item'} × {entry.quantity}</span>)}</div>
                <button className="button button-secondary full-button" onClick={() => onApplyPackage(item.id)}><Plus size={15} /> Add package{selectedCount ? ` (${selectedCount} added)` : ''}</button>
              </article>
            })}</div> : <div className="empty-lines"><div className="empty-icon"><PackageOpen size={21} /></div><b>No packages created yet</b><span>Create your packages in the Packages section. They will appear here to add to your quotation.</span></div>}
            {[...packageGroups.entries()].length > 0 && <div className="selected-package-list"><h3>Selected packages</h3>{[...packageGroups.entries()].map(([instanceId, group]) => {
              const total = group.lines.reduce((sum, line) => sum + Math.round(line.quantity * line.unitPriceCents), 0)
              return <article className="selected-package" key={instanceId}>
                <div className="selected-package-heading"><div><PackageOpen size={16} /><b>{group.name}</b></div><strong>{money(total)}</strong><button className="row-remove" aria-label={`Remove package ${group.name}`} onClick={() => removePackage(instanceId)}><X size={15} /></button></div>
                <div className="selected-package-lines">{group.lines.map((line) => <div className="selected-package-line" key={line.id}>
                  <span>{line.name}</span>
                  <label><small>{line.unit === 'hour' ? 'Hours' : 'Qty'}</small><input type="number" min="0.01" step="any" aria-label={`${line.unit === 'hour' ? 'Hours' : 'Quantity'} for ${line.name}`} value={line.quantity} onChange={(event) => changeLine(line.id, { quantity: Math.max(0, Number(event.target.value) || 0) })} /></label>
                  <strong>{money(Math.round(line.quantity * line.unitPriceCents))}</strong>
                </div>)}</div>
              </article>
            })}</div>}
            {individualLines.length > 0 && <div className="selected-package-list"><h3>Additional items</h3><div className="additional-item-list">{individualLines.map((line) => <div className="additional-item" key={line.id}>
              <div><b>{line.name}</b><small>{line.description || line.unit || 'Individual item'}</small></div>
              <label><small>{line.unit === 'hour' ? 'Hours' : 'Qty'}</small><input type="number" min="0.01" step="any" aria-label={`${line.unit === 'hour' ? 'Hours' : 'Quantity'} for ${line.name}`} value={line.quantity} onChange={(event) => changeLine(line.id, { quantity: Math.max(0, Number(event.target.value) || 0) })} /></label>
              <strong>{money(Math.round(line.quantity * line.unitPriceCents))}</strong>
              <button className="row-remove" aria-label={`Remove ${line.name}`} onClick={() => onUpdate({ lines: quote.lines.filter((item) => item.id !== line.id) })}><X size={15} /></button>
            </div>)}</div></div>}
          </section>

          <section className="panel builder-section">
            <div className="section-title"><span className="step-number">04</span><div><h2>Notes & terms</h2><p>Add any relevant details for this proposal.</p></div></div>
            <label className="field"><span>Project notes / scope of work</span><textarea rows={3} placeholder="Optional project notes. Leave blank to hide this section in the PDF." value={quote.notes} onChange={(event) => onUpdate({ notes: event.target.value })} /></label>
            <label className="field terms-field"><span>Quotation terms <small>Default ordering terms are included and saved with this quotation.</small></span><textarea rows={3} placeholder="Default ordering terms are applied automatically." value={quote.terms.map((term) => term.replace('|', ' — ')).join('\n')} onChange={(event) => onUpdate({ terms: event.target.value.split('\n').filter(Boolean) })} /></label>
          </section>
        </div>

        <aside className="builder-side">
          <div className="preview-card">
            <div className="preview-heading"><div><span className="eyebrow">LIVE SUMMARY</span><h3>Quotation total</h3></div><Calculator size={19} /></div>
            <div className="preview-meta"><span>Quote number</span><b>{quote.number}</b></div>
            <div className="preview-meta"><span>Client</span><b>{quote.clientSnapshot.name || 'Not selected'}</b></div>
            <div className="preview-meta"><span>Line items</span><b>{quote.lines.length}</b></div>
            <div className="preview-divider" />
            <div className="preview-meta"><span>Subtotal ex. VAT</span><b>{money(totals.subtotalCents)}</b></div>
            <div className="discount-control"><label htmlFor="discount-type">Discount</label><select id="discount-type" value={quote.discountType} onChange={(event) => onUpdate({ discountType: event.target.value as Quote['discountType'] })}><option value="none">None</option><option value="fixed">Fixed amount</option><option value="percentage">Percentage</option></select>{quote.discountType !== 'none' && <input aria-label="Discount value" type="number" min="0" step="0.01" value={quote.discountValue} onChange={(event) => onUpdate({ discountValue: Math.max(0, Number(event.target.value) || 0) })} />}</div>
            <div className="preview-meta"><span>Discount</span><b>-{money(totals.discountCents)}</b></div>
            <div className="preview-meta"><span>VAT ({data.settings.vatRate}%)</span><b>{money(totals.vatCents)}</b></div>
            <div className="grand-total"><span>Total incl. VAT</span><strong>{money(totals.totalCents)}</strong></div>
            <p className="tax-note">Tax is applied only to taxable items. Final totals are calculated from the line-item VAT settings.</p>
            <button className="button button-primary full-button" disabled={busy} onClick={() => void onSaveDraft()}><Check size={16} /> Save draft</button>
            <button className="button button-dark full-button" disabled={busy} onClick={onGeneratePdf}><FileText size={16} /> {busy ? 'Generating PDF…' : 'Generate PDF'}</button>
            {generatedPdf && <button className="button button-secondary full-button" onClick={onViewGeneratedPdf}><FileText size={16} /> View generated PDF</button>}
            <p className="auto-save-note">Valid drafts save automatically as you edit.</p>
          </div>
          <PdfPreview quote={quote} settings={data.settings} />
          <div className="side-note"><ShieldCheck size={17} /><span>Generating a PDF finalises a snapshot of the current pricing, client details and terms.</span></div>
        </aside>
      </div>
    </>
  )
}

function PdfPreview({ quote, settings, large = false }: { quote: Quote; settings: CompanySettings; large?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [pageCount, setPageCount] = useState(0)
  const [zoom, setZoom] = useState(0.82)
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [previewError, setPreviewError] = useState('')

  useEffect(() => {
    let cancelled = false
    let loadingTask: import('pdfjs-dist').PDFDocumentLoadingTask | undefined
    let renderTask: import('pdfjs-dist').RenderTask | undefined
    const timeout = window.setTimeout(async () => {
      try {
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
        const { createQuotationPdf } = await import('./quotationPdf')
        const document = createQuotationPdf(quote, settings)
        const bytes = new Uint8Array(document.output('arraybuffer'))
        loadingTask = pdfjs.getDocument({ data: bytes })
        const pdf = await loadingTask.promise
        if (cancelled) {
          return
        }
        setPageCount(pdf.numPages)
        const safePage = Math.min(pageNumber, pdf.numPages)
        if (safePage !== pageNumber) setPageNumber(safePage)
        const page = await pdf.getPage(safePage)
        const viewport = page.getViewport({ scale: zoom })
        const canvas = canvasRef.current
        const context = canvas?.getContext('2d')
        if (!canvas || !context) throw new Error('The PDF preview canvas is unavailable.')
        canvas.width = Math.ceil(viewport.width)
        canvas.height = Math.ceil(viewport.height)
        renderTask = page.render({ canvas, canvasContext: context, viewport })
        await renderTask.promise
        if (!cancelled) setPreviewError('')
      } catch (cause) {
        if (!cancelled) {
          setPreviewError(cause instanceof Error ? cause.message : 'The PDF preview could not be rendered.')
        }
      }
    }, 450)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
      renderTask?.cancel()
      void loadingTask?.destroy()
    }
  }, [pageNumber, quote, refreshVersion, settings, zoom])

  return (
    <div className={`pdf-preview${large ? ' pdf-preview-large' : ''}`}>
      <div className="pdf-preview-heading">
        <span><FileText size={14} /> Live PDF preview</span>
        <div className="pdf-preview-controls">
          <button className="table-action" aria-label="Previous PDF page" disabled={pageNumber <= 1} onClick={() => setPageNumber((page) => Math.max(1, page - 1))}><ArrowLeft size={12} /></button>
          <small>{pageCount ? `${pageNumber} / ${pageCount}` : '—'}</small>
          <button className="table-action" aria-label="Next PDF page" disabled={!pageCount || pageNumber >= pageCount} onClick={() => setPageNumber((page) => Math.min(pageCount, page + 1))}><ArrowRight size={12} /></button>
          <button className="table-action" aria-label="Zoom out" disabled={zoom <= 0.55} onClick={() => setZoom((value) => Math.max(0.55, value - 0.1))}>−</button>
          <button className="table-action" aria-label="Zoom in" disabled={zoom >= 1.2} onClick={() => setZoom((value) => Math.min(1.2, value + 0.1))}>+</button>
          <button className="table-action" aria-label="Refresh PDF preview" onClick={() => setRefreshVersion((version) => version + 1)}><RotateCcw size={12} /></button>
        </div>
      </div>
      <div className="pdf-preview-canvas">
        <canvas ref={canvasRef} aria-label={`Quotation page ${pageNumber} preview`} />
        {previewError && <p role="status">{previewError}</p>}
      </div>
    </div>
  )
}

function CataloguePage({
  items,
  categories,
  filter,
  search,
  onSearch,
  onFilter,
  onAdd,
  onEdit,
  onExport,
  onImport,
}: {
  items: CatalogueItem[]
  categories: string[]
  filter: string
  search: string
  onSearch: (value: string) => void
  onFilter: (value: string) => void
  onAdd: () => void
  onEdit: (item: CatalogueItem) => void
  onExport: () => void
  onImport: (file: File) => void
}) {
  const filterSelectRef = useRef<HTMLSelectElement>(null)
  return (
    <>
      <div className="page-heading heading-split"><div><div className="eyebrow">PRODUCTS & SERVICES</div><h1>Catalogue</h1><p>Manage the items available in your quotations.</p></div><button className="button button-primary" onClick={onAdd}><Plus size={17} /> Add item</button></div>
      <div className="panel data-panel">
        <div className="data-toolbar"><label className="search-field"><Search size={16} /><input placeholder="Search name, SKU or category…" value={search} onChange={(event) => onSearch(event.target.value)} /></label><div className="filter-field"><ListFilter size={15} /><select ref={filterSelectRef} aria-label="Filter by category" value={filter} onChange={(event) => onFilter(event.target.value)}>{categories.map((category) => <option key={category}>{category}</option>)}</select><button type="button" className="filter-arrow" aria-label="Open category filter" onClick={() => filterSelectRef.current?.showPicker()}><ChevronDown size={14} /></button></div><div className="toolbar-spacer" /><label className="button button-secondary button-compact file-label"><Upload size={15} /> Import CSV<input type="file" accept=".csv,text/csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) onImport(file); event.currentTarget.value = '' }} /></label><button className="button button-secondary button-compact" onClick={onExport}><ArrowDownToLine size={15} /> Export</button></div>
        <div className="table-wrap"><table><thead><tr><th>ITEM</th><th>SKU</th><th>CATEGORY</th><th>UNIT</th><th>VAT</th><th className="align-right">PRICE EX. VAT</th><th /></tr></thead><tbody>
          {items.map((item) => <tr key={item.id}><td><b>{item.name}</b><small className="description-cell">{item.description || 'No description'}</small></td><td>{item.sku || '—'}</td><td>{item.category}</td><td>{item.unit}</td><td><span className={item.vatApplicable ? 'vat-yes' : 'vat-no'}>{item.vatApplicable ? '15% VAT' : 'Exempt'}</span></td><td className="align-right amount">{money(item.priceCents)}</td><td><button className="table-action" onClick={() => onEdit(item)}>Edit</button></td></tr>)}
        </tbody></table>
        {!items.length && <EmptyState title="No catalogue items found" text="Add your first product or service, or import items from a CSV file." action="Add catalogue item" onAction={onAdd} />}
        </div><div className="table-footer"><span>{items.length} active catalogue item{items.length === 1 ? '' : 's'}</span><span>Prices shown excluding VAT</span></div>
      </div>
    </>
  )
}

function ClientsPage({
  clients,
  search,
  onSearch,
  onAdd,
  onEdit,
  onArchive,
}: {
  clients: Client[]
  search: string
  onSearch: (value: string) => void
  onAdd: () => void
  onEdit: (client: Client) => void
  onArchive: (client: Client) => void
}) {
  return (
    <>
      <div className="page-heading heading-split"><div><div className="eyebrow">CUSTOMER DIRECTORY</div><h1>Clients</h1><p>Save customer details once and reuse them in every quotation.</p></div><button className="button button-primary" onClick={onAdd}><Plus size={17} /> Add client</button></div>
      <div className="panel data-panel"><div className="data-toolbar"><label className="search-field"><Search size={16} /><input placeholder="Search company, contact or email…" value={search} onChange={(event) => onSearch(event.target.value)} /></label><div className="toolbar-spacer" /><span className="toolbar-count"><Users size={15} /> {clients.filter((client) => !client.archived).length} active clients</span></div>
        <div className="table-wrap"><table><thead><tr><th>COMPANY</th><th>CONTACT</th><th>EMAIL</th><th>PHONE</th><th>VAT NUMBER</th><th /></tr></thead><tbody>{clients.filter((client) => !client.archived).map((client) => <tr key={client.id}><td><b>{client.name}</b><small>{[client.city, client.province].filter(Boolean).join(', ') || 'Location not set'}</small></td><td>{client.contact || '—'}</td><td>{client.email || '—'}</td><td>{client.phone || '—'}</td><td>{client.vatNumber || '—'}</td><td><div className="row-actions"><button className="table-action" onClick={() => onEdit(client)}>Edit</button><button className="table-action danger-link" onClick={() => onArchive(client)}>Archive</button></div></td></tr>)}</tbody></table>{!clients.some((client) => !client.archived) && <EmptyState title="No clients added yet" text="Create a client profile to automatically fill in quotation details." action="Add client" onAction={onAdd} />}</div>
        <div className="table-footer"><span>Client details are stored locally on this device.</span></div>
      </div>
    </>
  )
}

function HistoryPage({
  quotes,
  search,
  status,
  onSearch,
  onStatus,
  onOpen,
  onStatusChange,
  onDuplicate,
}: {
  quotes: Quote[]
  search: string
  status: string
  onSearch: (value: string) => void
  onStatus: (value: string) => void
  onOpen: (quote: Quote) => void
  onStatusChange: (quote: Quote, status: QuoteStatus) => void
  onDuplicate: (quote: Quote) => void
}) {
  const options = ['All statuses', 'Draft', 'Finalised', 'Sent', 'Accepted', 'Rejected', 'Expired', 'Cancelled']
  const statusSelectRef = useRef<HTMLSelectElement>(null)
  return (
    <>
      <div className="page-heading heading-split"><div><div className="eyebrow">SAVED QUOTATIONS</div><h1>Quotation history</h1><p>Search, review and manage your quotation records.</p></div></div>
      <div className="panel data-panel"><div className="data-toolbar"><label className="search-field"><Search size={16} /><input placeholder="Search quote number, client or title…" value={search} onChange={(event) => onSearch(event.target.value)} /></label><div className="filter-field"><ListFilter size={15} /><select ref={statusSelectRef} aria-label="Filter by quotation status" value={status} onChange={(event) => onStatus(event.target.value)}>{options.map((item) => <option key={item}>{item}</option>)}</select><button type="button" className="filter-arrow" aria-label="Open status filter" onClick={() => statusSelectRef.current?.showPicker()}><ChevronDown size={14} /></button></div></div>
        <div className="table-wrap"><table><thead><tr><th>QUOTE</th><th>CLIENT</th><th>ISSUED</th><th>VALID UNTIL</th><th>STATUS</th><th className="align-right">TOTAL INCL. VAT</th><th /></tr></thead><tbody>{quotes.map((quote) => <tr key={quote.id} onClick={() => onOpen(quote)}><td><b>{quote.number}</b><small>{quote.title}</small></td><td>{quote.clientSnapshot.name}</td><td>{quote.issueDate}</td><td>{quote.validUntil}</td><td><select className={statusTone(quote.status)} value={quote.status} onClick={(event) => event.stopPropagation()} onChange={(event) => void onStatusChange(quote, event.target.value as QuoteStatus)}>{options.slice(1).map((item) => <option key={item}>{item}</option>)}</select></td><td className="align-right amount">{money(quote.totalCents)}</td><td><button className="table-action" title="Duplicate quotation" onClick={(event) => { event.stopPropagation(); onDuplicate(quote) }}><Copy size={15} /></button></td></tr>)}</tbody></table>{!quotes.length && <EmptyState title="No quotations to show" text="Try changing your search or status filter." />}</div>
        <div className="table-footer"><span>{quotes.length} quotation{quotes.length === 1 ? '' : 's'} shown</span><span>Saved quotations retain their client, item, tax and terms snapshots.</span></div>
      </div>
    </>
  )
}

function PackagesPage({
  packages,
  catalogue,
  onAdd,
  onAddToQuote,
}: {
  packages: QuotePackage[]
  catalogue: CatalogueItem[]
  onAdd: () => void
  onAddToQuote: (item: QuotePackage) => void
}) {
  return (
    <>
      <div className="page-heading heading-split"><div><div className="eyebrow">REUSABLE COLLECTIONS</div><h1>Quotation packages</h1><p>Bundle products and services you often quote together.</p></div><button className="button button-primary" onClick={onAdd}><Plus size={17} /> Create package</button></div>
      {!packages.length ? <div className="panel empty-feature"><div className="empty-feature-icon"><PackageOpen size={25} /></div><h2>No packages yet</h2><p>Group catalogue items into reusable sets to add them to quotations in one click.</p><button className="button button-primary" onClick={onAdd}><Plus size={16} /> Create your first package</button></div> : <div className="feature-grid">{packages.map((item) => <article className="feature-card" key={item.id}><div className="feature-card-icon"><PackageOpen size={19} /></div><span className="feature-count">{item.items.length} item{item.items.length === 1 ? '' : 's'}</span><h2>{item.name}</h2><p>{item.description || 'A reusable group of catalogue items.'}</p><div className="package-items">{item.items.map((entry) => <span key={entry.itemId}>{catalogue.find((source) => source.id === entry.itemId)?.name ?? 'Archived catalogue item'} × {entry.quantity}</span>)}</div><button className="button button-secondary full-button" onClick={() => onAddToQuote(item)}><Plus size={15} /> Add to quotation</button></article>)}</div>}
    </>
  )
}

function QuoteTemplatesPage({
  templates,
  quotations,
  onAdd,
  onUse,
  onDelete,
}: {
  templates: QuoteTemplate[]
  quotations: Quote[]
  onAdd: () => void
  onUse: (item: QuoteTemplate) => void
  onDelete: (item: QuoteTemplate) => void
}) {
  return (
    <>
      <div className="page-heading heading-split">
        <div><div className="eyebrow">REUSABLE QUOTATIONS</div><h1>Quotation templates</h1><p>Save a previous quotation as a starting point for repeat work. Each use creates a separate editable draft with fresh dates.</p></div>
        <button className="button button-primary" disabled={!quotations.length} onClick={onAdd}><Plus size={17} /> Save quotation as template</button>
      </div>
      {!templates.length ? (
        <div className="panel empty-feature">
          <div className="empty-feature-icon purple"><Copy size={25} /></div>
          <h2>No reusable quotations yet</h2>
          <p>Choose a saved quotation as the starting point. When you use its template, you can adjust the client, dates, items, quantities, prices, terms and notes before saving or exporting.</p>
          {!quotations.length
            ? <span className="field-hint">Save a quotation first to create a template.</span>
            : <button className="button button-primary" onClick={onAdd}><Plus size={16} /> Save quotation as template</button>}
        </div>
      ) : (
        <div className="feature-grid">
          {templates.map((item) => (
            <article className="feature-card" key={item.id}>
              <div className="feature-card-icon purple"><Copy size={19} /></div>
              <span className="feature-count">{item.quote.lines.length} line item{item.quote.lines.length === 1 ? '' : 's'}</span>
              <h2>{item.name}</h2>
              <p>{item.description || item.quote.title}</p>
              <div className="package-items">
                <span>Client: {item.quote.clientSnapshot.name || 'Not specified'}</span>
                <span>Based on {item.quote.number} · {item.quote.title}</span>
                <span>Previous total: {money(item.quote.totalCents)}</span>
              </div>
              <button className="button button-secondary full-button" onClick={() => onUse(item)}><Copy size={15} /> Use as starting point</button>
              <button className="table-action danger-link" onClick={() => onDelete(item)}>Delete template</button>
            </article>
          ))}
        </div>
      )}
    </>
  )
}

function SettingsPage({ settings, onSave }: { settings: CompanySettings; onSave: (event: FormEvent<HTMLFormElement>) => Promise<void> }) {
  const [logoDataUrl, setLogoDataUrl] = useState(settings.logoDataUrl)
  const [logoError, setLogoError] = useState('')
  function loadLogo(file?: File) {
    if (!file) return
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setLogoError('Choose a PNG or JPEG image.')
      return
    }
    if (file.size > 2_000_000) {
      setLogoError('The logo must be 2 MB or smaller.')
      return
    }
    setLogoError('')
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') setLogoDataUrl(reader.result)
    }
    reader.onerror = () => setLogoError('The selected logo could not be read.')
    reader.readAsDataURL(file)
  }
  return (
    <>
      <div className="page-heading"><div><div className="eyebrow">COMPANY PROFILE</div><h1>Settings</h1><p>Set the defaults used in new quotations and PDF exports.</p></div></div>
      <form className="settings-layout" onSubmit={(event) => void onSave(event)}>
        <div className="settings-main">
          <section className="panel settings-card"><div className="panel-heading"><div><h2>Company information</h2><p>Shown on your branded quotation documents.</p></div><BriefcaseBusiness size={18} className="muted-icon" /></div><div className="form-grid form-grid-two"><label className="field"><span>Company name</span><input name="name" required defaultValue={settings.name} /></label><label className="field"><span>Prepared by</span><input name="preparedBy" defaultValue={settings.preparedBy} /></label><label className="field"><span>Registration number</span><input name="registrationNumber" defaultValue={settings.registrationNumber} /></label><label className="field"><span>VAT number</span><input name="vatNumber" defaultValue={settings.vatNumber} /></label><label className="field span-two"><span>Business address</span><input name="address" defaultValue={settings.address} /></label><label className="field"><span>Telephone</span><input name="phone" defaultValue={settings.phone} /></label><label className="field"><span>Email</span><input name="email" type="email" defaultValue={settings.email} /></label><label className="field"><span>Website</span><input name="website" defaultValue={settings.website} /></label><label className="field span-two"><span>Company logo (PNG or JPEG)</span><input type="file" accept="image/png,image/jpeg" onChange={(event) => loadLogo(event.target.files?.[0])} /><input type="hidden" name="logoDataUrl" value={logoDataUrl} />{logoError && <small className="logo-error">{logoError}</small>}{logoDataUrl && <div className="logo-preview"><img src={logoDataUrl} alt="Company logo preview" /><button type="button" className="table-action danger-link" onClick={() => { setLogoDataUrl(''); setLogoError('') }}>Remove logo</button></div>}</label></div></section>
          <section className="panel settings-card"><div className="panel-heading"><div><h2>Quotation defaults</h2><p>Applied automatically when you start a new quotation.</p></div><Calculator size={18} className="muted-icon" /></div><div className="form-grid form-grid-two"><label className="field"><span>Quotation number prefix</span><input name="quotationPrefix" defaultValue={settings.quotationPrefix} /></label><label className="field"><span>Default validity period (days)</span><input name="validityDays" type="number" min="1" max="365" defaultValue={settings.validityDays} /></label><label className="field"><span>Default VAT rate (%)</span><input name="vatRate" type="number" min="0" max="100" step="0.01" defaultValue={settings.vatRate} /></label><label className="field span-two"><span>Default ordering terms <small>One paragraph per line; included with new quotations and PDF exports.</small></span><textarea name="defaultTerms" rows={12} defaultValue={settings.defaultTerms.map((term) => term.replace('|', ' — ')).join('\n')} /></label><label className="field span-two"><span>Additional payment terms</span><textarea name="paymentTerms" rows={2} defaultValue={settings.paymentTerms} placeholder="Optional extra wording." /></label><label className="field span-two"><span>Additional warranty terms</span><textarea name="warrantyTerms" rows={2} defaultValue={settings.warrantyTerms} placeholder="Optional extra wording." /></label><label className="field span-two"><span>Additional exclusions</span><textarea name="exclusions" rows={2} defaultValue={settings.exclusions} placeholder="Optional extra wording." /></label><label className="field span-two"><span>Additional acceptance wording</span><textarea name="acceptanceWording" rows={2} defaultValue={settings.acceptanceWording} placeholder="Optional extra wording." /></label></div><div className="settings-caution"><ShieldCheck size={17} /><span>Only add commercial terms approved by Techspire IT. Terms are saved with each quotation revision.</span></div></section>
          <div className="settings-save"><button className="button button-primary"><Check size={16} /> Save settings</button></div>
        </div>
        <aside className="panel settings-aside"><div className="settings-aside-icon"><FileText size={20} /></div><h3>Your PDF document</h3><p>New PDFs use the Techspire red, black and white visual style and preserve the original quotation details.</p><ul><li><Check size={14} /> A4 layout</li><li><Check size={14} /> Rand pricing</li><li><Check size={14} /> Client and pricing snapshots</li><li><Check size={14} /> Dynamic line items</li></ul></aside>
      </form>
    </>
  )
}

function BackupPage({ onExport, onImport }: { onExport: () => void; onImport: () => void }) {
  return (
    <>
      <div className="page-heading"><div><div className="eyebrow">DATA SAFETY</div><h1>Backup & restore</h1><p>Protect your local quotation data with a portable SQLite backup.</p></div></div>
      <div className="backup-grid">
        <section className="panel backup-card"><div className="backup-card-icon"><ArrowDownToLine size={20} /></div><span className="eyebrow">CREATE A COPY</span><h2>Back up your data</h2><p>Export your clients, catalogue, quotation history and settings into a SQLite database file.</p><button className="button button-primary" onClick={onExport}><ArrowDownToLine size={16} /> Create backup</button></section>
        <section className="panel backup-card"><div className="backup-card-icon pale"><Upload size={20} /></div><span className="eyebrow">RESTORE A COPY</span><h2>Restore a backup</h2><p>Load a previously created Techspire database backup. This replaces the data currently on this device.</p><button className="button button-secondary" onClick={() => { if (window.confirm('Restoring replaces all current local data. Continue?')) onImport() }}><Upload size={16} /> Choose backup file</button></section>
      </div>
      <div className="backup-warning"><ShieldCheck size={17} /><span>Keep backups in a secure location. Client information and commercial quotations are included in the exported file.</span></div>
    </>
  )
}

function ClientForm({ client, onSubmit }: { client: Client | null; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <form className="modal-form" onSubmit={onSubmit}><div className="form-grid form-grid-two"><label className="field span-two"><span>Company name <i>*</i></span><input name="name" required autoFocus defaultValue={client?.name} /></label><label className="field"><span>Contact person</span><input name="contact" defaultValue={client?.contact} /></label><label className="field"><span>Email</span><input name="email" type="email" defaultValue={client?.email} /></label><label className="field"><span>Telephone</span><input name="phone" defaultValue={client?.phone} /></label><label className="field"><span>VAT number</span><input name="vatNumber" defaultValue={client?.vatNumber} /></label><label className="field span-two"><span>Street address</span><input name="address" defaultValue={client?.address} /></label><label className="field"><span>City</span><input name="city" defaultValue={client?.city} /></label><label className="field"><span>Province</span><input name="province" defaultValue={client?.province} /></label><label className="field"><span>Postal code</span><input name="postalCode" defaultValue={client?.postalCode} /></label></div><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))}>Cancel</button><button className="button button-primary"><Check size={15} /> {client ? 'Save changes' : 'Save client'}</button></div></form>
}

function CatalogueForm({ item, allowTransient, onSubmit }: { item: CatalogueItem | null; allowTransient: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const [hourly, setHourly] = useState(item?.unit === 'hour')
  return <form className="modal-form" onSubmit={onSubmit}><div className="form-grid form-grid-two"><label className="field span-two"><span>Product or service name <i>*</i></span><input name="name" required autoFocus defaultValue={item?.name} /></label><label className="field span-two"><span>Description</span><textarea name="description" rows={3} defaultValue={item?.description} /></label><label className="field"><span>SKU / product code</span><input name="sku" defaultValue={item?.sku} /></label><label className="field"><span>Category</span><input name="category" list="category-suggestions" defaultValue={item?.category} /><datalist id="category-suggestions"><option>Hardware</option><option>Services</option><option>Networking</option><option>Security</option></datalist></label><label className="field"><span>Pricing type</span><select name="pricingType" value={hourly ? 'hourly' : 'fixed'} onChange={(event) => setHourly(event.target.value === 'hourly')}><option value="fixed">Fixed / per unit</option><option value="hourly">Hourly service (rate × hours)</option></select></label><label className="field"><span>Unit of measurement</span><input name="unit" disabled={hourly} defaultValue={item?.unit && item.unit !== 'hour' ? item.unit : 'each'} /></label>{hourly && <p className="field-hint span-two">Enter an hourly rate. Hours are multiplied by this rate in the quotation and are not printed in the PDF.</p>}<label className="field span-two"><span>Catalogue price (ZAR)</span><input name="price" type="number" min="0" step="0.01" required defaultValue={item ? item.priceCents / 100 : '0.00'} /></label><label className="check-field span-two"><input name="priceIncludesVat" type="checkbox" /><span>Entered catalogue price already includes VAT (stored excluding VAT)</span></label><label className="check-field span-two"><input name="vatApplicable" type="checkbox" defaultChecked={item?.vatApplicable ?? true} /><span>Apply VAT at the configured company rate</span></label>{allowTransient && <label className="check-field span-two"><input name="saveToCatalogue" type="checkbox" defaultChecked /><span>Save to catalogue for future quotations</span></label>}</div><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))}>Cancel</button><button className="button button-primary"><Check size={15} /> Save item</button></div></form>
}

function CatalogueItemPicker({ catalogue }: { catalogue: CatalogueItem[] }) {
  const activeItems = catalogue.filter((item) => item.active)
  if (!activeItems.length) return <div className="catalogue-picker-empty">Add products or services to the catalogue first.</div>
  return <div className="catalogue-picker">{activeItems.map((item) => <label className="catalogue-picker-item" key={item.id}><input type="checkbox" name="itemIds" value={item.id} /><span>{item.name}</span><small>{item.unit === 'hour' ? 'Hourly service' : money(item.priceCents)}</small></label>)}</div>
}

function PackageForm({ catalogue, onSubmit }: { catalogue: CatalogueItem[]; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <form className="modal-form" onSubmit={onSubmit}><p className="modal-intro">Choose as many products and services as needed. The default quantity is applied to each and can be changed in the quotation.</p><div className="form-grid form-grid-two"><label className="field span-two"><span>Package name <i>*</i></span><input name="name" required autoFocus placeholder="e.g. Office network setup" /></label><label className="field span-two"><span>Description</span><textarea name="description" rows={2} /></label><div className="field span-two"><span>Catalogue items</span><CatalogueItemPicker catalogue={catalogue} /><small>Tick each product or service to include.</small></div><label className="field"><span>Default quantity per item</span><input name="quantity" type="number" min="1" defaultValue="1" /></label></div><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))}>Cancel</button><button className="button button-primary"><Check size={15} /> Save package</button></div></form>
}

function QuoteTemplateForm({ quotations, onSubmit }: { quotations: Quote[]; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const [selectedQuoteId, setSelectedQuoteId] = useState(quotations[0]?.id ?? '')
  const selectedQuote = quotations.find((item) => item.id === selectedQuoteId)
  return (
    <form className="modal-form" onSubmit={onSubmit}>
      <p className="modal-intro">Save a previous quotation as a reusable starting point. Every use creates a new draft; changing it will not change this template or the original quotation.</p>
      <div className="form-grid form-grid-two">
        <label className="field span-two"><span>Template name <i>*</i></span><input name="name" required autoFocus placeholder="e.g. Monthly IT support - Acme" /></label>
        <label className="field span-two"><span>Description</span><textarea name="description" rows={2} placeholder="Optional reminder about when to use this template." /></label>
        <label className="field span-two"><span>Starting quotation <i>*</i></span>
          <select name="quoteId" value={selectedQuoteId} required onChange={(event) => setSelectedQuoteId(event.target.value)}>
            {quotations.map((item) => <option value={item.id} key={item.id}>{item.number} · {item.clientSnapshot.name} · {item.title}</option>)}
          </select>
        </label>
        {selectedQuote && <p className="field-hint span-two">Includes {selectedQuote.lines.length} line item{selectedQuote.lines.length === 1 ? '' : 's'}, client details, pricing, discount, notes and ordering terms. Dates will be refreshed each time you use it.</p>}
      </div>
      <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))}>Cancel</button><button className="button button-primary"><Check size={15} /> Save quotation template</button></div>
    </form>
  )
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    document.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('keydown', handleKey)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-heading"><div className="modal-heading"><div><span className="eyebrow">TECHSPIRE IT</span><h2 id="modal-heading">{title}</h2></div><button className="icon-button" aria-label="Close" onClick={onClose}><X size={19} /></button></div>{children}</section></div>
}

function EmptyState({ title, text, action, onAction }: { title: string; text: string; action?: string; onAction?: () => void }) {
  return <div className="empty-state"><div className="empty-icon"><FolderOpen size={20} /></div><b>{title}</b><span>{text}</span>{action && onAction && <button className="button button-secondary button-compact" onClick={onAction}>{action} <ArrowRight size={14} /></button>}</div>
}

export default App
