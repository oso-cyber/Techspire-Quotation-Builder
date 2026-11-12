export type Section =
  | 'dashboard'
  | 'builder'
  | 'catalogue'
  | 'packages'
  | 'templates'
  | 'clients'
  | 'history'
  | 'settings'
  | 'backup'

export type QuoteStatus =
  | 'Draft'
  | 'Finalised'
  | 'Sent'
  | 'Accepted'
  | 'Rejected'
  | 'Expired'
  | 'Cancelled'

export type DiscountType = 'none' | 'fixed' | 'percentage'

export interface Client {
  id: string
  name: string
  contact: string
  email: string
  phone: string
  address: string
  city: string
  province: string
  postalCode: string
  vatNumber: string
  archived: boolean
}

export interface CatalogueItem {
  id: string
  name: string
  description: string
  sku: string
  category: string
  unit: string
  priceCents: number
  vatApplicable: boolean
  active: boolean
}

export interface QuoteLine {
  id: string
  itemId: string | null
  unit?: string
  packageId?: string
  packageInstanceId?: string
  packageName?: string
  name: string
  description: string
  sku: string
  quantity: number
  unitPriceCents: number
  vatApplicable: boolean
}

export interface Quote {
  id: string
  number: string
  status: QuoteStatus
  title: string
  clientId: string
  clientSnapshot: Client
  lines: QuoteLine[]
  issueDate: string
  validUntil: string
  discountType: DiscountType
  discountValue: number
  notes: string
  terms: string[]
  subtotalCents: number
  discountCents: number
  vatCents: number
  totalCents: number
  createdAt: string
  exportedFilename: string
}

export interface QuoteTotals {
  subtotalCents: number
  discountCents: number
  taxableCents: number
  vatCents: number
  totalCents: number
  lineTotals: number[]
  vatByLine: number[]
}

export interface CompanySettings {
  name: string
  logoDataUrl: string
  registrationNumber: string
  vatNumber: string
  address: string
  phone: string
  email: string
  website: string
  preparedBy: string
  quotationPrefix: string
  validityDays: number
  vatRate: number
  paymentTerms: string
  warrantyTerms: string
  exclusions: string
  acceptanceWording: string
  defaultTerms: string[]
}

export const DEFAULT_ORDERING_TERMS = [
  'The following terms apply to this quotation unless otherwise agreed in writing by Techspire IT (Pty) Ltd and the client.',
  'Quotation validity|This quotation is valid until the date shown on the cover page. Pricing may be reviewed after expiry.',
  'Order placement|An order is accepted once Techspire IT receives a signed quotation or valid purchase order, together with any required deposit.',
  'Payment terms|A 50% deposit is required before procurement or scheduling. The remaining balance is payable on completion, unless otherwise agreed in writing.',
  'Pricing and VAT|All amounts are in South African rand. VAT is charged at the prevailing rate and is shown separately in the pricing schedule.',
  'Stock and lead times|Product availability and delivery dates remain subject to supplier stock confirmation at the time the order is placed.',
  'Scope changes|Changes to quantities, specifications, site conditions or scope may require a written variation and revised pricing.',
  'Installation access|The client must provide reasonable site access, electricity, secure working areas and any required internal approvals for the installation.',
  'Exclusions|Building work, electrical work, network upgrades, permits, access equipment and after-hours work are excluded unless specifically listed in the pricing schedule.',
  'Warranty|Equipment warranty is subject to the relevant manufacturer terms. Workmanship warranty applies only to installation work completed by Techspire IT and excludes misuse, third-party changes and external damage.',
  'Ownership and risk|Ownership of supplied goods remains with Techspire IT until full payment is received. Risk passes to the client upon delivery to site.',
  'Cancellation and returns|Cancellation, returns or exchanges are subject to written approval and may attract supplier, restocking, delivery or work-completed charges.',
  'Acceptance|Signing below confirms acceptance of the quotation, scope, pricing and ordering terms contained in this document.',
  'Thank you for the opportunity to submit this quotation.',
  'Note: These commercial terms are a practical quotation template and should be reviewed against Techspire IT’s approved legal terms before issue.',
]

export interface Package {
  id: string
  name: string
  description: string
  items: Array<{ itemId: string; quantity: number }>
}

export interface SmartTemplate {
  id: string
  name: string
  description: string
  inputLabel: string
  inputKey: string
  rules: Array<{ itemId: string; quantity: number; perInput: boolean }>
}

export interface QuoteTemplate {
  id: string
  name: string
  description: string
  quote: Quote
  createdAt: string
  updatedAt: string
}

export interface AppData {
  clients: Client[]
  catalogue: CatalogueItem[]
  quotations: Quote[]
  packages: Package[]
  templates: SmartTemplate[]
  quoteTemplates: QuoteTemplate[]
  settings: CompanySettings
}

