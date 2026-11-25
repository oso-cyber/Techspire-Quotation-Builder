import { describe, expect, it } from 'vitest'
import { calculateOfferPayments, DEFAULT_SETTINGS, money, type Quote } from './domain'
import { createQuotationPdf, quotationFilename } from './quotationPdf'
import { quotationReport } from './quotationReports'
import { DEFAULT_PAYMENT_PLANS } from './paymentPlans'
import productPhoto from './assets/techspire-logo.png?inline'
import printerPhoto from './assets/reference-printers/c3301i.jpg?inline'

function makeQuote(overrides: Partial<Quote> = {}): Quote {
  const client = {
    id: 'client-1',
    name: 'Mapei South Africa',
    contact: '',
    email: 'accounts@example.invalid',
    phone: '',
    address: '50 Smith Road',
    city: 'Germiston',
    province: 'Gauteng',
    postalCode: '1401',
    vatNumber: '',
    archived: false,
  }
  const referenceItems = [
    ['Hikvision 32-Channel AcuSense NVR, DS-7732NXI-I4/S(STD)(E)', 1, 1_890_000],
    ['Hikvision 4MP Smart Hybrid Light with ColorVu Fixed Mini Bullet Network Camera', 32, 440_000],
    ['8TB Surveillance Hard Drive', 2, 990_000],
    ['Network Points (Cat6)', 32, 250_000],
    ['128GB SD Cards - Micro', 32, 99_000],
    ['Consumables', 1, 1_500_000],
    ['Delivery, Installation & Configuration', 1, 6_500_000],
  ] as const
  const lines = referenceItems.map(([name, quantity, unitPriceCents], index) => ({
    id: `line-${index}`,
    itemId: null,
    name,
    description: '',
    sku: '',
    quantity,
    unitPriceCents,
    vatApplicable: true,
  }))
  const subtotalCents = lines.reduce((sum, item) => sum + Math.round(item.quantity * item.unitPriceCents), 0)
  const vatCents = Math.round(subtotalCents * 0.15)
  return {
    id: 'quote-1',
    number: 'QT-2026-099',
    status: 'Draft',
    title: 'CCTV Surveillance',
    clientId: client.id,
    clientSnapshot: client,
    lines,
    pricing: { paymentOptions: ['cash'] },
    issueDate: '2026-09-14',
    validUntil: '2026-09-21',
    discountType: 'none',
    discountValue: 0,
    notes: '',
    terms: [],
    subtotalCents,
    discountCents: 0,
    vatCents,
    totalCents: subtotalCents + vatCents,
    createdAt: '2026-09-14T00:00:00.000Z',
    exportedFilename: '',
    ...overrides,
  }
}

function pageContent(pdf: ReturnType<typeof createQuotationPdf>, page: number) {
  // jsPDF's declarations type the internal command buffers as numbers.
  const pages = pdf.internal.pages as unknown as string[][]
  return pages[page].join('\n')
}

