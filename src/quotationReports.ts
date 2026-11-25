import { calculateOfferPayments, clientDisplayName, quoteOptions, type Quote } from './domain'
import { paymentPlanLabel } from './paymentPlans'

export const reportTypes = ['Quotation summary', 'Quoted items', 'Payment options', 'Combined detail'] as const
export type ReportType = (typeof reportTypes)[number]

type Cell = string | number | { cents: number }

function money(cents: number): Cell {
  return { cents }
}

function csvCell(value: Cell): string {
  if (typeof value === 'object') return (value.cents / 100).toFixed(2)
  if (typeof value === 'number') return String(value)
  if (value === '') return ''
  const safe = /^[\s\uFEFF]*[=+@-]|^[\t\r\n]/.test(value) ? "'" + value : value
  return '"' + safe.replaceAll('"', '""') + '"'
}

export function reportRows(quotes: Quote[], type: ReportType, vatRate: number): Cell[][] {
  const common = ['Quote number', 'Client name', 'Created by', 'Issue date', 'Quotation status']
  const columns = {
    'Quotation summary': ['Quotation title', 'Valid until', 'Number of offers', 'Quote subtotal (ZAR)', 'Quote discount (ZAR)', 'Quote VAT (ZAR)', 'Quote total (ZAR)'],
    'Quoted items': ['Offer name', 'Package', 'Parent product', 'SKU', 'Item name', 'Quantity', 'Billing unit', 'Unit price (ZAR)', 'Monthly price per unit (ZAR)'],
    'Payment options': ['Offer name', 'Payment option', 'Finance factor', 'Settlement (ZAR)', 'Cash total (ZAR)', 'Starting monthly total (ZAR)'],
  }
  const combined = type === 'Combined detail'
  const sections = ['Quotation summary', 'Quoted items', 'Payment options'] as const
  type ReportSection = (typeof sections)[number]
  const rows: Cell[][] = [combined
    ? [...common, 'Record type', 'Offer name', ...sections.flatMap((section) => columns[section].filter((column) => column !== 'Offer name'))]
    : [...common, ...columns[type]]]

  for (const quote of quotes) {
    const prefix = [quote.number, clientDisplayName(quote.clientSnapshot), quote.createdBy ?? '', quote.issueDate, quote.status]
    const options = quoteOptions(quote)
    function addRow(section: ReportSection, values: Cell[], offer = '') {
      if (combined) {
        const details = sections.flatMap((key) => key === section ? values
          : columns[key].filter((column) => column !== 'Offer name').map(() => ''))
        rows.push([...prefix, section, offer, ...details])
      } else {
        rows.push(section === 'Quotation summary' ? [...prefix, ...values] : [...prefix, offer, ...values])
      }
    }

    if (type === 'Quotation summary' || combined) {
      addRow('Quotation summary', [quote.title, quote.validUntil, options.length, money(quote.subtotalCents),
        money(quote.discountCents), money(quote.vatCents), money(quote.totalCents)])
    }
    if (type === 'Quotation summary') continue

    for (const option of options) {
      if (type === 'Quoted items' || combined) {
        const byId = new Map(option.lines.map((line) => [line.id, line]))
        for (const line of option.lines) {
          if (line.packageFeatures) continue
          addRow('Quoted items', [line.packageName ?? '', byId.get(line.accessoryForId ?? '')?.name ?? '',
            line.sku ?? '', line.name, line.quantity, line.unit ?? '', money(line.unitPriceCents), money(line.monthlyCents ?? 0)], option.name)
        }
      }
      if (type === 'Payment options' || combined) {
        for (const { payment, totals } of calculateOfferPayments(option, vatRate)) {
          const cash = payment === 'cash'
          addRow('Payment options', [cash ? 'Cash' : paymentPlanLabel(payment), totals.factor ?? '',
            money(totals.settlementCents), cash ? money(totals.dueCents) : '',
            cash || totals.factor !== null ? money(totals.monthlyCents) : ''], option.name)
        }
      }
    }
  }

  return rows
}

export function quotationReport(quotes: Quote[], type: ReportType, vatRate: number): string {
  return '\uFEFF' + reportRows(quotes, type, vatRate).map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
}
