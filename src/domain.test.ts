import { describe, expect, it } from 'vitest'
import { DEFAULT_PAYMENT_PLANS, paymentFactor } from './paymentPlans'
import {
  calculateOfferPayments,
  calculateQuotePricing,
  createPackageLine,
  calculateTotals,
  catalogueNetPriceCents,
  createQuoteFromTemplate,
  DEFAULT_SETTINGS,
  ALL_HISTORY_CREATORS,
  filterMyQuotes,
  filterQuoteHistory,
  quotePricingInputs,
  today,
  UNRECORDED_HISTORY_CREATOR,
  type Quote,
  type QuoteLine,
} from './domain'

const line = (amount: number, vatApplicable = true, quantity = 1, unit = 'each'): QuoteLine => ({
  id: crypto.randomUUID(),
  itemId: null,
  unit,
  name: 'Test item',
  description: '',
  sku: '',
  quantity,
  unitPriceCents: amount,
  vatApplicable,
})

describe('quotation calculations', () => {
  it('charges only selected package features and keeps monthly charges separate', () => {
    const item = {
      id: 'lte', name: 'LTE service', description: '', sku: '', category: 'Connectivity',
      unit: 'each', priceCents: 25_000, monthlyCents: 35_000, vatApplicable: true, active: true,
    }
    const header = createPackageLine({
      id: 'connect', name: 'Connectivity package', description: '', items: [{ itemId: 'lte', quantity: 2 }],
    }, [item])
    const quote = { lines: [header], discountType: 'none' as const, discountValue: 0 }
    expect(header.packageFeatures).toEqual([{ item, quantity: 2 }])
    expect(calculateQuotePricing(quote, 15)).toMatchObject({ dueCents: 0, monthlyCents: 0 })
    const included = { ...line(item.priceCents, true, 2), monthlyCents: item.monthlyCents, packageInstanceId: header.packageInstanceId }
    expect(calculateQuotePricing({ ...quote, lines: [header, included] }, 15)).toMatchObject({
      dueCents: 57_500, monthlyCents: 80_500, lineTotals: [0, 50_000],
    })
  })
  it('uses the matching visible payment tier and rounds the financed amount and VAT to cents', () => {
    const plan = DEFAULT_PAYMENT_PLANS.find((entry) => entry.id === '36-0')!
    expect(paymentFactor(plan, 2_000_000)).toBe(0.03956)
    expect(paymentFactor(plan, 2_000_001)).toBe(0.03738)
    expect(paymentFactor(plan, 5_000_001)).toBe(0.03667)
    expect(paymentFactor(plan, 10_000_001)).toBe(0.03620)
    const quote = {
      lines: [line(3_000_000), { ...line(0, true, 2), monthlyCents: 109_900 }],
      discountType: 'fixed' as const,
      discountValue: 5_000,
      pricing: { plan },
    }
    expect(calculateQuotePricing(quote, 15)).toMatchObject({
      factor: 0.03738,
      netSaleCents: 2_500_000,
      financedCents: 93_450,
      financeVatCents: 14_018,
      monthlyCents: 360_238,
    })
  })

  it('uses edited rates and leaves unsupported brackets unavailable', () => {
    const plan = DEFAULT_PAYMENT_PLANS.find((entry) => entry.id === '18-5')!
    expect(paymentFactor(plan, 100_000_001)).toBeNull()
    expect(paymentFactor({ ...plan, tiers: [{ limit: 90_000, factor: 0.04 }] }, 4_000_000)).toBe(0.04)
  })

  it('adds recurring charges independently when the once-off value is zero', () => {
    const totals = calculateQuotePricing({
      lines: [109_900, 35_000, 45_500].map((monthlyCents) => ({ ...line(0), monthlyCents })),
      discountType: 'none',
      discountValue: 0,
      pricing: { excludeVat: true },
    }, 15)
    expect(totals.dueCents).toBe(0)
    expect(totals.monthlyCents).toBe(190_400)
  })

  it('keeps discount and VAT totals consistent when lines are reordered', () => {
    const lines = [{ ...line(10), id: 'a' }, { ...line(10, false), id: 'b' }]
    const original = calculateTotals(lines, 'fixed', 0.01, 15)
    expect(calculateTotals([...lines].reverse(), 'fixed', 0.01, 15).totalCents).toBe(original.totalCents)
  })

  it('applies markup to base cost, then adds settlement outside VAT', () => {
    const totals = calculateQuotePricing({
      lines: [{ ...line(10_000, true, 2), costCents: 8_000 }],
      discountType: 'none',
      discountValue: 0,
      pricing: { adjustment: 'markup', value: 25, settlementCents: 3_500 },
    }, 15)
    expect(totals).toMatchObject({
      baseCents: 16_000, profitCents: 4_000, effectiveMarkupPercent: 25, effectiveMarginPercent: 20,
      vatCents: 3_000, dueCents: 26_500,
    })
  })

  it('stacks additional GP with markup before discount, VAT and finance tier selection', () => {
    const plan = DEFAULT_PAYMENT_PLANS.find((entry) => entry.id === '36-0')!
    const quote = {
      lines: [{ ...line(2_000_000), costCents: 1_600_000, monthlyCents: 10_000 }],
      discountType: 'fixed' as const,
      discountValue: 500,
      pricing: { adjustment: 'markup' as const, value: 25, additionalGpCents: 100_000, paymentOptions: ['cash' as const, plan] },
    }
    const [cash, finance] = calculateOfferPayments(quote, 15)
    expect(cash.totals).toMatchObject({
      subtotalCents: 2_100_000, netSaleCents: 2_050_000, profitCents: 450_000,
      vatCents: 307_500, dueCents: 2_357_500, monthlyCents: 11_500,
    })
    expect(finance.totals).toMatchObject({ factor: 0.03738, financedCents: 76_629, monthlyCents: 99_623 })
  })

  it('honours stored profit-only quotes and allows their additional GP to be cleared', () => {
    const quote = { lines: [line(100_000)], discountType: 'none' as const, discountValue: 0 }
    const legacyPricing = { adjustment: 'profit' as const, value: 350 }
    expect(calculateQuotePricing({ ...quote, pricing: legacyPricing }, 15).subtotalCents).toBe(135_000)
    expect(calculateQuotePricing({ ...quote, pricing: { ...legacyPricing, additionalGpCents: 0 } }, 15).subtotalCents).toBe(100_000)
  })

  it('includes additional GP before and after selecting a package item', () => {
    const header = createPackageLine({ id: 'package', name: 'Package', description: '', items: [] }, [])
    const plan = DEFAULT_PAYMENT_PLANS.find((entry) => entry.id === '36-0')!
    const quote = {
      discountType: 'none' as const,
      discountValue: 0,
      pricing: { additionalGpCents: 25_000, paymentOptions: ['cash' as const, plan] },
    }
    for (const lines of [[], [header]]) {
      const [cash, finance] = calculateOfferPayments({ ...quote, lines }, 15)
      expect(cash.totals).toMatchObject({ subtotalCents: 25_000, dueCents: 25_000, lineTotals: lines.map(() => 0) })
      expect(finance.totals.financedCents).toBe(989)
    }

    const item = { ...line(100_000), packageInstanceId: header.packageInstanceId }
    const [cash, finance] = calculateOfferPayments({ ...quote, lines: [header, item] }, 15)
    expect(cash.totals).toMatchObject({ dueCents: 143_750, vatCents: 18_750, lineTotals: [0, 125_000] })
    expect(finance.totals.monthlyCents).toBe(5_687)
  })

  it('uses settlement to select the finance tier while leaving cash recurring charges alone', () => {
    const plan = DEFAULT_PAYMENT_PLANS.find((entry) => entry.id === '36-0')!
    const [cash, finance] = calculateOfferPayments({
      lines: [{ ...line(1_900_000), monthlyCents: 20_000 }],
      discountType: 'none',
      discountValue: 0,
      pricing: { settlementCents: 200_000, paymentOptions: ['cash', plan] },
    }, 0)
    expect(cash.totals.monthlyCents).toBe(20_000)
    expect(finance.totals).toMatchObject({ factor: 0.03738, financedCents: 78_498, monthlyCents: 98_498 })
  })

  it('sets the exact once-off total for cash and finance when fixed pricing is active', () => {
    const quote = {
      lines: [{ ...line(105_000), costCents: 80_000, monthlyCents: 10_000 }],
      discountType: 'percentage' as const,
      discountValue: 20,
    }
    const plan = DEFAULT_PAYMENT_PLANS.find((entry) => entry.id === '36-0')!
    const pricing = {
      markupPercent: 20, marginPercent: 20, fixedSalesPriceCents: 120_000, additionalGpCents: 5_000,
      settlementCents: 10_000, paymentOptions: ['cash' as const, plan],
    }
    const [cash, finance] = calculateOfferPayments({ ...quote, pricing }, 15)
    expect(cash.totals).toMatchObject({
      priceBasis: 'fixed sales price', subtotalCents: 95_652, vatCents: 14_348, discountCents: 0,
      settlementCents: 10_000, dueCents: 120_000, monthlyCents: 11_500,
    })
    expect(finance.totals).toMatchObject({
      dueCents: 120_000, factor: 0.03956, financedCents: 4_180, financeVatCents: 568, monthlyCents: 16_248,
    })
    const percentages = { ...pricing, fixedSalesPriceCents: undefined }
    expect(calculateQuotePricing({ ...quote, pricing: { ...percentages, percentageBasis: 'margin' } }, 15)).toMatchObject({
      priceBasis: 'margin', subtotalCents: 105_000, discountCents: 21_000, settlementCents: 10_000,
    })
    expect(calculateQuotePricing({ ...quote, pricing: { ...percentages, percentageBasis: 'markup' } }, 15)).toMatchObject({
      priceBasis: 'markup', subtotalCents: 101_000,
    })
    expect(calculateQuotePricing({ ...quote, pricing: { ...percentages, marginPercent: undefined, percentageBasis: 'margin' } }, 15)).toMatchObject({
      priceBasis: 'markup', subtotalCents: 101_000,
    })
    expect(calculateQuotePricing({ ...quote, pricing: { ...percentages, marginPercent: undefined, markupPercent: undefined } }, 15)).toMatchObject({
      priceBasis: 'line prices', subtotalCents: 110_000,
    })
  })

  it('extracts VAT from the fixed total on taxable lines to the cent', () => {
    const quote = {
      lines: [line(10), line(10, false)],
      discountType: 'none' as const,
      discountValue: 0,
      pricing: { fixedSalesPriceCents: 8 },
    }
    expect(calculateQuotePricing(quote, 15)).toMatchObject({
      subtotalCents: 7, taxableCents: 3, lineTotals: [3, 4], vatByLine: [1, 0], dueCents: 8,
    })
  })

  it('reports the effective loss shown in the C4000i fixed-price example', () => {
    const quote = {
      lines: [{ ...line(4_044_320), costCents: 4_044_320 }],
      discountType: 'none' as const,
      discountValue: 0,
      pricing: { fixedSalesPriceCents: 88_800, excludeVat: true },
    }
    const totals = calculateQuotePricing(quote, 15)
    expect(totals).toMatchObject({ baseCents: 4_044_320, profitCents: -3_955_520, dueCents: 88_800 })
    expect(totals.effectiveMarkupPercent).toBeCloseTo(-97.80, 2)
    expect(totals.effectiveMarginPercent).toBeCloseTo(-4454.41, 2)
    expect(calculateQuotePricing({ ...quote, pricing: { excludeVat: true } }, 15)).toMatchObject({
      effectiveMarkupPercent: 0, effectiveMarginPercent: 0,
    })
  })

  it('links markup and margin using the saved pricing basis', () => {
    const markup = quotePricingInputs({ markupPercent: 20, marginPercent: 5, percentageBasis: 'markup' })
    expect(markup.markupPercent).toBe(20)
    expect(markup.marginPercent).toBeCloseTo(16.666667, 6)

    const margin = quotePricingInputs({ marginPercent: 20, percentageBasis: 'margin' })
    expect(margin.marginPercent).toBe(20)
    expect(margin.markupPercent).toBe(25)

    expect(quotePricingInputs({ adjustment: 'markup', value: 25 })).toMatchObject({ markupPercent: 25, marginPercent: 20 })
    expect(quotePricingInputs({ adjustment: 'margin', value: 20 })).toMatchObject({ markupPercent: 25, marginPercent: 20 })
    expect(quotePricingInputs({ fixedSalesPriceCents: 100_000 })).toMatchObject({ markupPercent: undefined, marginPercent: undefined })
  })

  it('preserves fixed-price quotes with an explicit zero', () => {
    const quote = { lines: [line(100_000)], discountType: 'none' as const, discountValue: 0 }
    expect(calculateQuotePricing({ ...quote, pricing: { adjustment: 'fixed', value: 0 } }, 15)).toMatchObject({
      priceBasis: 'fixed sales price', subtotalCents: 0,
    })
    expect(calculateQuotePricing({ ...quote, pricing: { fixedSalesPriceCents: 0, settlementCents: 10_000 } }, 15)).toMatchObject({
      priceBasis: 'fixed sales price', subtotalCents: 0, settlementCents: 0, dueCents: 0,
    })
  })

  it('reproduces the supplied seven-line reference totals exactly', () => {
    const lines = [
      line(1_890_000),
      line(440_000, true, 32),
      line(990_000, true, 2),
      line(250_000, true, 32),
      line(99_000, true, 32),
      line(1_500_000),
      line(6_500_000),
    ]

    expect(calculateTotals(lines, 'none', 0, 15)).toMatchObject({
      subtotalCents: 37_118_000,
      discountCents: 0,
      vatCents: 5_567_700,
      totalCents: 42_685_700,
    })
  })

  it('calculates quantities and fixed discounts using whole cents', () => {
    const totals = calculateTotals([line(12_345, true, 3)], 'fixed', 25, 15)

    expect(totals.subtotalCents).toBe(37_035)
    expect(totals.discountCents).toBe(2_500)
    expect(totals.vatCents).toBe(5_180)
    expect(totals.totalCents).toBe(39_715)
  })

  it('multiplies an hourly service rate by hours worked', () => {
    const totals = calculateTotals([line(25_000, true, 2.5, 'hour')], 'none', 0, 15)

    expect(totals.subtotalCents).toBe(62_500)
    expect(totals.vatCents).toBe(9_375)
    expect(totals.totalCents).toBe(71_875)
  })

  it('caps a fixed discount at the subtotal', () => {
    const totals = calculateTotals([line(10_000)], 'fixed', 900, 15)

    expect(totals.discountCents).toBe(10_000)
    expect(totals.vatCents).toBe(0)
    expect(totals.totalCents).toBe(0)
  })

  it('distributes percentage discounts over taxable and exempt lines', () => {
    const totals = calculateTotals([line(10_000), line(10_000, false)], 'percentage', 10, 15)

    expect(totals.subtotalCents).toBe(20_000)
    expect(totals.discountCents).toBe(2_000)
    expect(totals.taxableCents).toBe(9_000)
    expect(totals.vatCents).toBe(1_350)
    expect(totals.totalCents).toBe(19_350)
  })

  it('handles an empty quotation without producing negative totals', () => {
    expect(calculateTotals([], 'fixed', 100, 15)).toMatchObject({
      subtotalCents: 0,
      discountCents: 0,
      vatCents: 0,
      totalCents: 0,
    })
  })

  it('converts VAT-inclusive catalogue prices to an exact cent-based net price', () => {
    expect(catalogueNetPriceCents(11_500, true, true, 15)).toBe(10_000)
    expect(catalogueNetPriceCents(11_500, true, false, 15)).toBe(11_500)
    expect(catalogueNetPriceCents(10_000, true, true, 15)).toBe(8_696)
  })

  it('creates a fresh editable draft from a saved quotation template', () => {
    const client = {
      id: 'client-1',
      name: 'Acme',
      contact: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      province: '',
      postalCode: '',
      vatNumber: '',
      archived: false,
    }
    const source: Quote = {
      id: 'quote-old',
      number: 'QT-2025-001',
      status: 'Finalised',
      title: 'Monthly IT support',
      clientId: client.id,
      clientSnapshot: client,
      lines: [
        { ...line(65_000, true, 2, 'hour'), packageId: 'package-1', packageInstanceId: 'instance-old', packageName: 'Support' },
        { ...line(10_000), packageId: 'package-1', packageInstanceId: 'instance-old', packageName: 'Support' },
      ],
      issueDate: '2025-01-01',
      validUntil: '2025-01-08',
      discountType: 'percentage',
      discountValue: 5,
      notes: 'Review the visit date.',
      terms: ['Approved terms'],
      subtotalCents: 0,
      discountCents: 0,
      vatCents: 0,
      totalCents: 0,
      createdAt: '2025-01-01T00:00:00.000Z',
      exportedFilename: 'old.pdf',
    }
    const template = {
      id: 'template-1',
      name: 'Monthly support',
      description: '',
      quote: source,
      createdAt: source.createdAt,
      updatedAt: source.createdAt,
    }
    const settings = { ...DEFAULT_SETTINGS, validityDays: 14 }
    const draft = createQuoteFromTemplate(template, 'QT-2026-002', [client], settings)

    expect(draft).toMatchObject({
      number: 'QT-2026-002',
      status: 'Draft',
      title: source.title,
      clientId: client.id,
      issueDate: today(),
      validUntil: expect.any(String),
      discountType: 'percentage',
      discountValue: 5,
      notes: source.notes,
      terms: source.terms,
      exportedFilename: '',
    })
    expect(draft.validUntil).not.toBe(source.validUntil)
    expect(draft.id).not.toBe(source.id)
    expect(draft.lines.map((item) => item.id)).not.toEqual(source.lines.map((item) => item.id))
    expect(draft.lines[0].packageInstanceId).not.toBe(source.lines[0].packageInstanceId)
    expect(draft.lines[0].packageInstanceId).toBe(draft.lines[1].packageInstanceId)
    expect(draft.subtotalCents).toBe(140_000)
    expect(template.quote).toEqual(source)
  })

  it('searches and filters history by quote details, status, and creator', () => {
    const client = {
      id: 'client-1', name: 'Acme', contact: 'Jordan Smith', email: 'jordan@example.com',
      phone: '555-1234', address: '', city: '', province: '', postalCode: '', vatNumber: '', archived: false,
    }
    const draft: Quote = {
      id: 'history-1', number: 'QT-2026-001', status: 'Draft', title: 'Network upgrade',
      clientId: client.id, clientSnapshot: client, lines: [], issueDate: '2026-11-20',
      validUntil: '2026-11-27', discountType: 'none', discountValue: 0, notes: '', terms: [],
      subtotalCents: 0, discountCents: 0, vatCents: 0, totalCents: 125_000,
      createdAt: '2026-11-20T00:00:00.000Z', createdBy: 'Nishan Gounder', exportedFilename: '',
    }
    const legacy = { ...draft, id: 'history-2', number: 'QT-2026-002', status: 'Sent' as const, createdBy: undefined }

    expect(filterQuoteHistory([draft, legacy], 'jordan', 'Draft', 'Nishan Gounder')).toEqual([draft])
    expect(filterQuoteHistory([draft, legacy], '', 'Sent', UNRECORDED_HISTORY_CREATOR)).toEqual([legacy])
    expect(filterQuoteHistory([draft, legacy], 'network', 'All statuses', ALL_HISTORY_CREATORS)).toEqual([draft, legacy])
    expect(filterMyQuotes([draft, legacy], 'Nishan Gounder', '', 'All statuses')).toEqual([draft])
    expect(filterMyQuotes([draft, legacy], ' ', '', 'All statuses')).toEqual([])
    const cancelled = { ...draft, status: 'Cancelled' as const }
    const outsideRange = { ...cancelled, issueDate: '2026-11-21' }
    const differentCreator = { ...cancelled, createdBy: 'Another creator' }
    expect(filterQuoteHistory([draft, legacy, cancelled, outsideRange, differentCreator],
      '', 'Cancelled', 'Nishan Gounder', '2026-11-20', '2026-11-20')).toEqual([cancelled])
    expect(filterMyQuotes([draft, cancelled, differentCreator], 'Nishan Gounder', '', 'Cancelled',
      '2026-11-20', '2026-11-20')).toEqual([cancelled])
  })
})
