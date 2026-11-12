import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, type Quote } from './domain'
import { createQuotationPdf, quotationFilename } from './quotationPdf'

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

describe('quotation PDF', () => {
  it('creates a cover, pricing schedule and acceptance page', () => {
    const quote = makeQuote()
    const pdf = createQuotationPdf(quote, DEFAULT_SETTINGS)

    expect(quote).toMatchObject({
      subtotalCents: 37_118_000,
      vatCents: 5_567_700,
      totalCents: 42_685_700,
    })
    expect(pdf.getNumberOfPages()).toBe(3)
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

    expect(pdf.getNumberOfPages()).toBeGreaterThan(3)
  })

  it('does not print hours worked for hourly service lines', () => {
    const source = makeQuote()
    const quote = makeQuote({
      lines: [{ ...source.lines[0], unit: 'hour', quantity: 2.5 }],
    })
    const pdf = createQuotationPdf(quote, DEFAULT_SETTINGS)

    expect(pdf.output()).not.toContain('(2.5) Tj')
    expect(pdf.output()).toContain('(UNIT PRICE / RATE) Tj')
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

    expect(pdf.getNumberOfPages()).toBeGreaterThan(3)
  })

  it('uses a filesystem-safe client name in the export filename', () => {
    expect(quotationFilename(makeQuote())).toBe('Techspire_QT-2026-099_Mapei-South-Africa.pdf')
  })
})
