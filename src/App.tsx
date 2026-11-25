import { ItemImage } from './ItemImage'
import { ClientForm, QuoteCustomerDetails } from './ClientForm'
import { PackagesPage } from './PackagesPage'
import { productAccessories } from './referencePackages'
import { DEFAULT_PAYMENT_PLANS, paymentPlanLabel, type PaymentPlan } from './paymentPlans'
import { PaymentOptions } from './PaymentOptions'
import { QuoteWorkbench } from './QuoteWorkbench'
import { SettingsPage } from './SettingsPage'
import { quotationReport, reportTypes, type ReportType } from './quotationReports'
import { quotationWorkbook } from './quotationWorkbook'
import { canAccessSection, type UserProfile } from './auth'
import { UsersPage } from './UsersPage'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  Archive,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Bell,
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
import { confirm, open, save } from '@tauri-apps/plugin-dialog'
import { readFile, writeFile } from '@tauri-apps/plugin-fs'
import { downloadDir, join } from '@tauri-apps/api/path'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import {
  calculateOfferPayments,
  calculateQuotePricing,
  clientDisplayName,
  filterMyQuotes,
  filterQuoteHistory,
  missingClientFields,
  copyQuoteLines,
  createPackageLine,
  catalogueCategories,
  packageCategory,
  packageProducts,
  supportsProductAccessories,
  quoteOptions,
  catalogueNetPriceCents,
  centsFromInput,
  createId,
  createQuoteFromTemplate,
  dateAfter,
  money,
  ALL_HISTORY_CREATORS,
  UNRECORDED_HISTORY_CREATOR,
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
  saveClient,
  savePackage,
  saveQuote,
  saveQuoteTemplate,
  saveSettings,
} from './database'
import './App.css'

