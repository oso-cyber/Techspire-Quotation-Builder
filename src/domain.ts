import { DEFAULT_PAYMENT_PLANS, paymentFactor, type PaymentPlan } from './paymentPlans'

export type Section =
  | 'dashboard'
  | 'builder'
  | 'catalogue'
  | 'packages'
  | 'templates'
  | 'clients'
  | 'my-quotes'
  | 'history'
  | 'settings'
  | 'backup'
  | 'users'

export type QuoteStatus =
  | 'Draft'
  | 'Finalised'
  | 'Sent'
  | 'Accepted'
  | 'Rejected'
  | 'Expired'
  | 'Cancelled'

export type DiscountType = 'none' | 'fixed' | 'percentage'

export interface ClientDetails {
  title?: string
  mobile?: string
  position?: string
  department?: string
  fax?: string
  alternateTitle?: string
  alternateName?: string
  alternatePhone?: string
  alternateMobile?: string
  alternateEmail?: string
  alternatePosition?: string
  website?: string
  registeredName?: string
  registrationNumber?: string
  accountNumber?: string
  coordinates?: string
  country?: string
  region?: string
  area?: string
  sector?: string
  logo?: string
  tags?: string
  postalAddress?: string
  currency?: string
}

export interface QuoteDetails {
  rating?: number
  expectedClosure?: string
  reference?: string
  privateNotes?: string
}

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
  details?: ClientDetails
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
  costCents?: number
  monthlyCents?: number
  minimumQuantity?: number
  imageDataUrl?: string
  featureItemIds?: string[]
  productGroup?: string
  choiceGroup?: string
  pricingPending?: boolean
  accessories?: CatalogueItem[]
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
  costCents?: number
  monthlyCents?: number
  minimumQuantity?: number
  imageDataUrl?: string
  featureChoices?: CatalogueItem[]
  packageFeatures?: Array<{ item: CatalogueItem; quantity: number }>
  packageCategory?: string
  accessoryForId?: string
  catalogueFeature?: boolean
  customFeature?: boolean
}

export type PaymentOption = 'cash' | PaymentPlan
export type QuotePriceAdjustment = 'markup' | 'margin' | 'profit' | 'fixed'

export interface QuotePricing {
  plan?: PaymentPlan
  paymentOptions?: PaymentOption[]
  adjustment?: QuotePriceAdjustment
  value?: number
  markupPercent?: number
  marginPercent?: number
  percentageBasis?: 'markup' | 'margin'
  fixedSalesPriceCents?: number
  additionalGpCents?: number
  settlementCents?: number
  excludeVat?: boolean
  foldSettlement?: boolean
  hideAccessories?: boolean
  hideLinePrices?: boolean
  showCallRates?: boolean
  localCallRate?: string
  cellularCallRate?: string
}

export interface QuoteOption {
  id: string
  name: string
  lines: QuoteLine[]
  pricing?: QuotePricing
  discountType: DiscountType
  discountValue: number
}

export interface QuotePricingTotals {
  priceBasis: string
  baseCents: number
  profitCents: number
  effectiveMarkupPercent: number | null
  effectiveMarginPercent: number | null
  hasCompleteBaseCosts: boolean
  subtotalCents: number
  discountCents: number
  taxableCents: number
  vatCents: number
  totalCents: number
  netSaleCents: number
  settlementCents: number
  dueCents: number
  monthlyCents: number
  factor: number | null
  financedCents: number
  financeVatCents: number
  secondYearMonthlyCents: number | null
  rate: number
  lineTotals: number[]
  vatByLine: number[]
  recurring: {
    subtotalCents: number
    taxableCents: number
    vatCents: number
    totalCents: number
    lineTotals: number[]
    vatByLine: number[]
  }
}

export interface QuotePayment {
  payment: PaymentOption
  totals: QuotePricingTotals
}

export interface Quote {
  id: string
  number: string
  status: QuoteStatus
  title: string
  clientId: string
  clientSnapshot: Client
  lines: QuoteLine[]
  primaryOptionName?: string
  alternatives?: QuoteOption[]
  pricing?: QuotePricing
  details?: QuoteDetails
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
  createdBy?: string
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
  paymentPlans: PaymentPlan[]
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
  category?: string
  imageDataUrl?: string
  items: Array<{ itemId: string; quantity: number; product?: CatalogueItem }>
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
  paymentPlans: DEFAULT_PAYMENT_PLANS,
}

