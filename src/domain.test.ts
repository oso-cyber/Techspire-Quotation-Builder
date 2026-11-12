import { describe, expect, it } from 'vitest'
import {
  calculateTotals,
  catalogueNetPriceCents,
  createQuoteFromTemplate,
  DEFAULT_SETTINGS,
  today,
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
})