const navigation: Array<{
  label: string
  section: Section
  icon: typeof LayoutDashboard
  group: 'main' | 'manage' | 'system'
}> = [
  { label: 'Dashboard', section: 'dashboard', icon: LayoutDashboard, group: 'main' },
  { label: 'New quotation', section: 'builder', icon: FilePlus2, group: 'main' },
  { label: 'Packages', section: 'packages', icon: PackageOpen, group: 'manage' },
  { label: 'Quotation templates', section: 'templates', icon: Copy, group: 'manage' },
  { label: 'Clients', section: 'clients', icon: Users, group: 'manage' },
  { label: 'My quotations', section: 'my-quotes', icon: FileText, group: 'manage' },
  { label: 'Quotation history', section: 'history', icon: FileClock, group: 'manage' },
  { label: 'Settings', section: 'settings', icon: Settings, group: 'system' },
  { label: 'Backup & restore', section: 'backup', icon: Archive, group: 'system' },
  { label: 'Users & permissions', section: 'users', icon: Users, group: 'system' },
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

const makeLine = (item: CatalogueItem, catalogue: CatalogueItem[] = [], includeAccessories = supportsProductAccessories(item.category)): QuoteLine => ({
  id: createId(),
  itemId: item.id,
  unit: item.unit,
  name: item.name,
  description: item.description,
  sku: item.sku,
  quantity: 1,
  minimumQuantity: item.minimumQuantity,
  unitPriceCents: item.priceCents,
  costCents: item.costCents,
  monthlyCents: item.monthlyCents,
  imageDataUrl: item.imageDataUrl,
  featureChoices: includeAccessories ? productAccessories(item, catalogue).filter((feature) => feature.active).map(({ accessories, featureItemIds, ...snapshot }) => {
    void accessories
    void featureItemIds
    return snapshot
  }) : undefined,
  vatApplicable: item.vatApplicable,
})

function withProductAccessories(parent: QuotePackage, product: CatalogueItem, accessories: CatalogueItem[]): QuotePackage {
  return {
    ...parent,
    items: parent.items.map((entry) => entry.itemId === product.id ? { ...entry, product: { ...product, accessories } } : entry),
  }
}

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

function App({ currentUser, users, onSaveUsers }: {
  currentUser: UserProfile
  users: UserProfile[]
  onSaveUsers: (users: UserProfile[]) => void
}) {
  const [data, setData] = useState<AppData | null>(null)
  const [section, setSection] = useState<Section>('dashboard')
  const [quote, setQuote] = useState<Quote | null>(null)
  const [selectedOptionId, setSelectedOptionId] = useState('')
  const [activeQuoteId, setActiveQuoteId] = useState<string | null>(null)
  const [generatedPdf, setGeneratedPdf] = useState<{ url: string; filename: string; quote: Quote } | null>(null)
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false)
  const [modal, setModal] = useState<'client' | 'item' | 'package' | 'quote-template' | null>(null)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [managedPackageId, setManagedPackageId] = useState<string | null>(null)
  const [productPackageId, setProductPackageId] = useState<string | null>(null)
  const [accessoryParent, setAccessoryParent] = useState<CatalogueItem | null>(null)
  const [editingPackage, setEditingPackage] = useState<QuotePackage | null>(null)
  const [editingItem, setEditingItem] = useState<CatalogueItem | null>(null)
  const [search, setSearch] = useState('')
  const [historyFilter, setHistoryFilter] = useState('All statuses')
  const [historyCreatorFilter, setHistoryCreatorFilter] = useState(ALL_HISTORY_CREATORS)
  const [historyDateRange, setHistoryDateRange] = useState({ from: '', to: '' })
  const [myQuotesSearch, setMyQuotesSearch] = useState('')
  const [myQuotesFilter, setMyQuotesFilter] = useState('All statuses')
  const [myQuotesDateRange, setMyQuotesDateRange] = useState({ from: '', to: '' })
  const [busy, setBusy] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loadError, setLoadError] = useState('')
  const [displayDate] = useState(() =>
    new Intl.DateTimeFormat('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date()),
  )
  const editingOption = quote?.alternatives?.find((option) => option.id === selectedOptionId)
  const editingLines = editingOption?.lines ?? quote?.lines ?? []
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
    if (busy || !quote || !data || quote.status !== 'Draft') return
    if (!quoteOptions(quote).some((option) => option.lines.length) && !data.quotations.some((item) => item.id === quote.id)) return
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
      createdBy: currentUser.fullName,
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
      lines: [createPackageLine(item, data.catalogue)],
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
      createdBy: currentUser.fullName,
      exportedFilename: '',
    }
    setActiveQuoteId(null)
    setQuote(applyTotals(draft, data))
    setSection('builder')
  }

  function startQuoteFromTemplate(template: QuoteTemplate) {
    if (!data) return
    setActiveQuoteId(null)
    setQuote({
      ...createQuoteFromTemplate(template, quoteNumber(data, quote), data.clients, data.settings),
      createdBy: currentUser.fullName,
    })
    setSection('builder')
  }

  function openQuote(selected: Quote) {
    if (!data || !canAccessSection(currentUser, 'builder')) return
    if (quote?.id !== selected.id || quote.status !== 'Draft' || selected.status !== 'Draft') {
      lastAutoSavedQuote.current = JSON.stringify(applyTotals(selected, data))
      setQuote(structuredClone(selected))
      setSelectedOptionId('')
    }
    setActiveQuoteId(selected.id)
    setSection('builder')
  }

  function duplicateQuote(item: Quote) {
    if (!data || !canAccessSection(currentUser, 'builder')) return
    setQuote({
      ...structuredClone(item),
      lines: copyQuoteLines(item.lines),
      alternatives: item.alternatives?.map((option) => ({ ...option, id: createId(), lines: copyQuoteLines(option.lines) })),
      id: createId(),
      number: quoteNumber(data, quote),
      status: 'Draft',
      issueDate: today(),
      validUntil: dateAfter(today(), data.settings.validityDays),
      createdAt: new Date().toISOString(),
      createdBy: currentUser.fullName,
      exportedFilename: '',
    })
    setActiveQuoteId(null)
    setSection('builder')
  }

  function applyTotals(value: Quote, source: AppData): Quote {
    const totals = calculateQuotePricing(value, source.settings.vatRate)
    return {
      ...value,
      subtotalCents: totals.subtotalCents,
      discountCents: totals.discountCents,
      vatCents: totals.vatCents,
      totalCents: totals.dueCents,
    }
  }

  function updateQuote(patch: Partial<Quote>) {
    if (!quote || !data) return
    setQuote((current) => {
      if (!current || current.id !== quote.id) return current
      const { lines, pricing, discountType, discountValue, ...shared } = patch
      const optionPatch = {
        ...(lines !== undefined ? { lines } : {}),
        ...(pricing !== undefined ? { pricing } : {}),
        ...(discountType !== undefined ? { discountType } : {}),
        ...(discountValue !== undefined ? { discountValue } : {}),
      }
      const next = current.alternatives?.some((option) => option.id === selectedOptionId)
        ? { ...current, ...shared, alternatives: (shared.alternatives ?? current.alternatives).map((option) =>
          option.id === selectedOptionId ? { ...option, ...optionPatch } : option,
        ) }
        : { ...current, ...shared, ...optionPatch }
      return applyTotals(next, data)
    })
  }

  function selectClient(clientId: string) {
    const client = data?.clients.find((item) => item.id === clientId)
    if (!quote) return
    updateQuote({ clientId: client?.id ?? '', clientSnapshot: client ? { ...client } : blankClient() })
    setError('')
  }

  function addPackageToQuote(item: QuotePackage) {
    if (!quote || !data) return
    updateQuote({ lines: [...editingLines, createPackageLine(item, data.catalogue)] })
    setSection('builder')
  }

  async function saveDraft() {
    if (!quote || !data || busy) return
    setNotice('')
    setError('')
    if (quote.status !== 'Draft') {
      setError('Open this quotation from Quotation history to save a new draft revision.')
      return
    }
    setSavingDraft(true)
    setBusy(true)
    const saved = applyTotals({ ...quote, status: 'Draft' }, data)
    try {
      await saveQuote(saved)
      lastAutoSavedQuote.current = JSON.stringify(saved)
      setData((current) => current && { ...current, quotations: [saved, ...current.quotations.filter((item) => item.id !== saved.id)] })
      setNotice(`Draft ${saved.number} saved. You can reopen it in Quotation history.`)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      setError(`Draft could not be saved. ${message}`)
    } finally {
      setBusy(false)
      setSavingDraft(false)
    }
  }

  async function generatePdf() {
    if (!quote || !data || busy || quote.status !== 'Draft') return
    setNotice('')
    setError('')
    if (document.querySelector('.quote-workbench [data-image-pending]')) {
      setError('Wait for the product image to finish importing before exporting.')
      return
    }
    if (!quote.clientId) {
      setError('Select or add a client before generating the PDF.')
      const clientField = data.clients.some((client) => !client.archived) ? 'quote-client' : 'quote-add-client'
      document.getElementById(clientField)?.focus()
      return
    }
    const missing = missingClientFields(quote.clientSnapshot)
    if (missing.length) {
      setError(`Complete the required client fields before generating the PDF (${missing.join(', ')}).`)
      setEditingClient(data.clients.find((client) => client.id === quote.clientId) ?? quote.clientSnapshot)
      setModal('client')
      return
    }
    const options = quoteOptions(quote)
    for (const option of options) {
      const emptyPackage = option.lines.find((line) => line.packageFeatures && !option.lines.some((entry) => !entry.packageFeatures && entry.packageInstanceId === line.packageInstanceId))
      let problem = ''
      if (emptyPackage) problem = `Select at least one item in ${emptyPackage.name}.`
      else if (!option.lines.length) problem = 'Add an item before generating the PDF.'
      else if (option.lines.some((line) => !line.name.trim() || line.quantity <= 0 || line.quantity < (line.minimumQuantity ?? 0) || line.unitPriceCents < 0)) {
        problem = 'Check item and feature names, quantities and prices.'
      }
      const unavailable = calculateOfferPayments(option, data.settings.vatRate)
        .find(({ payment, totals }) => payment !== 'cash' && totals.factor === null)
      if (!problem && unavailable && unavailable.payment !== 'cash') {
        problem = `${paymentPlanLabel(unavailable.payment)} has no factor for this value. Remove that payment option or update the factors.`
      }
      if (problem) {
        setSelectedOptionId(option.id)
        setError(`${option.name || 'Offer option'} — ${problem}`)
        return
      }
    }
    setBusy(true)
    try {
      const finalQuote = applyTotals({ ...quote, status: 'Finalised' }, data)
      const { createQuotationPdf, quotationFilename } = await import('./quotationPdf')
      const document = createQuotationPdf(finalQuote, { ...data.settings, preparedBy: currentUser.fullName })
      const filename = quotationFilename(finalQuote)
      const bytes = new Uint8Array(document.output('arraybuffer'))
      const desktop = isTauri()
      if (desktop) {
        const path = await join(await downloadDir(), filename)
        await writeFile(path, bytes)
      } else {
        document.save(filename)
      }
      const savedQuote = { ...finalQuote, exportedFilename: filename }
      await saveQuote(savedQuote)
      setQuote((current) => current?.id === savedQuote.id ? savedQuote : current)
      setData((current) => current && { ...current, quotations: [savedQuote, ...current.quotations.filter((item) => item.id !== savedQuote.id)] })
      setActiveQuoteId(savedQuote.id)
      setGeneratedPdf({ url: URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })), filename, quote: savedQuote })
      setPdfViewerOpen(true)
      setNotice(desktop ? 'PDF saved to Downloads and quotation finalised.' : 'PDF downloaded and quotation finalised.')
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      setError(`PDF export failed. ${message}`)
    } finally {
      setBusy(false)
    }
  }

  async function saveClientForm(client: Client) {
    if (!data) return
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

  async function saveManagedPackage(item: QuotePackage, message: string, onSaved?: () => void) {
    if (busy) return
    setBusy(true)
    try {
      await persist(() => savePackage(item), message, () => {
        setData((current) => current ? { ...current, packages: current.packages.some((entry) => entry.id === item.id)
          ? current.packages.map((entry) => entry.id === item.id ? item : entry)
          : [item, ...current.packages] } : current)
        setManagedPackageId(item.id)
        onSaved?.()
      })
    } catch {
      // The editor stays open with the save error.
    } finally {
      setBusy(false)
    }
  }

  async function saveItemForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!data) return
    if (event.currentTarget.querySelector('[data-image-pending]')) {
      setError('Wait for the product image to finish importing.')
      return
    }
    const form = new FormData(event.currentTarget)
    const parent = data.packages.find((entry) => entry.id === productPackageId)
    if (productPackageId && !parent) return
    if (editingItem?.pricingPending && !String(form.get('price') ?? '').trim()) {
      setError('Enter a confirmed once-off price, or enter zero for a monthly-only product.')
      return
    }
    const item: CatalogueItem = {
      ...(editingItem ?? blankCatalogueItem()),
      name: String(form.get('name') ?? '').trim(),
      description: String(form.get('description') ?? '').trim(),
      sku: String(form.get('sku') ?? '').trim(),
      category: parent ? packageCategory(parent, data.catalogue) : 'General',
      productGroup: String(form.get('productGroup') ?? '').trim() || undefined,
      choiceGroup: accessoryParent ? String(form.get('choiceGroup') ?? '').trim() || undefined : editingItem?.choiceGroup,
      unit: String(form.get('unit') ?? '').trim() || 'each',
      priceCents: catalogueNetPriceCents(
        centsFromInput(String(form.get('price') ?? '0')),
        form.get('priceIncludesVat') === 'on',
        form.get('vatApplicable') === 'on',
        data.settings.vatRate,
      ),
      costCents: form.get('cost') ? centsFromInput(String(form.get('cost'))) : undefined,
      monthlyCents: catalogueNetPriceCents(
        centsFromInput(String(form.get('monthly') ?? 0)),
        form.get('priceIncludesVat') === 'on',
        form.get('vatApplicable') === 'on',
        data.settings.vatRate,
      ),
      imageDataUrl: String(form.get('imageDataUrl') ?? '') || undefined,
      vatApplicable: form.get('vatApplicable') === 'on',
      pricingPending: undefined,
      active: true,
    }
    if (form.get('pricingType') === 'hourly') item.unit = 'hour'
    if (!item.name) {
      setError(accessoryParent ? 'Enter a feature name.' : 'Enter a product or service name.')
      return
    }
    const closeItemEditor = () => {
      setModal(null)
      setEditingItem(null)
      setProductPackageId(null)
      setAccessoryParent(null)
    }
    if (parent && accessoryParent) {
      const product = packageProducts(parent, data.catalogue).find(({ item }) => item.id === accessoryParent.id)?.item
      if (!product || !supportsProductAccessories(packageCategory(parent, data.catalogue))) {
        setError('Select an Office Automation product to manage its features.')
        return
      }
      const accessories = productAccessories(product, data.catalogue)
      const updated = editingItem ? accessories.map((entry) => entry.id === editingItem.id ? item : entry) : [...accessories, item]
      await saveManagedPackage(withProductAccessories(parent, product, updated), editingItem ? 'Feature updated' : 'Feature added', closeItemEditor)
    } else if (parent) {
      const entry = { itemId: item.id, quantity: Math.max(item.minimumQuantity ?? 0.01, Number(form.get('quantity')) || 1), product: item }
      const items = editingItem
        ? parent.items.map((existing) => existing.itemId === editingItem.id ? entry : existing)
        : [...parent.items, entry]
      await saveManagedPackage({ ...parent, items }, editingItem ? 'Product updated' : 'Product added to package', closeItemEditor)
    } else if (quote && section === 'builder') {
      updateQuote({ lines: [...editingLines, { ...makeLine(item), itemId: null }] })
      setNotice('Item added to quotation')
      closeItemEditor()
    }
  }

  async function savePackageForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!data) return
    if (event.currentTarget.querySelector('[data-image-pending]')) {
      setError('Wait for the package image to finish importing.')
      return
    }
    const form = new FormData(event.currentTarget)
    const entry: QuotePackage = {
      id: editingPackage?.id ?? createId(),
      name: String(form.get('name') ?? '').trim(),
      description: String(form.get('description') ?? '').trim(),
      category: String(form.get('category') ?? '').trim() || undefined,
      imageDataUrl: String(form.get('imageDataUrl') ?? '') || undefined,
      items: editingPackage?.items ?? [],
    }
    if (!entry.name) {
      setError('Enter a package name.')
      return
    }
    await saveManagedPackage(entry, editingPackage ? 'Package updated' : 'Package created', () => {
      setEditingPackage(null)
      setModal(null)
    })
  }

  async function saveQuoteTemplateForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!data) return
    const form = new FormData(event.currentTarget)
    const sourceId = String(form.get('quoteId') ?? '')
    const source = section === 'builder' && quote?.id === sourceId ? quote : data.quotations.find((item) => item.id === sourceId)
    if (!source) {
      setError('Choose a saved quotation to use as the template starting point.')
      return
    }
    const entry: QuoteTemplate = {
      id: createId(),
      name: String(form.get('name') ?? '').trim(),
      description: String(form.get('description') ?? '').trim(),
      quote: structuredClone({ ...source, details: undefined }),
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
    const paymentPlans = JSON.parse(String(form.get('paymentPlans') ?? '[]')) as PaymentPlan[]
    if (paymentPlans.some((plan) => !Number.isInteger(plan.months) || plan.months < 1 ||
      !Number.isFinite(plan.escalation) || plan.escalation < 0 || !plan.tiers.length ||
      plan.tiers.some((tier, index) => !Number.isFinite(tier.factor) || tier.factor < 0 ||
        !Number.isFinite(tier.limit) || tier.limit <= (plan.tiers[index - 1]?.limit ?? 0)))) {
      setError('Check the term, escalation and factors. Each plan needs thresholds in increasing order.')
      return
    }
    const settings: CompanySettings = {
      paymentPlans,
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

  async function exportHistoryReport(quotes: Quote[], type: ReportType, format: 'xlsx' | 'csv') {
    if (!data) return
    setError('')
    try {
      const bytes = format === 'xlsx'
        ? quotationWorkbook(quotes, type, data.settings.vatRate)
        : new TextEncoder().encode(quotationReport(quotes, type, data.settings.vatRate))
      const filename = `Techspire-${type.toLowerCase().replaceAll(' ', '-')}-${today()}.${format}`
      if (isTauri()) {
        const path = await save({ defaultPath: filename, filters: [{ name: format === 'xlsx' ? 'Excel workbook' : 'CSV report', extensions: [format] }] })
        if (!path) return
        await writeFile(path, bytes)
      } else {
        const mimeType = format === 'xlsx'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/csv;charset=utf-8'
        const url = URL.createObjectURL(new Blob([Uint8Array.from(bytes)], { type: mimeType }))
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        link.click()
        window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
      setNotice(`${type} report exported.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not export the quotation report.')
    }
  }

  async function exportBackup() {
    if (!canAccessSection(currentUser, 'backup')) return
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
    if (!canAccessSection(currentUser, 'backup')) return
    setError('')
    try {
      let bytes: Uint8Array
      if (isTauri()) {
        const path = await open({ multiple: false, filters: [{ name: 'Techspire backups', extensions: ['sqlite', 'sqlite3', 'db', 'zip'] }] })
        if (!path || Array.isArray(path)) return
        bytes = await readFile(path)
      } else {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.sqlite,.sqlite3,.db,.zip'
        const file = await new Promise<File | null>((resolve) => {
          input.onchange = () => resolve(input.files?.[0] ?? null)
          input.oncancel = () => resolve(null)
          input.click()
        })
        if (!file) return
        bytes = new Uint8Array(await file.arrayBuffer())
      }
      const warning = 'Restoring this backup replaces your current local quotation data. Continue?'
      const confirmed = isTauri() ? await confirm(warning, { title: 'Restore backup', kind: 'warning' }) : window.confirm(warning)
      if (!confirmed) return
      await restoreDatabase(bytes)
      setData(await loadAppData())
      setNotice('Database restored.')
    } catch (cause) {
      setError(cause instanceof Error ? `Restore failed: ${cause.message}` : 'Restore failed.')
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

  const filteredClients = data.clients.filter((client) =>
    `${client.name} ${client.contact} ${client.email}`.toLowerCase().includes(search.toLowerCase()),
  )
  const historyCreators = [...new Set(data.quotations.map((item) => item.createdBy?.trim()).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b))
  const filteredQuotes = filterQuoteHistory(data.quotations, search, historyFilter, historyCreatorFilter, historyDateRange.from, historyDateRange.to)
  const ownerName = currentUser.fullName.trim()
  const hasUniqueOwnerName = users.filter((user) => user.fullName.trim() === ownerName).length === 1
  const myQuotes = hasUniqueOwnerName ? filterMyQuotes(data.quotations, ownerName, '', 'All statuses') : []
  const myQuoteCount = myQuotes.length
  const filteredMyQuotes = filterMyQuotes(myQuotes, ownerName, myQuotesSearch, myQuotesFilter, myQuotesDateRange.from, myQuotesDateRange.to)
  const errorAlert = error && (
    <div className="alert alert-error" role="alert">
      <ShieldCheck size={17} /><span>{error}</span>
      <button aria-label="Dismiss error" onClick={() => setError('')}><X size={15} /></button>
    </div>
  )

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand-lockup" onClick={() => setSection('dashboard')} aria-label="Techspire IT dashboard">
          <span className="brand-mark">ts</span>
          <span className="brand-copy"><strong>TECHSPIRE IT</strong><small>QUOTATION BUILDER</small></span>
        </button>
        <div className="workspace-pill"><span className="workspace-dot" /> Local workspace <ChevronDown size={14} /></div>
        <nav className="nav-list" aria-label="Main navigation">
          {(['main', 'manage', 'system'] as const).map((group) => {
            const entries = navigation.filter((item) => item.group === group && canAccessSection(currentUser, item.section))
            if (!entries.length) return null
            return (
            <div className="nav-group" key={group}>
              {(group !== 'system' || currentUser.role === 'admin') && (
                <span className="nav-label">{group === 'main' ? 'WORKSPACE' : group === 'manage' ? 'MANAGE' : 'PREFERENCES'}</span>
              )}
              {entries.map(({ label, section: target, icon: Icon }) => (
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
                  {target === 'my-quotes' && myQuoteCount > 0 && <span className="nav-count">{myQuoteCount}</span>}
                </button>
              ))}
            </div>
            )
          })}
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
            <div className="avatar">{currentUser.fullName.slice(0, 1).toUpperCase()}</div>
          </div>
        </header>

        <div className="page-content">
          {((error && !modal) || notice) && <div className={section === 'builder' ? 'quote-feedback' : undefined}>
            {!modal && errorAlert}
            {notice && <div className="alert alert-success" role="status"><Check size={17} /><span>{notice}</span><button aria-label="Dismiss message" onClick={() => setNotice('')}><X size={15} /></button></div>}
          </div>}

          {!canAccessSection(currentUser, section) && <div className="panel access-denied"><ShieldCheck size={22} /><h2>Page unavailable</h2><p>Your account does not have access to this page. Contact an administrator if you need access.</p></div>}
          {section === 'dashboard' && canAccessSection(currentUser, section) && (
            <Dashboard
              quotations={currentUser.role === 'admin' ? data.quotations : myQuotes}
              currentUser={currentUser}
              onNew={startNewQuote}
              onOpenQuote={openQuote}
              onNavigate={setSection}
              onManageProducts={() => setSection('packages')}
            />
          )}

          {section === 'builder' && canAccessSection(currentUser, 'builder') && quote && quote.status !== 'Draft' && (
            <>
              <div className="page-heading heading-split">
                <div><div className="eyebrow">{quote.number} · {quote.status}</div><h1>{quote.title}</h1><p>Saved quotation preview</p></div>
                <div className="heading-actions">
                  <button className="button button-secondary" onClick={() => duplicateQuote(quote)}><Copy size={16} /> Duplicate as draft</button>
                </div>
              </div>
              <PdfPreview quote={quote} settings={{ ...data.settings, preparedBy: quote.createdBy || data.settings.preparedBy }} large />
            </>
          )}
          {section === 'builder' && canAccessSection(currentUser, 'builder') && quote?.status === 'Draft' && (
            <Builder
              data={data}
              quote={quote}
              currentUser={currentUser}
              selectedOptionId={editingOption?.id ?? ''}
              onSelectOption={setSelectedOptionId}
              existingQuote={activeQuote}
              generatedPdf={generatedPdf?.quote.id === quote.id ? generatedPdf : null}
              onViewGeneratedPdf={() => setPdfViewerOpen(true)}
              busy={busy}
              savingDraft={savingDraft}
              onUpdate={updateQuote}
              onSelectClient={selectClient}
              onSaveDraft={saveDraft}
              onGeneratePdf={generatePdf}
              onAddClient={() => {
                setError('')
                setEditingClient(null)
                setModal('client')
              }}
              onEditClient={(client) => {
                setError('')
                setEditingClient(client)
                setModal('client')
              }}
              onAddItemForm={() => {
                setError('')
                setEditingItem(null)
                setModal('item')
              }}
              onUseTemplate={startQuoteFromTemplate}
              onSaveTemplate={() => {
                setError('')
                setModal('quote-template')
              }}
            />
          )}

          {section === 'clients' && canAccessSection(currentUser, 'clients') && (
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
                if (!window.confirm(`Archive ${clientDisplayName(client)}? Existing quotations will remain unchanged.`)) return
                const archived = { ...client, archived: true }
                try {
                  await persist(() => saveClient(archived), 'Client archived', () =>
                    setData({ ...data, clients: data.clients.map((item) => item.id === client.id ? archived : item) }),
                  )
                } catch { return }
              }}
            />
          )}

          {section === 'history' && canAccessSection(currentUser, 'history') && (
            <HistoryPage
              quotes={filteredQuotes}
              scope="all"
              search={search}
              status={historyFilter}
              creator={historyCreatorFilter}
              creators={historyCreators}
              dateRange={historyDateRange}
              onDateRange={setHistoryDateRange}
              onSearch={setSearch}
              onStatus={setHistoryFilter}
              onCreator={setHistoryCreatorFilter}
              onOpen={openQuote}
              onExport={exportHistoryReport}
              onStatusChange={updateQuoteStatus}
              onDuplicate={duplicateQuote}
            />
          )}

          {section === 'my-quotes' && canAccessSection(currentUser, 'my-quotes') && (
            <HistoryPage
              quotes={filteredMyQuotes}
              scope="mine"
              search={myQuotesSearch}
              status={myQuotesFilter}
              creator={currentUser.fullName}
              creators={[]}
              dateRange={myQuotesDateRange}
              onDateRange={setMyQuotesDateRange}
              onSearch={setMyQuotesSearch}
              onStatus={setMyQuotesFilter}
              onCreator={() => {}}
              onOpen={openQuote}
              onExport={exportHistoryReport}
              onStatusChange={updateQuoteStatus}
              onNew={startNewQuote}
              onDuplicate={duplicateQuote}
            />
          )}

          {section === 'packages' && canAccessSection(currentUser, 'packages') && (
            <PackagesPage packages={data.packages} legacyProducts={data.catalogue} selectedId={managedPackageId} busy={busy}
              onSelect={setManagedPackageId}
              onAdd={() => { setEditingPackage(null); setModal('package') }}
              onEdit={(item) => { setEditingPackage(item); setModal('package') }}
              onAddToQuote={(item) => quote ? addPackageToQuote(item) : startQuoteWithPackage(item)}
              onProduct={(parent, product) => {
                setAccessoryParent(null)
                setProductPackageId(parent.id)
                setEditingItem(product ?? null)
                setModal('item')
              }}
              onAccessory={(parent, product, accessory) => {
                if (!supportsProductAccessories(packageCategory(parent, data.catalogue))) return
                setAccessoryParent(product)
                setProductPackageId(parent.id)
                setEditingItem(accessory ?? null)
                setModal('item')
              }}
              onRemoveAccessory={(parent, product, accessory) => {
                if (!supportsProductAccessories(packageCategory(parent, data.catalogue))) return
                if (!window.confirm(`Remove "${accessory.name}" from "${product.name}"?`)) return
                const remaining = productAccessories(product, data.catalogue).filter((entry) => entry.id !== accessory.id)
                void saveManagedPackage(withProductAccessories(parent, product, remaining), 'Feature removed')
              }}
              onCopyProduct={(parent, source) => {
                const product = { ...source, id: createId(), active: true, category: packageCategory(parent, data.catalogue) }
                void saveManagedPackage({ ...parent, items: [...parent.items, { itemId: product.id, quantity: 1, product }] }, 'Product copied into package')
              }}
              onRemoveProduct={(parent, product) => {
                if (!window.confirm(`Remove "${product.name}" from "${parent.name}"?`)) return
                void saveManagedPackage({ ...parent, items: parent.items.filter((item) => item.itemId !== product.id) }, 'Product removed from package')
              }} />
          )}

          {section === 'templates' && canAccessSection(currentUser, 'templates') && (
            <QuoteTemplatesPage
              templates={data.quoteTemplates}
              quotations={data.quotations}
              onAdd={() => setModal('quote-template')}
              onUse={startQuoteFromTemplate}
              onDelete={(item) => void removeQuoteTemplate(item)}
            />
          )}

          {section === 'settings' && canAccessSection(currentUser, 'settings') && <SettingsPage settings={data.settings} onSave={saveSettingsForm} />}
          {section === 'backup' && canAccessSection(currentUser, 'backup') && <BackupPage onExport={exportBackup} onImport={importBackup} />}
          {section === 'users' && currentUser.role === 'admin' && <UsersPage users={users} currentUserId={currentUser.id} onSaveUsers={onSaveUsers} />}
        </div>
      </main>

      {modal && (
        <Modal
          title={
            modal === 'client'
              ? editingClient ? 'Edit client' : 'Add a client'
              : modal === 'item'
                ? accessoryParent ? editingItem ? 'Edit feature' : 'Add feature' :
                  productPackageId ? editingItem ? 'Edit package product' : 'Add product to package' : 'Add a custom item'
                : modal === 'package' ? editingPackage ? 'Edit package' : 'Create a package' : 'Create a reusable quotation template'
          }
          onClose={() => {
            setModal(null)
            setEditingClient(null)
            setEditingItem(null)
            setProductPackageId(null)
            setAccessoryParent(null)
          }}
        >
          {errorAlert}
          {modal === 'client' && (
            <ClientForm client={editingClient} busy={busy} onCancel={() => { setModal(null); setError('') }} onSubmit={saveClientForm} />
          )}
          {modal === 'item' && (
            <ProductForm item={editingItem} accessoryParent={accessoryParent} parent={data.packages.find((entry) => entry.id === productPackageId)}
              legacyProducts={data.catalogue} busy={busy} onSubmit={saveItemForm} />
          )}
          {modal === 'package' && (
            <PackageForm categories={catalogueCategories(data.catalogue)} headings={data.packages.map((item) => packageCategory(item, data.catalogue))} busy={busy} item={editingPackage} onSubmit={savePackageForm} />
          )}
          {modal === 'quote-template' && (
            <QuoteTemplateForm quotations={section === 'builder' && quote ? [quote, ...data.quotations.filter((entry) => entry.id !== quote.id)] : data.quotations} onSubmit={saveQuoteTemplateForm} />
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
            <PdfPreview quote={generatedPdf.quote} settings={{ ...data.settings, preparedBy: currentUser.fullName }} large />
            <iframe id="generated-pdf-frame" className="pdf-print-frame" title={`Print source for ${generatedPdf.filename}`} src={generatedPdf.url} />
          </section>
        </div>
      )}
    </div>
  )
}

function Dashboard({
  quotations,
  currentUser,
  onNew,
  onOpenQuote,
  onNavigate,
  onManageProducts,
}: {
  quotations: Quote[]
  currentUser: UserProfile
  onNew: () => void
  onOpenQuote: (quote: Quote) => void
  onNavigate: (section: Section) => void
  onManageProducts: () => void
}) {
  const statuses: QuoteStatus[] = ['Draft', 'Finalised', 'Sent', 'Accepted', 'Rejected', 'Expired']
  const counts = statuses.map((status) => quotations.filter((quote) => quote.status === status).length)
  const historySection = currentUser.role === 'admin' ? 'history' : 'my-quotes'
  const canBuild = canAccessSection(currentUser, 'builder')
  const month = today().slice(0, 7)
  const thisMonth = quotations.filter((quote) => quote.createdAt.slice(0, 7) === month).length
  const total = quotations.reduce((sum, quote) => sum + quote.totalCents, 0)
  const cards = [
    { label: 'Total quotations', value: String(quotations.length), icon: FileText, tint: 'red' },
    { label: 'Drafts in progress', value: String(counts[0]), icon: ClipboardList, tint: 'amber' },
    { label: 'Accepted', value: String(counts[3]), icon: BadgeCheck, tint: 'green' },
    { label: 'Created this month', value: String(thisMonth), icon: BarChart3, tint: 'blue' },
  ]
  return (
    <>
      <div className="page-heading heading-split">
        <div><div className="eyebrow">OVERVIEW</div><h1>Good day, {currentUser.fullName.split(' ')[0]}.</h1><p>Here’s what’s happening with your quotations.</p></div>
        {canBuild && <button className="button button-primary" onClick={onNew}><Plus size={17} /> New quotation</button>}
      </div>
      <div className="stat-grid">
        {cards.map(({ label, value, icon: Icon, tint }) => <div className="stat-card" key={label}>
          <div className={`stat-icon ${tint}`}><Icon size={18} /></div><div><span>{label}</span><strong>{value}</strong></div>
        </div>)}
      </div>
      <section className="dashboard-row">
        <div className="panel recent-panel">
          <div className="panel-heading"><div><h2>Recent quotations</h2><p>Your latest activity at a glance.</p></div>{canAccessSection(currentUser, historySection) && <button className="text-button" onClick={() => onNavigate(historySection)}>View all <ArrowRight size={14} /></button>}</div>
          {quotations.length ? <div className="table-wrap">
            <table><thead><tr><th>QUOTE</th><th>CLIENT</th><th>CREATED BY</th><th>STATUS</th><th className="align-right">TOTAL INCL. VAT</th></tr></thead>
              <tbody>{quotations.slice(0, 5).map((quote) => <tr key={quote.id} onClick={canBuild ? () => onOpenQuote(quote) : undefined}>
                <td><b>{quote.number}</b><small>{quote.title}</small></td><td>{clientDisplayName(quote.clientSnapshot) || 'No client'}</td><td>{quote.createdBy || 'Not recorded'}</td><td><span className={statusTone(quote.status)}>{quote.status}</span></td><td className="align-right amount">{money(quote.totalCents)}</td>
              </tr>)}</tbody>
            </table>
          </div> : <EmptyState title="Your first quotation starts here" text="Add a client and choose your products to create a polished PDF." action={canBuild ? 'Create quotation' : undefined} onAction={onNew} />}
        </div>
        <div className="panel quick-panel">
          <div className="panel-heading"><div><h2>Quick actions</h2><p>Keep the work moving.</p></div><Sparkles size={17} className="muted-icon" /></div>
          {canBuild && <button className="quick-action" onClick={onNew}><span className="quick-icon red"><FilePlus2 size={17} /></span><span><b>Create a quotation</b><small>Build and export a PDF</small></span><ChevronRight size={16} /></button>}
          {canAccessSection(currentUser, 'packages') && <button className="quick-action" onClick={onManageProducts}><span className="quick-icon dark"><ShoppingBag size={17} /></span><span><b>Manage packages</b><small>Products and services</small></span><ChevronRight size={16} /></button>}
          {canAccessSection(currentUser, 'clients') && <button className="quick-action" onClick={() => onNavigate('clients')}><span className="quick-icon blue"><Users size={17} /></span><span><b>Manage clients</b><small>Keep customer details ready</small></span><ChevronRight size={16} /></button>}
          <div className="total-value"><span>QUOTATION VALUE</span><strong>{money(total)}</strong><small>Across {quotations.length} saved quotation{quotations.length === 1 ? '' : 's'}</small></div>
        </div>
      </section>
      {canAccessSection(currentUser, 'backup') && <div className="dashboard-bottom">
        <div className="tip-card"><div className="tip-icon"><ShieldCheck size={20} /></div><div><b>Your workspace is stored locally</b><p>Your clients, packages and quotations remain on this device. Create a backup regularly from Backup & Restore.</p></div><button onClick={() => onNavigate('backup')}>Open backups <ArrowRight size={14} /></button></div>
      </div>}
    </>
  )
}

function Builder({
  data,
  quote,
  existingQuote,
  currentUser,
  selectedOptionId,
  onSelectOption,
  generatedPdf,
  onViewGeneratedPdf,
  busy,
  savingDraft,
  onUpdate,
  onSelectClient,
  onSaveDraft,
  onGeneratePdf,
  onAddClient,
  onEditClient,
  onAddItemForm,
  onUseTemplate,
  onSaveTemplate,
}: {
  data: AppData
  quote: Quote
  currentUser: UserProfile
  selectedOptionId: string
  onSelectOption: (id: string) => void
  existingQuote: Quote | null
  generatedPdf: { filename: string } | null
  onViewGeneratedPdf: () => void
  busy: boolean
  savingDraft: boolean
  onUpdate: (patch: Partial<Quote>) => void
  onSelectClient: (id: string) => void
  onSaveDraft: () => Promise<void>
  onGeneratePdf: () => void
  onAddClient: () => void
  onEditClient: (client: Client) => void
  onAddItemForm: () => void
  onUseTemplate: (template: QuoteTemplate) => void
  onSaveTemplate: () => void
}) {
  const options = quoteOptions(quote)
  const option = options.find((entry) => entry.id === selectedOptionId) ?? options[0]
  const totals = calculateQuotePricing(option, data.settings.vatRate)
  const draftLabel = savingDraft ? 'Saving draft…' : 'Save draft'
  const pdfLabel = busy && !savingDraft ? 'Generating PDF…' : 'Generate PDF'
  function addOption() {
    const id = createId()
    let number = options.length + 1
    while (options.some((entry) => entry.name === `Option ${number}`)) number += 1
    onUpdate({ alternatives: [...(quote.alternatives ?? []), { id, name: `Option ${number}`, lines: [], discountType: 'none', discountValue: 0 }] })
    onSelectOption(id)
  }
  function renameOption(name: string) {
    if (!option.id) onUpdate({ primaryOptionName: name })
    else onUpdate({ alternatives: quote.alternatives?.map((entry) => entry.id === option.id ? { ...entry, name } : entry) })
  }
  function removeOption() {
    if (option.id) {
      onUpdate({ alternatives: quote.alternatives?.filter((entry) => entry.id !== option.id) })
    } else {
      const [replacement, ...alternatives] = quote.alternatives ?? []
      if (!replacement) return
      onUpdate({ primaryOptionName: replacement.name, lines: replacement.lines, pricing: replacement.pricing ?? {},
        discountType: replacement.discountType, discountValue: replacement.discountValue, alternatives })
    }
    onSelectOption('')
  }
  const client = data.clients.find((item) => item.id === quote.clientId)
  return (
    <>
      <div className="page-heading heading-split">
        <div><div className="eyebrow">QUOTE BUILDER · {quote.number}</div><h1>{existingQuote ? 'Edit quotation' : 'New quotation'}</h1><p>Build your item list and review once-off and monthly pricing before export.</p></div>
        <div className="heading-actions"><button className="button button-secondary" disabled={busy} onClick={() => void onSaveDraft()}><Check size={16} /> {draftLabel}</button><button className="button button-primary" onClick={onGeneratePdf} disabled={busy}><FileText size={16} /> {pdfLabel}</button></div>
      </div>
      <div className="builder-layout">
        <div className="builder-main">
          <section className="panel builder-section">
            <div className="section-title"><div><h2>Client & quotation details</h2><p>Choose who this proposal is prepared for.</p></div></div>
            <div className="form-grid form-grid-three">
              <label className="field span-two"><span>Client</span><div className="select-with-action"><select id="quote-client" value={quote.clientId} onChange={(event) => onSelectClient(event.target.value)}><option value="">Select a client…</option>{data.clients.filter((item) => !item.archived).map((item) => <option value={item.id} key={item.id}>{clientDisplayName(item)}</option>)}</select><button id="quote-add-client" className="mini-add" onClick={onAddClient} title="Add client"><Plus size={16} /></button></div></label>
              <label className="field"><span>Quotation title</span><input value={quote.title} onChange={(event) => onUpdate({ title: event.target.value })} /></label>
              <label className="field"><span>Issue date</span><input type="date" value={quote.issueDate} onChange={(event) => onUpdate({ issueDate: event.target.value })} /></label>
              <label className="field"><span>Valid until</span><input type="date" value={quote.validUntil} onChange={(event) => onUpdate({ validUntil: event.target.value })} /></label>
              <div className="client-summary span-three">{client ? <><div className="client-avatar">{quote.clientSnapshot.details?.logo ? <img src={quote.clientSnapshot.details.logo} alt="" /> : clientDisplayName(quote.clientSnapshot).slice(0, 1).toUpperCase()}</div><div><b>{clientDisplayName(quote.clientSnapshot)}</b><small>{[quote.clientSnapshot.contact, quote.clientSnapshot.email, quote.clientSnapshot.phone].filter(Boolean).join(' · ') || 'Client contact details can be edited in Clients.'}</small></div><button className="text-button" onClick={() => onEditClient(client)}>Edit details</button></> : <><Users size={17} /><span>Choose or add a client before generating the PDF.</span><button className="text-button" onClick={onAddClient}>Add client <Plus size={14} /></button></>}</div>
            </div>
            <QuoteCustomerDetails quote={quote} onUpdate={onUpdate} />
          </section>

          <section className="panel offer-options" aria-label="Offer options">
            <div className="offer-options-nav">
              {options.map((entry, index) => <button type="button" key={entry.id} className="button button-secondary button-compact"
                aria-pressed={entry.id === option.id} onClick={() => onSelectOption(entry.id)}>{entry.name || `Option ${index + 1}`}</button>)}
              <button type="button" className="button button-secondary button-compact" onClick={addOption}><Plus size={15} /> Add option</button>
              {!!quote.clientId && options.some((entry) => entry.lines.some((line) => !line.packageFeatures && line.name.trim() && line.quantity > 0)) &&
                <button type="button" className="button button-secondary button-compact" onClick={onSaveTemplate}>Save as template</button>}
              {!!data.quoteTemplates.length && <label className="field quick-template"><span>Quick quote from template</span>
                <select value="" onChange={(event) => {
                  const template = data.quoteTemplates.find((entry) => entry.id === event.target.value)
                  if (template) onUseTemplate(template)
                }}><option value="">Choose a template…</option>{data.quoteTemplates.map((template) =>
                  <option key={template.id} value={template.id}>{template.name}</option>)}</select>
              </label>}
            </div>
            {options.length > 1 && <div className="offer-option-edit">
              <label className="field"><span>Option name</span><input maxLength={55} value={option.name} onChange={(event) => renameOption(event.target.value)} /></label>
              <button type="button" className="button button-secondary button-compact" onClick={removeOption}>Remove option</button>
            </div>}
          </section>
          <QuoteWorkbench key={`${quote.id}:${option.id}`} data={data} lines={option.lines} totals={totals}
            makeLine={(item, includeAccessories) => makeLine(item, data.catalogue, includeAccessories)} onChange={(lines) => onUpdate({ lines })}
            onCustom={onAddItemForm} />

          <section className="panel builder-section">
            <div className="section-title"><div><h2>Notes & terms</h2><p>Add any relevant details for this proposal.</p></div></div>
            <label className="field"><span>Quote notes / scope of work</span><textarea rows={3} placeholder="Optional project notes. Leave blank to hide this section in the PDF." value={quote.notes} onChange={(event) => onUpdate({ notes: event.target.value })} /></label>
            <label className="field terms-field"><span>Quotation terms <small>Default ordering terms are included and saved with this quotation.</small></span><textarea rows={3} placeholder="Default ordering terms are applied automatically." value={quote.terms.map((term) => term.replace('|', ' — ')).join('\n')} onChange={(event) => onUpdate({ terms: event.target.value.split('\n').filter(Boolean) })} /></label>
          </section>
        </div>

        <aside className="builder-side">
          <div className="preview-card">
            <div className="preview-heading"><div><span className="eyebrow">INTERNAL SUMMARY</span><h3>{option.name || 'Quotation pricing'}</h3></div><Calculator size={19} /></div>
            <div className="preview-meta"><span>Quote number</span><b>{quote.number}</b></div>
            <div className="preview-meta"><span>Client</span><b>{clientDisplayName(quote.clientSnapshot) || 'Not selected'}</b></div>
            <div className="preview-meta"><span>Line items</span><b>{option.lines.length}</b></div>
            <div className="preview-divider" />
            <PaymentOptions key={`${quote.id}:${option.id}`} quote={{ ...quote, ...option }} totals={totals}
              vatRate={data.settings.vatRate} plans={data.settings.paymentPlans ?? DEFAULT_PAYMENT_PLANS} onUpdate={onUpdate} />
            <button className="button button-primary full-button" disabled={busy} onClick={() => void onSaveDraft()}><Check size={16} /> {draftLabel}</button>
            <button className="button button-dark full-button" disabled={busy} onClick={onGeneratePdf}><FileText size={16} /> {pdfLabel}</button>
            {generatedPdf && <button className="button button-secondary full-button" onClick={onViewGeneratedPdf}><FileText size={16} /> View generated PDF</button>}
            {quote.status === 'Draft' && <p className="auto-save-note">Drafts with items save automatically as you edit.</p>}
          </div>
          <PdfPreview quote={quote} settings={{ ...data.settings, preparedBy: currentUser.fullName }} />
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
        <div className="table-wrap"><table><thead><tr><th>COMPANY</th><th>CONTACT</th><th>EMAIL</th><th>PHONE</th><th>VAT NUMBER</th><th /></tr></thead><tbody>{clients.filter((client) => !client.archived).map((client) => <tr key={client.id}><td><b>{clientDisplayName(client)}</b><small>{[client.city, client.province].filter(Boolean).join(', ') || 'Location not set'}</small></td><td>{client.contact || '—'}</td><td>{client.email || '—'}</td><td>{client.phone || '—'}</td><td>{client.vatNumber || '—'}</td><td><div className="row-actions"><button className="table-action" onClick={() => onEdit(client)}>Edit</button><button className="table-action danger-link" onClick={() => onArchive(client)}>Archive</button></div></td></tr>)}</tbody></table>{!clients.some((client) => !client.archived) && <EmptyState title="No clients added yet" text="Create a client profile to automatically fill in quotation details." action="Add client" onAction={onAdd} />}</div>
        <div className="table-footer"><span>Client details are stored locally on this device.</span></div>
      </div>
    </>
  )
}

function HistoryPage({
  quotes,
  scope,
  search,
  status,
  creator,
  creators,
  dateRange,
  onDateRange,
  onSearch,
  onStatus,
  onCreator,
  onOpen,
  onExport,
  onStatusChange,
  onDuplicate,
  onNew,
}: {
  quotes: Quote[]
  scope: 'all' | 'mine'
  search: string
  status: string
  creator: string
  creators: string[]
  dateRange: { from: string; to: string }
  onDateRange: (value: { from: string; to: string }) => void
  onSearch: (value: string) => void
  onStatus: (value: string) => void
  onCreator: (value: string) => void
  onOpen: (quote: Quote) => void
  onExport: (quotes: Quote[], type: ReportType, format: 'xlsx' | 'csv') => Promise<void>
  onStatusChange: (quote: Quote, status: QuoteStatus) => void
  onDuplicate: (quote: Quote) => void
  onNew?: () => void
}) {
  const options = ['All statuses', 'Draft', 'Finalised', 'Sent', 'Accepted', 'Rejected', 'Expired', 'Cancelled']
  const [reportType, setReportType] = useState<ReportType>(reportTypes[0])
  const statusSelectRef = useRef<HTMLSelectElement>(null)
  const creatorSelectRef = useRef<HTMLSelectElement>(null)
  const invalidRange = Boolean(dateRange.from && dateRange.to && dateRange.from > dateRange.to)
  return (
    <>
      <div className="page-heading heading-split">
        <div><div className="eyebrow">{scope === 'mine' ? 'YOUR WORK' : 'SAVED QUOTATIONS'}</div><h1>{scope === 'mine' ? 'My quotations' : 'Quotation history'}</h1><p>{scope === 'mine' ? 'View and manage quotations you created.' : 'Search, review and manage all quotation records.'}</p></div>
        <div className="data-toolbar">
          {onNew && <button className="button button-primary" onClick={onNew}><Plus size={16} /> New quotation</button>}
          <label className="filter-field">
            <select aria-label="Report type" value={reportType} onChange={(event) => setReportType(event.target.value as ReportType)}>
              {reportTypes.map((type) => <option key={type}>{type}</option>)}
            </select>
          </label>
          <button className="button button-secondary" disabled={!quotes.length} onClick={() => void onExport(quotes, reportType, 'xlsx')}>
            <ArrowDownToLine size={16} /> Export spreadsheet
          </button>
          <button className="button button-secondary" disabled={!quotes.length} onClick={() => void onExport(quotes, reportType, 'csv')}>
            Export CSV
          </button>
        </div>
      </div>
      <div className="panel data-panel"><div className="data-toolbar"><label className="search-field"><Search size={16} /><input placeholder={scope === 'mine' ? 'Search quote #, client, title, date or total…' : 'Search quote #, client, title, creator, date or total…'} value={search} onChange={(event) => onSearch(event.target.value)} /></label><div className="filter-field"><ListFilter size={15} /><select ref={statusSelectRef} aria-label="Filter by quotation status" value={status} onChange={(event) => onStatus(event.target.value)}>{options.map((item) => <option key={item}>{item}</option>)}</select><button type="button" className="filter-arrow" aria-label="Open status filter" onClick={() => statusSelectRef.current?.showPicker()}><ChevronDown size={14} /></button></div>{scope === 'all' && <div className="filter-field"><ListFilter size={15} /><select ref={creatorSelectRef} aria-label="Filter by quotation creator" value={creator} onChange={(event) => onCreator(event.target.value)}><option>{ALL_HISTORY_CREATORS}</option><option value={UNRECORDED_HISTORY_CREATOR}>Not recorded</option>{creators.map((item) => <option key={item}>{item}</option>)}</select><button type="button" className="filter-arrow" aria-label="Open creator filter" onClick={() => creatorSelectRef.current?.showPicker()}><ChevronDown size={14} /></button></div>}</div>
        <div className="data-toolbar">
          <label className="field"><span>Issued from</span><input type="date" value={dateRange.from} max={dateRange.to || undefined} onChange={(event) => onDateRange({ ...dateRange, from: event.target.value })} /></label>
          <label className="field"><span>Issued through</span><input type="date" value={dateRange.to} min={dateRange.from || undefined} onChange={(event) => onDateRange({ ...dateRange, to: event.target.value })} /></label>
          <button className="button button-secondary" onClick={() => { onDateRange({ from: '', to: '' }); onStatus('All statuses'); if (scope === 'all') onCreator(ALL_HISTORY_CREATORS); onSearch('') }}>Clear filters</button>
          {invalidRange && <span role="alert">The end date must be on or after the start date.</span>}
        </div>
        <div className="table-wrap"><table><thead><tr><th>QUOTE</th><th>CLIENT</th>{scope === 'all' && <th>CREATED BY</th>}<th>ISSUED</th><th>VALID UNTIL</th><th>STATUS</th><th className="align-right">TOTAL INCL. VAT</th><th /></tr></thead><tbody>{quotes.map((quote) => <tr key={quote.id} onClick={() => onOpen(quote)}><td><b>{quote.number}</b><small>{quote.title}</small></td><td>{clientDisplayName(quote.clientSnapshot) || 'No client'}</td>{scope === 'all' && <td>{quote.createdBy || 'Not recorded'}</td>}<td>{quote.issueDate}</td><td>{quote.validUntil}</td><td><select className={statusTone(quote.status)} value={quote.status} onClick={(event) => event.stopPropagation()} onChange={(event) => void onStatusChange(quote, event.target.value as QuoteStatus)}>{options.slice(1).map((item) => <option key={item}>{item}</option>)}</select></td><td className="align-right amount">{money(quote.totalCents)}</td><td><button className="table-action" title="Duplicate quotation" onClick={(event) => { event.stopPropagation(); onDuplicate(quote) }}><Copy size={15} /></button></td></tr>)}</tbody></table>{!quotes.length && <EmptyState title={scope === 'mine' ? 'No quotations created by you yet' : 'No quotations to show'} text={scope === 'mine' ? 'Create your first quotation to see it here.' : 'Try changing your search or filters.'} action={scope === 'mine' && onNew ? 'Create quotation' : undefined} onAction={onNew} />}</div>
        <div className="table-footer"><span>{quotes.length} quotation{quotes.length === 1 ? '' : 's'} shown</span><span>{scope === 'mine' ? 'Only quotations you created are shown here.' : 'Saved quotations retain their client, item, tax and terms snapshots.'}</span></div>
      </div>
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
                <span>Client: {clientDisplayName(item.quote.clientSnapshot) || 'Not specified'}</span>
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

function BackupPage({ onExport, onImport }: { onExport: () => void; onImport: () => void }) {
  return (
    <>
      <div className="page-heading"><div><div className="eyebrow">DATA SAFETY</div><h1>Backup & restore</h1><p>Protect your local quotation data with a portable SQLite backup.</p></div></div>
      <div className="backup-grid">
        <section className="panel backup-card"><div className="backup-card-icon"><ArrowDownToLine size={20} /></div><span className="eyebrow">CREATE A COPY</span><h2>Back up your data</h2><p>Export your clients, packages, quotation history and settings into a SQLite database file.</p><button className="button button-primary" onClick={onExport}><ArrowDownToLine size={16} /> Create backup</button></section>
        <section className="panel backup-card"><div className="backup-card-icon pale"><Upload size={20} /></div><span className="eyebrow">RESTORE A COPY</span><h2>Restore a backup</h2><p>Choose a Techspire database file or a ZIP containing one database backup. Restore replaces your current local quotation data.</p><button className="button button-secondary" onClick={onImport}><Upload size={16} /> Choose backup file</button></section>
      </div>
      <div className="backup-warning"><ShieldCheck size={17} /><span>Keep backups in a secure location. Client information and commercial quotations are included in the exported file.</span></div>
    </>
  )
}

function ProductForm({ item, parent, accessoryParent, legacyProducts, busy, onSubmit }: {
  item: CatalogueItem | null
  parent?: QuotePackage
  accessoryParent: CatalogueItem | null
  legacyProducts: CatalogueItem[]
  busy: boolean
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  const [hourly, setHourly] = useState(item?.unit === 'hour')
  const [image, setImage] = useState(item?.imageDataUrl)
  const siblings = accessoryParent ? productAccessories(accessoryParent, legacyProducts)
    : parent ? packageProducts(parent, legacyProducts).map(({ item }) => item) : []
  const headings = [...new Set(siblings.map((sibling) => sibling.productGroup).filter(Boolean))]
  const action = item && parent ? 'Save changes' : accessoryParent ? 'Add feature' : parent ? 'Add product' : 'Add to quote'

  return <form className="modal-form" onSubmit={onSubmit}>
    {parent && <p className="modal-intro package-form-location">
      <span>{parent.name}</span>
      {accessoryParent && <><ChevronRight size={14} aria-hidden="true" /> <strong>{accessoryParent.name}</strong></>}
    </p>}
    <div className="form-grid form-grid-two"><div className="span-two"><ItemImage value={image} onChange={setImage} name={item?.name ?? (accessoryParent ? 'feature' : 'product')} /><input type="hidden" name="imageDataUrl" value={image ?? ''} /></div>
      <label className="field span-two"><span>{accessoryParent ? 'Feature name' : 'Product or service name'} <i>*</i></span><input name="name" required autoFocus defaultValue={item?.name} /></label>
      <label className="field span-two"><span>Description</span><textarea name="description" rows={3} defaultValue={item?.description} /></label>
      <label className="field"><span>{accessoryParent ? 'SKU / feature code' : 'SKU / product code'}</span><input name="sku" defaultValue={item?.sku} /></label>{parent && <>
      <label className="field"><span>{accessoryParent ? 'Feature heading' : 'Product heading'}</span><input name="productGroup" list="group-suggestions" placeholder={accessoryParent ? 'e.g. Paper feed' : 'e.g. Colour'} defaultValue={item?.productGroup} /><datalist id="group-suggestions">{headings.map((name) => <option key={name} value={name} />)}</datalist></label>{!accessoryParent && <label className="field"><span>Default quote quantity</span><input name="quantity" type="number" min="0.01" step="any" required defaultValue={parent.items.find((entry) => entry.itemId === item?.id)?.quantity ?? 1} /></label>}{accessoryParent && <label className="field span-two"><span>Single-choice group (optional)</span><input name="choiceGroup" defaultValue={item?.choiceGroup} /><small className="field-hint">The quote can include one feature from each single-choice group.</small></label>}</>}<label className="field"><span>Pricing type</span><select name="pricingType" value={hourly ? 'hourly' : 'fixed'} onChange={(event) => setHourly(event.target.value === 'hourly')}><option value="fixed">Fixed / per unit</option><option value="hourly">Hourly service (rate × hours)</option></select></label>
      <label className="field"><span>Unit of measurement</span><input name="unit" disabled={hourly} defaultValue={item?.unit && item.unit !== 'hour' ? item.unit : 'each'} /></label>{hourly && <p className="field-hint span-two">The quotation multiplies this rate by the hours entered.</p>}<label className="field span-two"><span>{hourly ? 'Hourly rate (ZAR)' : 'Once-off selling price (ZAR)'}</span><input name="price" type="number" min="0" step="0.01" required defaultValue={item?.pricingPending ? '' : item ? item.priceCents / 100 : '0.00'} /></label>
      <label className="field"><span>{hourly ? 'Hourly base cost ex. VAT (ZAR)' : 'Base cost ex. VAT (ZAR)'}</span><input name="cost" type="number" min="0" step="0.01" defaultValue={item?.costCents === undefined ? '' : item.costCents / 100} /></label>
      <label className="field"><span>Monthly selling price (ZAR)</span><input name="monthly" type="number" min="0" step="0.01" defaultValue={(item?.monthlyCents ?? 0) / 100} /></label>
      <label className="check-field span-two"><input name="priceIncludesVat" type="checkbox" /><span>Entered selling prices already include VAT (stored excluding VAT)</span></label>
      <label className="check-field span-two"><input name="vatApplicable" type="checkbox" defaultChecked={item?.vatApplicable ?? true} /><span>Apply VAT at the configured company rate</span></label></div>
    <div className="modal-actions">
      <button type="button" className="button button-secondary" onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))}>Cancel</button><button className="button button-primary" disabled={busy}><Check size={15} /> {action}</button>
    </div>
  </form>
}

function PackageForm({ categories, headings, item, busy, onSubmit }: { categories: string[]; headings: string[]; busy: boolean; item: QuotePackage | null; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const [image, setImage] = useState(item?.imageDataUrl)
  return <form className="modal-form" onSubmit={onSubmit}><div className="form-grid form-grid-two"><div className="span-two"><ItemImage value={image} onChange={setImage} name={item?.name ?? 'package'} /><input type="hidden" name="imageDataUrl" value={image ?? ''} /></div><label className="field span-two"><span>Package name <i>*</i></span><input name="name" required autoFocus placeholder="e.g. Office network setup" defaultValue={item?.name} /></label><label className="field span-two"><span>Description</span><textarea name="description" rows={2} defaultValue={item?.description} /></label><label className="field span-two"><span>Package heading</span><input name="category" list="package-category-suggestions" placeholder="e.g. Connectivity" defaultValue={item?.category} /><datalist id="package-category-suggestions">{[...new Set([...categories, ...headings])].map((category) => <option key={category} value={category} />)}</datalist></label></div><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))}>Cancel</button><button className="button button-primary" disabled={busy}><Check size={15} /> {item ? 'Save changes' : 'Create package'}</button></div></form>
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
            {quotations.map((item) => <option value={item.id} key={item.id}>{item.number} · {clientDisplayName(item.clientSnapshot)} · {item.title}</option>)}
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