export const DEFAULT_CALL_RATES = {
  localCallRate: '35c per minute',
  cellularCallRate: '75c per minute',
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
  const discountByLine = allocateCents(discountCents, lineTotals, lines.map((line) => line.id))
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

function allocateCents(total: number, weights: number[], stableKeys: string[] = []) {
  if (!weights.length) return []
  const safeWeights = weights.map((weight) => Math.max(0, Number.isFinite(weight) ? weight : 0))
  const weightTotal = safeWeights.reduce((sum, weight) => sum + weight, 0)
  if (weightTotal <= 0) {
    const even = Math.floor(total / weights.length)
    return weights.map((_, index) => even + (index < total - even * weights.length ? 1 : 0))
  }
  const quotas = safeWeights.map((weight) => (Math.max(0, total) * weight) / weightTotal)
  const allocated = quotas.map(Math.floor)
  let remainder = Math.max(0, total) - allocated.reduce((sum, value) => sum + value, 0)
  const order = quotas.map((quota, index) => ({ index, fraction: quota - allocated[index] }))
    .sort((left, right) =>
      right.fraction - left.fraction ||
      (stableKeys[left.index] ?? String(left.index)).localeCompare(stableKeys[right.index] ?? String(right.index)),
    )
  for (let index = 0; index < order.length && remainder > 0; index += 1, remainder -= 1) {
    allocated[order[index].index] += 1
  }
  return allocated
}

function lineUnitBase(line: QuoteLine) {
  return Math.max(0, line.costCents ?? line.unitPriceCents)
}

function lineRawAmounts(lines: QuoteLine[]) {
  return lines.map((line) => line.packageFeatures ? 0 : Math.max(0, Math.round(line.quantity * line.unitPriceCents)))
}

function quoteLineTaxTotals(lines: QuoteLine[], lineTotals: number[], discountType: DiscountType, discountValue: number, vatRate: number, includeVat: boolean) {
  const subtotalCents = lineTotals.reduce((sum, amount) => sum + amount, 0)
  const requestedDiscount = discountType === 'fixed'
    ? Math.round(Math.max(0, discountValue) * 100)
    : discountType === 'percentage'
      ? Math.round(subtotalCents * Math.max(0, discountValue) / 100)
      : 0
  const discountCents = Math.min(subtotalCents, requestedDiscount)
  const discountByLine = allocateCents(discountCents, lineTotals, lines.map((line) => line.id))
  const taxableLineTotals = lineTotals.map((amount, index) => Math.max(0, amount - discountByLine[index]))
  const taxableCents = taxableLineTotals.reduce((sum, amount, index) =>
    sum + (includeVat && lines[index].vatApplicable ? amount : 0), 0)
  const vatByLine = taxableLineTotals.map((amount, index) =>
    includeVat && lines[index].vatApplicable ? Math.round(amount * vatRate / 100) : 0)
  const vatCents = vatByLine.reduce((sum, amount) => sum + amount, 0)
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

function settingsForPricing(quote: Pick<Quote, 'pricing'>) {
  return quote.pricing ?? {}
}

export function quotePricingInputs(pricing: Partial<QuotePricing> = {}) {
  let percentageBasis = pricing.percentageBasis
  let markupPercent = pricing.markupPercent
  let marginPercent = pricing.marginPercent
  let fixedSalesPriceCents = pricing.fixedSalesPriceCents
  if (pricing.adjustment === 'fixed' && fixedSalesPriceCents === undefined && pricing.value !== undefined) {
    fixedSalesPriceCents = Math.max(0, Math.round(pricing.value * 100))
  } else if (pricing.adjustment === 'markup' && markupPercent === undefined && pricing.value !== undefined) {
    percentageBasis = 'markup'
    markupPercent = pricing.value
  } else if (pricing.adjustment === 'margin' && marginPercent === undefined && pricing.value !== undefined) {
    percentageBasis = 'margin'
    marginPercent = pricing.value
  } else if (pricing.adjustment === 'profit' && pricing.additionalGpCents === undefined &&
    markupPercent === undefined && pricing.value !== undefined) {
    percentageBasis = 'markup'
    markupPercent = pricing.value / 10
  }
  if (fixedSalesPriceCents !== undefined) {
    markupPercent = undefined
    marginPercent = undefined
  } else if (percentageBasis === 'margin' && marginPercent === undefined && markupPercent !== undefined) {
    percentageBasis = 'markup'
  } else if (percentageBasis === 'margin' && marginPercent !== undefined) {
    marginPercent = Math.min(99.99, Math.max(0, marginPercent))
    markupPercent = (marginPercent / (100 - marginPercent)) * 100
  } else if (percentageBasis === 'markup' && markupPercent !== undefined) {
    markupPercent = Math.max(0, markupPercent)
    marginPercent = (markupPercent / (100 + markupPercent)) * 100
  }
  return {
    markupPercent,
    marginPercent,
    percentageBasis,
    fixedSalesPriceCents,
    additionalGpCents: Math.max(0, pricing.additionalGpCents ?? 0),
  }
}

export function calculateQuotePricing(
  quote: Pick<Quote, 'lines' | 'discountType' | 'discountValue' | 'pricing'>,
  vatRate: number,
): QuotePricingTotals {
  const pricing = settingsForPricing(quote)
  const inputs = quotePricingInputs(pricing)
  const lines = quote.lines
  const rawLineTotals = lineRawAmounts(lines)
  const hasCompleteBaseCosts = lines.some((line) => !line.packageFeatures) &&
    lines.filter((line) => !line.packageFeatures).every((line) => line.costCents !== undefined)
  const baseCents = lines.reduce((sum, line) =>
    sum + (line.packageFeatures ? 0 : Math.max(0, Math.round(line.quantity * (line.costCents ?? 0)))), 0)
  const fixedPrice = inputs.fixedSalesPriceCents !== undefined
  const priceBasis = fixedPrice
    ? 'fixed sales price'
    : inputs.percentageBasis === 'margin' && inputs.marginPercent !== undefined
      ? 'margin'
      : inputs.markupPercent !== undefined
        ? 'markup'
        : 'line prices'
  let lineTotals: number[]
  let discountType = quote.discountType
  let discountValue = quote.discountValue
  let settlementCents = Math.max(0, pricing.settlementCents ?? 0)

  if (fixedPrice) {
    const target = Math.max(0, inputs.fixedSalesPriceCents!)
    settlementCents = Math.min(settlementCents, target)
    const grossForItems = target - settlementCents
    const baseWeights = rawLineTotals.map((amount, index) => amount || lineUnitBase(lines[index]) * Math.max(0, lines[index].quantity))
    if (pricing.excludeVat) {
      lineTotals = allocateCents(grossForItems, baseWeights)
    } else {
      let low = 0
      let high = grossForItems
      while (low < high) {
        const middle = Math.ceil((low + high) / 2)
        const parts = allocateCents(middle, baseWeights)
        const vat = parts.reduce((sum, amount, index) =>
          sum + (lines[index].vatApplicable ? Math.round(amount * vatRate / 100) : 0), 0)
        if (middle + vat <= grossForItems) low = middle
        else high = middle - 1
      }
      lineTotals = allocateCents(low, baseWeights, lines.map((line) => line.vatApplicable ? '1' : '0'))
    }
    discountType = 'none'
    discountValue = 0
  } else {
    const percentage = inputs.percentageBasis === 'margin'
      ? inputs.marginPercent
      : inputs.markupPercent
    const adjustment = percentage ?? 0
    lineTotals = lines.map((line) => {
      if (line.packageFeatures) return 0
      const quantity = Math.max(0, line.quantity)
      const unitBase = lineUnitBase(line)
      let unitSale = line.unitPriceCents
      if (percentage !== undefined && (line.costCents !== undefined || pricing.adjustment === 'profit')) {
        unitSale = inputs.percentageBasis === 'margin'
          ? Math.round(unitBase / (1 - adjustment / 100))
          : Math.round(unitBase * (1 + adjustment / 100))
      }
      return Math.max(0, Math.round(quantity * unitSale))
    })
    if (inputs.additionalGpCents > 0) {
      const eligibleIndexes = lines.flatMap((line, index) => line.packageFeatures ? [] : [index])
      if (eligibleIndexes.length) {
        const gp = allocateCents(inputs.additionalGpCents, eligibleIndexes.map((index) => lineTotals[index]))
        lineTotals = lineTotals.map((amount, index) => {
          const eligibleIndex = eligibleIndexes.indexOf(index)
          return amount + (eligibleIndex < 0 ? 0 : gp[eligibleIndex])
        })
      }
    }
  }

  const totals = quoteLineTaxTotals(lines, lineTotals, discountType, discountValue, vatRate, !pricing.excludeVat)
  if (!fixedPrice && inputs.additionalGpCents > 0 && lines.every((line) => line.packageFeatures)) {
    totals.subtotalCents += inputs.additionalGpCents
    totals.totalCents += inputs.additionalGpCents
  }
  if (fixedPrice) {
    totals.vatCents = Math.max(0, inputs.fixedSalesPriceCents! - settlementCents - totals.subtotalCents)
    totals.vatByLine = allocateCents(
      totals.vatCents,
      lineTotals.map((amount, index) => lines[index].vatApplicable ? amount : 0),
    )
    totals.taxableCents = lineTotals.reduce((sum, amount, index) =>
      sum + (lines[index].vatApplicable && !pricing.excludeVat ? amount : 0), 0)
    totals.totalCents = inputs.fixedSalesPriceCents!
  }
  const monthlyLineTotals = lines.map((line) => line.packageFeatures
    ? 0
    : Math.max(0, Math.round(line.quantity * (line.monthlyCents ?? 0))))
  const recurring = quoteLineTaxTotals(lines, monthlyLineTotals, 'none', 0, vatRate, !pricing.excludeVat)
  const netSaleCents = Math.max(0, totals.subtotalCents - totals.discountCents)
  const profitCents = netSaleCents - baseCents
  const effectiveMarkupPercent = baseCents > 0 ? (profitCents / baseCents) * 100 : 0
  const effectiveMarginPercent = netSaleCents > 0 ? (profitCents / netSaleCents) * 100 : 0
  const plan = pricing.plan
  const financeBasisCents = netSaleCents + settlementCents
  const factor = plan ? paymentFactor(plan, financeBasisCents) : null
  const financedCents = factor === null ? 0 : Math.round(financeBasisCents * factor)
  const financeVatCents = pricing.excludeVat || factor === null
    ? 0
    : Math.round(Math.round(netSaleCents * factor) * vatRate / 100)
  const monthlyCents = plan
    ? (factor === null ? 0 : financedCents + financeVatCents) + recurring.totalCents
    : recurring.totalCents
  const secondYearMonthlyCents = plan && factor !== null
    ? Math.round((financedCents + financeVatCents) * (1 + plan.escalation / 100)) + recurring.totalCents
    : null
  return {
    priceBasis,
    baseCents,
    profitCents,
    effectiveMarkupPercent,
    effectiveMarginPercent,
    hasCompleteBaseCosts,
    subtotalCents: totals.subtotalCents,
    discountCents: totals.discountCents,
    taxableCents: totals.taxableCents,
    vatCents: totals.vatCents,
    totalCents: totals.totalCents,
    netSaleCents,
    settlementCents,
    dueCents: fixedPrice
      ? Math.max(0, totals.totalCents)
      : Math.max(0, totals.totalCents + settlementCents),
    monthlyCents,
    factor,
    financedCents,
    financeVatCents,
    secondYearMonthlyCents,
    rate: vatRate,
    lineTotals: totals.lineTotals,
    vatByLine: totals.vatByLine,
    recurring,
  }
}

export function quotePaymentOptions(pricing?: QuotePricing): PaymentOption[] {
  if (pricing?.paymentOptions) return pricing.paymentOptions
  return pricing?.plan ? [pricing.plan] : []
}

export function calculateOfferPayments(
  quote: Pick<Quote, 'lines' | 'discountType' | 'discountValue' | 'pricing'>,
  vatRate: number,
): QuotePayment[] {
  const selected = quotePaymentOptions(quote.pricing)
  return selected.map((payment) => {
    const pricing = quote.pricing ?? {}
    const nextPricing: QuotePricing = {
      ...pricing,
      plan: payment === 'cash' ? undefined : payment,
    }
    return {
      payment,
      totals: calculateQuotePricing({ ...quote, pricing: nextPricing }, vatRate),
    }
  })
}

export function quoteOptions(quote: Quote): QuoteOption[] {
  return [
    {
      id: '',
      name: quote.primaryOptionName || quote.title || 'Quotation',
      lines: quote.lines,
      pricing: quote.pricing,
      discountType: quote.discountType,
      discountValue: quote.discountValue,
    },
    ...(quote.alternatives ?? []),
  ]
}

export function clientDisplayName(client: Client) {
  return client.details?.registeredName?.trim() || client.name.trim()
}

export const ALL_HISTORY_CREATORS = 'All creators'
export const UNRECORDED_HISTORY_CREATOR = '__not_recorded__'

export function filterQuoteHistory(quotes: Quote[], search: string, status: string, creatorFilter: string, issueDateFrom = '', issueDateTo = '') {
  const query = search.trim().toLowerCase()
  return quotes.filter((quote) => {
    const searchable = [
      quote.number,
      quote.title,
      clientDisplayName(quote.clientSnapshot),
      quote.clientSnapshot.contact,
      quote.clientSnapshot.email,
      quote.clientSnapshot.phone,
      quote.createdBy ?? '',
      quote.status,
      quote.issueDate,
      quote.validUntil,
      String(quote.totalCents),
      money(quote.totalCents),
    ].join(' ').toLowerCase()
    const matchesText = !query || searchable.includes(query)
    const matchesStatus = status === 'All statuses' || quote.status === status
    const creator = quote.createdBy?.trim() ?? ''
    const matchesCreator = creatorFilter === ALL_HISTORY_CREATORS ||
      (creatorFilter === UNRECORDED_HISTORY_CREATOR ? !creator : creator === creatorFilter)
    const matchesDates = (!issueDateFrom || quote.issueDate >= issueDateFrom) &&
      (!issueDateTo || (Boolean(quote.issueDate) && quote.issueDate <= issueDateTo))
    return matchesText && matchesStatus && matchesCreator && matchesDates
  })
}

export function filterMyQuotes(quotes: Quote[], creator: string, search: string, status: string, issueDateFrom = '', issueDateTo = '') {
  const owner = creator.trim()
  return owner
    ? filterQuoteHistory(quotes, search, status, owner, issueDateFrom, issueDateTo)
    : []
}

export function missingClientFields(client: Client) {
  return [
    ['position', client.details?.position],
    ['physical address', client.address],
  ].filter(([, value]) => !String(value ?? '').trim()).map(([label]) => label)
}

export function matchesCatalogueItem(item: CatalogueItem, search: string) {
  const query = search.trim().toLowerCase()
  return !query || `${item.name} ${item.sku} ${item.description} ${item.category} ${item.productGroup ?? ''}`.toLowerCase().includes(query)
}

export function catalogueCategories(items: CatalogueItem[]) {
  return ['All categories', ...new Set(items.map((item) => item.category).filter(Boolean).sort((a, b) => a.localeCompare(b)))]
}

export function supportsProductAccessories(category: string) {
  return category.trim().toLowerCase() === 'office automation'
}

export function packageCategory(item: Package, catalogue: CatalogueItem[]) {
  if (item.category?.trim()) return item.category.trim()
  return item.items.map((entry) => entry.product?.category ?? catalogue.find((product) => product.id === entry.itemId)?.category)
    .find((category): category is string => !!category) ?? 'General'
}

export function packageProducts(item: Package, catalogue: CatalogueItem[]) {
  return item.items.flatMap((entry) => {
    const product = entry.product ?? catalogue.find((candidate) => candidate.id === entry.itemId)
    return product && !product.pricingPending ? [{ item: product, quantity: entry.quantity }] : []
  })
}

export function createPackageLine(item: Package, catalogue: CatalogueItem[]): QuoteLine {
  const packageInstanceId = createId()
  return {
    id: createId(),
    itemId: null,
    packageId: item.id,
    packageInstanceId,
    packageName: item.name,
    name: item.name,
    description: item.description,
    sku: '',
    quantity: 1,
    unitPriceCents: 0,
    vatApplicable: true,
    packageCategory: packageCategory(item, catalogue),
    imageDataUrl: item.imageDataUrl,
    packageFeatures: packageProducts(item, catalogue).map(({ item: product, quantity }) => ({
      item: { ...product },
      quantity,
    })),
  }
}

export function copyQuoteLines(lines: QuoteLine[]) {
  const ids = new Map(lines.map((line) => [line.id, createId()]))
  const packageIds = new Map<string, string>()
  return lines.map((line) => {
    let packageInstanceId = line.packageInstanceId
    if (packageInstanceId) {
      packageInstanceId = packageIds.get(packageInstanceId) ?? createId()
      packageIds.set(line.packageInstanceId!, packageInstanceId)
    }
    return {
      ...structuredClone(line),
      id: ids.get(line.id)!,
      packageInstanceId,
      accessoryForId: line.accessoryForId ? ids.get(line.accessoryForId) : undefined,
    }
  })
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