export const DEFAULT_SETTINGS: CompanySettings = {
  name: 'Techspire IT (Pty) Ltd',
  logoDataUrl: '',
  registrationNumber: '2016/419585/07',
  vatNumber: '4710302359',
  address: '1060 Falkenstein Street, Peach Tree, Centurion, 0127',
  phone: '+27 12 030 1175',
  email: 'info@techspireit.co.za',
  website: 'www.techspireit.co.za',
  preparedBy: 'Praveen Naidoo',
  quotationPrefix: 'QT-',
  validityDays: 7,
  vatRate: 15,
  paymentTerms: '',
  warrantyTerms: '',
  exclusions: '',
  acceptanceWording: '',
  defaultTerms: DEFAULT_ORDERING_TERMS,
}

export const money = (cents: number) =>
  new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
  }).format(cents / 100)

export const centsFromInput = (value: string | number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0
}

export function catalogueNetPriceCents(
  inputCents: number,
  includesVat: boolean,
  vatApplicable: boolean,
  vatRate: number,
) {
  if (!includesVat || !vatApplicable) return inputCents
  return Math.round(inputCents / (1 + vatRate / 100))
}

export const today = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export const dateAfter = (date: string, days: number) => {
  const result = new Date(`${date}T12:00:00`)
  result.setDate(result.getDate() + days)
  return `${result.getFullYear()}-${String(result.getMonth() + 1).padStart(2, '0')}-${String(result.getDate()).padStart(2, '0')}`
}

export const dateLabel = (date: string) =>
  date
    ? new Intl.DateTimeFormat('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' }).format(
        new Date(`${date}T12:00:00`),
      )
    : ''

export function calculateTotals(
  lines: QuoteLine[],
  discountType: DiscountType,
  discountValue: number,
  vatRate: number,
): QuoteTotals {
  const lineTotals = lines.map((line) => Math.round(line.quantity * line.unitPriceCents))
  const subtotalCents = lineTotals.reduce((sum, total) => sum + total, 0)
  const requestedDiscount =
    discountType === 'fixed'
      ? Math.round(discountValue * 100)
      : discountType === 'percentage'
        ? Math.round((subtotalCents * discountValue) / 100)
        : 0
  const discountCents = Math.min(Math.max(0, requestedDiscount), subtotalCents)

  let distributedDiscount = 0
  const discountByLine = lineTotals.map((total, index) => {
    if (index === lineTotals.length - 1) return discountCents - distributedDiscount
    const share = subtotalCents > 0 ? Math.floor((discountCents * total) / subtotalCents) : 0
    distributedDiscount += share
    return share
  })
  const vatByLine = lines.map((line, index) =>
    line.vatApplicable ? Math.round(((lineTotals[index] - discountByLine[index]) * vatRate) / 100) : 0,
  )
  const taxableCents = lines.reduce(
    (sum, line, index) =>
      sum + (line.vatApplicable ? lineTotals[index] - discountByLine[index] : 0),
    0,
  )
  const vatCents = vatByLine.reduce((sum, value) => sum + value, 0)

  return {
    subtotalCents,
    discountCents,
    taxableCents,
    vatCents,
    totalCents: subtotalCents - discountCents + vatCents,
    lineTotals,
    vatByLine,
  }
}

export function createId() {
  return crypto.randomUUID()
}

export function createQuoteFromTemplate(
  template: QuoteTemplate,
  number: string,
  clients: Client[],
  settings: CompanySettings,
): Quote {
  const source = structuredClone(template.quote)
  const issueDate = today()
  const client = clients.find((item) => item.id === source.clientId && !item.archived)
  const packageInstances = new Map<string, string>()
  const lines = source.lines.map((line) => {
    const oldPackageInstanceId = line.packageInstanceId
    let packageInstanceId = oldPackageInstanceId
    if (oldPackageInstanceId) {
      packageInstanceId = packageInstances.get(oldPackageInstanceId) ?? createId()
      packageInstances.set(oldPackageInstanceId, packageInstanceId)
    }
    return { ...line, id: createId(), packageInstanceId }
  })
  const draft: Quote = {
    ...source,
    id: createId(),
    number,
    status: 'Draft',
    clientId: client?.id ?? '',
    clientSnapshot: client ? { ...client } : source.clientSnapshot,
    lines,
    issueDate,
    validUntil: dateAfter(issueDate, settings.validityDays),
    createdAt: new Date().toISOString(),
    exportedFilename: '',
  }
  const totals = calculateTotals(draft.lines, draft.discountType, draft.discountValue, settings.vatRate)
  return {
    ...draft,
    subtotalCents: totals.subtotalCents,
    discountCents: totals.discountCents,
    vatCents: totals.vatCents,
    totalCents: totals.totalCents,
  }
}