describe('quotation PDF', () => {
  it('keeps each named offer and its own payment plans together in the PDF', () => {
    const original = makeQuote()
    const plan = DEFAULT_PAYMENT_PLANS.find((entry) => entry.id === '36-0')!
    const quote = makeQuote({
      clientSnapshot: { ...original.clientSnapshot, contact: 'John Smith' },
      primaryOptionName: 'Standard bundle',
      lines: [{ ...original.lines[0], name: 'Standard router', description: 'Dual-band Wi-Fi with remote management.', unitPriceCents: 100_000, imageDataUrl: printerPhoto }],
      pricing: { paymentOptions: [plan] },
      alternatives: [{
        id: 'plus', name: 'Premium bundle', discountType: 'none', discountValue: 0,
        pricing: { paymentOptions: ['cash'] },
        lines: [{ ...original.lines[0], name: 'Premium router', description: 'Includes on-site configuration.', unitPriceCents: 200_000 }],
      }],
    })
    const pdf = createQuotationPdf(quote, DEFAULT_SETTINGS)
    const body = pdf.output()
    expect(pdf.getNumberOfPages()).toBe(5)
    expect(body.includes('Option 1 - Standard bundle')).toBe(true)
    expect(body.includes('Option 2 - Premium bundle')).toBe(true)
    expect(body.includes('Standard router')).toBe(true)
    expect(body.includes('Premium router')).toBe(true)
    expect(body.includes('Selected offer option')).toBe(true)
    const introduction = pageContent(pdf, 2)
    expect(introduction).toContain('50 Smith Road')
    expect(introduction).toContain('FOR ATTENTION: JOHN SMITH')
    expect(introduction).toContain('Dear John Smith,')
    expect(introduction).toContain('Kind regards,')
    expect(introduction).toContain(DEFAULT_SETTINGS.preparedBy)
    expect(introduction).toContain("Techspire IT's products and services")
    const firstOffer = pageContent(pdf, 3)
    const secondOffer = pageContent(pdf, 4)
    expect(firstOffer).toContain('Dual-band Wi-Fi with remote management.')
    expect(firstOffer.indexOf('Standard router')).toBeLessThan(firstOffer.indexOf('Dual-band Wi-Fi'))
    expect(firstOffer.indexOf('Dual-band Wi-Fi')).toBeLessThan(firstOffer.indexOf('PAYMENT OPTIONS'))
    expect(firstOffer).toContain('36 months')
    expect(firstOffer).toContain('Starting monthly total')
    expect(firstOffer).not.toContain('CASH TOTAL')
    expect(secondOffer.indexOf('Premium router')).toBeLessThan(secondOffer.indexOf('Includes on-site configuration.'))
    expect(secondOffer.indexOf('Includes on-site configuration.')).toBeLessThan(secondOffer.indexOf('PAYMENT OPTIONS'))
    expect(secondOffer).toContain('CASH TOTAL')
    expect(secondOffer).not.toContain('36 months')
    expect(body.match(/\/I0 Do/g)).toHaveLength(5)
    expect(body.match(/\/I1 Do/g)).toHaveLength(1)
  })
  it('includes summary, item, and payment records in the combined export', () => {
    const quote = makeQuote({ pricing: { plan: DEFAULT_PAYMENT_PLANS.find((plan) => plan.id === '36-5') } })
    const csv = quotationReport([quote], 'Combined detail', 15)
    expect(csv).toContain('"Record type","Offer name"')
    expect(csv.match(/"Quotation summary"/g)).toHaveLength(1)
    expect(csv).toContain('"Quoted items"')
    expect(csv).toContain('"Payment options"')
    for (const layout of ['Quotation summary', 'Quoted items', 'Payment options', 'Combined detail'] as const) {
      const report = quotationReport([{ ...quote, title: 'An offer; with "quotes"' }], layout, 15)
      const [heading, ...records] = report.trimEnd().split('\r\n')
      expect(heading).toMatch(/^\uFEFF"Quote number",/)
      const columnCount = (row: string) => row.match(/"(?:[^"]|"")*"|[^,"]+|,/g)?.filter((token) => token === ',').length
      expect(heading).toContain('"Quotation status"')
      expect(records.length).toBeGreaterThan(0)
      expect(records.every((row) => columnCount(row) === columnCount(heading))).toBe(true)
    }
  })
  it('prints the selected plan, recurring charges and escalation below the products', () => {
    const quote = makeQuote({ pricing: { plan: DEFAULT_PAYMENT_PLANS.find((plan) => plan.id === '36-5') } })
    quote.lines[0].monthlyCents = 45_500
    const pdf = createQuotationPdf(quote, DEFAULT_SETTINGS)
    const body = pageContent(pdf, 3)
    expect(pdf.getNumberOfPages()).toBe(4)
    expect(pageContent(pdf, 2)).toContain('Dear Mapei South Africa,')
    expect(body).toContain('PAYMENT OPTIONS')
    expect(body.indexOf('Delivery, Installation')).toBeLessThan(body.indexOf('PAYMENT OPTIONS'))
    expect(body).toContain('Finance payment ex. VAT')
    expect(body).toContain('Recurring services ex. VAT')
    expect(body).toContain('Starting monthly total')
    expect(body).toContain('Monthly total from month 13')
    expect(body).toContain('Annual escalation applies to the finance payment.')
    expect(pdf.output()).not.toContain('50% deposit is required before procurement')
  })
  it('shows every selected finance plan and omits the cash amounts and line prices', () => {
    const plans = DEFAULT_PAYMENT_PLANS.filter((plan) => ['36-5', '48-0'].includes(plan.id))
    const quote = makeQuote({ pricing: { paymentOptions: plans, settlementCents: 100_000, hideLinePrices: false } })
    quote.lines[0].imageDataUrl = productPhoto
    quote.lines[0].monthlyCents = 45_500
    const pdf = createQuotationPdf(quote, DEFAULT_SETTINGS)
    const body = pdf.output()
    expect(body).toContain('36 months')
    expect(body).toContain('48 months')
    const amounts = [...body.matchAll(/\((R[^)]+)\) Tj/g)].map(([, amount]) => amount)
    for (const { totals } of calculateOfferPayments(quote, DEFAULT_SETTINGS.vatRate)) {
      expect(amounts).toContain(money(totals.monthlyCents))
      expect(amounts).not.toContain(money(totals.dueCents))
    }
    expect(body).toContain('Selected payment option')
    expect(body).not.toContain('CASH TOTAL')
    expect(body).not.toContain('UNIT PRICE / RATE')
    expect(body).not.toContain('/mo) Tj')
    expect(body).not.toContain('(Settlement)')
    expect(body.match(/\/I0 Do/g)).toHaveLength(pdf.getNumberOfPages() + 1)
  })

  it('shows cash only on the offer where it was selected', () => {
    const source = makeQuote()
    const plan = DEFAULT_PAYMENT_PLANS.find((entry) => entry.id === 'hr-60-0')!
    const quote = makeQuote({
      pricing: { paymentOptions: [plan] },
      alternatives: [{
        id: 'cash', name: 'Purchase', discountType: 'none', discountValue: 0,
        pricing: { paymentOptions: ['cash', plan] },
        lines: [{ ...source.lines[0], unitPriceCents: 1_234_567 }],
      }],
    })
    const body = createQuotationPdf(quote, DEFAULT_SETTINGS).output()
    expect(body.match(/\(CASH TOTAL\)/g)).toHaveLength(1)
    expect(body.match(/\(UNIT PRICE \/ RATE\)/g)).toHaveLength(1)
    expect(body.match(/HR 60 months/g)).toHaveLength(2)
    expect(body).toContain('Cash options require a 50% deposit')
  })

  it('includes additional GP in cash line prices without disclosing the adjustment', () => {
    const quote = makeQuote({
      lines: [{ ...makeQuote().lines[0], quantity: 2, unitPriceCents: 5_000 }],
      pricing: { paymentOptions: ['cash'], additionalGpCents: 2_000 },
    })
    const body = createQuotationPdf(quote, DEFAULT_SETTINGS).output()
    expect(body).toContain(`(${money(6_000)}) Tj`)
    expect(body).toContain(`(${money(12_000)}) Tj`)
    expect(body).not.toContain('Additional GP')
  })

  it('shows the monthly rate and quantity-adjusted total in the pricing columns', () => {
    const product = makeQuote().lines[0]
    const quote = makeQuote({
      lines: [
        { ...product, name: '40GB Capped', description: 'Telkom LTE (SIM Only)', quantity: 2, unitPriceCents: 0, monthlyCents: 31_000 },
        { ...product, id: 'mixed', name: 'Managed router', quantity: 3, unitPriceCents: 50_000, monthlyCents: 12_500 },
      ],
    })
    const offer = pageContent(createQuotationPdf(quote, DEFAULT_SETTINGS), 3)
    const [products] = offer.split('(PAYMENT OPTIONS) Tj')
    expect(products).toContain('Line prices exclude VAT')
    const [recurring, mixed] = products.split('(Managed router) Tj')
    expect(recurring).toContain(`(${money(31_000)}/mo) Tj`)
    expect(recurring).toContain(`(${money(62_000)}/mo) Tj`)
    expect(recurring).not.toContain(`(${money(0)}) Tj`)
    expect(recurring).not.toContain('/month')
    expect(mixed).toContain(`(${money(50_000)}) Tj`)
    expect(mixed).toContain(`(${money(150_000)}) Tj`)
    expect(mixed).toContain(`(${money(12_500)}/mo) Tj`)
    expect(mixed).toContain(`(${money(37_500)}/mo) Tj`)

    quote.pricing = { paymentOptions: ['cash'], hideLinePrices: true }
    const hidden = pageContent(createQuotationPdf(quote, DEFAULT_SETTINGS), 3)
    expect(hidden).not.toContain('/mo) Tj')
    expect(hidden).not.toContain('Line prices exclude VAT')
    expect(hidden).toContain('Recurring services ex. VAT')
  })

  it('prints the exact fixed cash total with settlement and VAT included', () => {
    const quote = makeQuote({
      lines: [{ ...makeQuote().lines[0], quantity: 1, unitPriceCents: 4_044_320, costCents: 4_044_320 }],
      discountType: 'percentage',
      discountValue: 20,
      pricing: { paymentOptions: ['cash'], fixedSalesPriceCents: 88_800, additionalGpCents: 2_000, settlementCents: 20_000 },
    })
    const body = pageContent(createQuotationPdf(quote, DEFAULT_SETTINGS), 3)
    expect(body).toContain('CASH TOTAL')
    expect(body).toContain(`(${money(88_800)}) Tj`)
    expect(body).toContain('Settlement')
    expect(body).toContain('VAT')
    expect(body).not.toContain('Discount')
    expect(body).not.toContain('Effective margin')
  })

  it.each([undefined, { paymentOptions: [] }])('omits pricing when no payment option was selected', (pricing) => {
    const quote = makeQuote({ pricing })
    quote.lines[0].monthlyCents = 45_500
    const pdf = createQuotationPdf(quote, DEFAULT_SETTINGS)
    const body = pdf.output()
    expect(body).toContain('PROPOSED PRODUCTS & SERVICES')
    expect(body).not.toContain('PAYMENT OPTIONS')
    expect(body).not.toContain('CASH TOTAL')
    expect(body).not.toContain('UNIT PRICE / RATE')
    expect(body).not.toContain('50% deposit')
    expect(body.match(/\/I0 Do/g)).toHaveLength(pdf.getNumberOfPages())
  })

  it('continues the payment schedule when many plans are selected', () => {
    const plans = DEFAULT_PAYMENT_PLANS.filter((plan) => plan.id.startsWith('36-') || plan.id.startsWith('48-'))
    const quote = makeQuote({ pricing: { paymentOptions: plans } })
    const pdf = createQuotationPdf(quote, DEFAULT_SETTINGS)
    expect(pdf.getNumberOfPages()).toBeGreaterThan(4)
    expect(pdf.output()).toContain('48 months')
    expect(pdf.output()).toContain('OFFER DETAILS')
  })

  it('applies the display controls to custom features, charges, VAT, and call rates', () => {
    const product = { ...makeQuote().lines[0], name: 'Custom console', description: 'Configured to the site requirements.' }
    const feature = {
      ...product, id: 'support', name: 'Enhanced support', description: '', customFeature: true,
      accessoryForId: product.id, monthlyCents: 5_000,
    }
    const quote = makeQuote({
      lines: [product, feature],
      pricing: { paymentOptions: ['cash'], settlementCents: 35_000, showCallRates: true },
    })
    const visible = pageContent(createQuotationPdf(quote, DEFAULT_SETTINGS), 3)
    expect(visible).toContain('Enhanced support')
    expect(visible).not.toContain('Feature for Custom console')
    expect(visible).toContain('Settlement')
    expect(visible).toContain('VAT')
    expect(visible).toContain('35c per minute')
    expect(visible).toContain('75c per minute')

    const hiddenQuote = makeQuote({
      ...quote,
      pricing: {
        ...quote.pricing, hideLinePrices: true, hideAccessories: true, foldSettlement: true, excludeVat: true,
        localCallRate: '45c per minute', cellularCallRate: '',
      },
    })
    const hidden = pageContent(createQuotationPdf(hiddenQuote, DEFAULT_SETTINGS), 3)
    expect(hidden).toContain('Custom console')
    expect(hidden).toContain('Starting monthly total')
    expect(hidden).toContain('45c per minute')
    expect(hidden).not.toContain('Enhanced support')
    expect(hidden).not.toContain('Settlement')
    expect(hidden).not.toContain('VAT')
    expect(hidden).not.toContain('UNIT PRICE / RATE')
    expect(hidden).not.toContain('Cellular calls')
  })
  it('creates a cover, pricing schedule and acceptance page', () => {
    const quote = makeQuote()
    const pdf = createQuotationPdf(quote, DEFAULT_SETTINGS)

    expect(quote).toMatchObject({
      subtotalCents: 37_118_000,
      vatCents: 5_567_700,
      totalCents: 42_685_700,
    })
    expect(pdf.getNumberOfPages()).toBe(4)
    expect(pdf.output('arraybuffer').byteLength).toBeGreaterThan(1_000)
    expect(pdf.output()).toContain('The following terms apply to this quotation')
    expect(pdf.output()).toContain('50% deposit is required before procurement or scheduling')
    expect(pdf.output()).toContain('Cancellation, returns or exchanges are subject to written approval')
    expect(pdf.output()).toContain('Thank you for the opportunity to submit this quotation.')
    expect(pdf.output()).not.toContain('13. Thank you for the opportunity')
    expect(pdf.output()).not.toContain('14. Note:')
    expect(pdf.output()).toContain('CLIENT AUTHORISATION')
    expect(pdf.output()).toContain('(Company name) Tj')
    expect(pdf.output()).toContain('(Authorised representative) Tj')
    expect(pdf.output()).toContain('(Purchase order number) Tj')
    expect(pdf.output()).toContain('(Signature and date) Tj')
    expect(pdf.output()).not.toContain('Company: Mapei South Africa')
    expect(pdf.output()).toMatch(/\/I\d+ Do/)
    expect(pdf.output()).not.toContain('(techspire it) Tj')
  })

  it('continues unusually long commercial terms onto additional pages', () => {
    const quote = makeQuote({ terms: [`Approved test wording ${'with detail '.repeat(1_000)}`] })
    const pdf = createQuotationPdf(quote, DEFAULT_SETTINGS)

    expect(pdf.getNumberOfPages()).toBeGreaterThan(4)
  })

  it('prints an hourly rate and service total while hiding hours worked', () => {
    const source = makeQuote()
    const quote = makeQuote({
      lines: [{ ...source.lines[0], unit: 'hour', quantity: 2.5, unitPriceCents: 65_000 }],
    })
    const [products] = pageContent(createQuotationPdf(quote, DEFAULT_SETTINGS), 3).split('(PAYMENT OPTIONS) Tj')

    expect(products).not.toContain('(2.5) Tj')
    expect(products).toContain(`(${money(65_000)}/hr) Tj`)
    expect(products).toContain(`(${money(162_500)}) Tj`)
  })

  it('adds pricing continuation pages for long quotations', () => {
    const quote = makeQuote({
      lines: Array.from({ length: 60 }, (_, index) => ({
        id: `line-${index}`,
        itemId: null,
        name: `Extended service ${index + 1}`,
        description: 'A detailed installation and configuration service included in the proposed project scope.',
        sku: '',
        quantity: 1,
        unitPriceCents: 1_000,
        vatApplicable: true,
      })),
    })
    const pdf = createQuotationPdf(quote, DEFAULT_SETTINGS)

    expect(pdf.getNumberOfPages()).toBeGreaterThan(4)
    const offerPages = Array.from({ length: pdf.getNumberOfPages() - 3 }, (_, index) => pageContent(pdf, index + 3)).join('\n')
    expect(offerPages).toContain('Extended service 60')
    expect(offerPages.indexOf('Extended service 60')).toBeLessThan(offerPages.indexOf('PAYMENT OPTIONS'))
    expect(offerPages.match(/\(CASH TOTAL\)/g)).toHaveLength(1)
  })

  it('uses a filesystem-safe client name in the export filename', () => {
    expect(quotationFilename(makeQuote())).toBe('Techspire_QT-2026-099_Mapei-South-Africa.pdf')
  })
})
