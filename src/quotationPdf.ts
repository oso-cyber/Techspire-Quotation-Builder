import { jsPDF } from 'jspdf'
import techspireLogo from './assets/techspire-logo.png?inline'
import {
  DEFAULT_ORDERING_TERMS,
  dateLabel,
  money,
  type CompanySettings,
  type Quote,
} from './domain'

const RED = '#d71920'
const BLACK = '#161616'
const LIGHT = '#f3f3f3'

function addCompanyLogo(doc: jsPDF, settings: CompanySettings, x: number, y: number, maxWidth: number, maxHeight: number) {
  const imageData = settings.logoDataUrl || techspireLogo
  const format = imageData.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG'
  const { width, height } = doc.getImageProperties(imageData)
  const scale = Math.min(maxWidth / width, maxHeight / height)
  const imageWidth = width * scale
  const imageHeight = height * scale
  doc.addImage(imageData, format, x, y + (maxHeight - imageHeight) / 2, imageWidth, imageHeight)
}

function pageHeader(doc: jsPDF, settings: CompanySettings, subtitle: string) {
  addCompanyLogo(doc, settings, 20, 4, 34, 23)
  doc.setFontSize(7)
  doc.setTextColor(RED)
  doc.text('TECHNOLOGY  |  SECURITY  |  CONNECTIVITY', 190, 15, { align: 'right' })
  doc.setTextColor(BLACK)
  doc.text('PROFESSIONAL SOLUTIONS', 190, 20, { align: 'right' })
  doc.setDrawColor(RED)
  doc.setLineWidth(0.8)
  doc.line(20, 28, 190, 28)
  doc.setFontSize(15)
  doc.setFont('helvetica', 'bold')
  doc.text(subtitle.toUpperCase(), 20, 40)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.text(settings.name, 190, 40, { align: 'right' })
}

function pageFooter(doc: jsPDF, settings: CompanySettings, page: number, total: number) {
  doc.setDrawColor(220, 220, 220)
  doc.line(20, 278, 190, 278)
  doc.setFontSize(7)
  doc.setTextColor(100)
  const contact = [settings.phone, settings.email, settings.website].filter(Boolean).join('  |  ')
  if (contact) doc.text(contact, 105, 283, { align: 'center' })
  doc.text(`${page} / ${total}`, 190, 283, { align: 'right' })
  doc.setTextColor(BLACK)
}

export function createQuotationPdf(quote: Quote, settings: CompanySettings) {
  const doc = new jsPDF({ format: 'a4', unit: 'mm' })
  const pageWidth = 210
  const left = 20
  const right = 190

  addCompanyLogo(doc, settings, left + 2, 7, 37, 26)
  doc.setFontSize(8)
  doc.setTextColor(RED)
  doc.text('TECHNOLOGY  |  SECURITY  |  CONNECTIVITY', right, 16, { align: 'right' })
  doc.setTextColor(BLACK)
  doc.text('PROFESSIONAL SOLUTIONS', right, 21, { align: 'right' })
  doc.setDrawColor(RED)
  doc.setLineWidth(1)
  doc.line(left, 36, right, 36)

  doc.setFillColor(BLACK)
  doc.rect(left + 2, 44, 120, 55, 'F')
  doc.setFillColor(RED)
  doc.rect(left + 122, 44, 48, 55, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setTextColor('#ffffff')
  doc.setFontSize(22)
  doc.text(quote.title.toUpperCase(), left + 7, 59, { maxWidth: 110 })
  doc.setTextColor(RED)
  doc.setFontSize(18)
  doc.text('SOLUTION PROPOSAL', left + 7, 73)
  doc.setTextColor('#ffffff')
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('Secure. Connected. Professionally deployed.', left + 7, 88)
  doc.setTextColor(BLACK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('PRICE', left + 146, 56, { align: 'center' })
  doc.setFontSize(13)
  doc.text('QUOTATION', left + 146, 66, { align: 'center' })
  doc.setFontSize(9)
  doc.setTextColor('#ffffff')
  doc.text(quote.number, left + 146, 81, { align: 'center' })

  const blocks = [
    { x: 22, y: 108, width: 82, label: 'PREPARED FOR', lines: [quote.clientSnapshot.name, quote.clientSnapshot.address, `${quote.clientSnapshot.city} ${quote.clientSnapshot.postalCode}`.trim()] },
    { x: 105, y: 108, width: 85, label: 'PREPARED BY', lines: [settings.preparedBy, settings.name] },
    { x: 22, y: 139, width: 82, label: 'ISSUE DATE', lines: [dateLabel(quote.issueDate)] },
    { x: 105, y: 139, width: 85, label: 'VALID UNTIL', lines: [dateLabel(quote.validUntil)] },
  ]
  blocks.forEach(({ x, y, width, label, lines }, index) => {
    doc.setFillColor(index % 2 ? '#fbe9e9' : LIGHT)
    doc.rect(x, y, width, 28, 'F')
    doc.setTextColor(RED)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.text(label, x + 4, y + 6)
    doc.setTextColor(BLACK)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(lines.filter(Boolean), x + 4, y + 13, { maxWidth: width - 8 })
  })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text(settings.name.toUpperCase(), pageWidth / 2, 184, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text([settings.address, [settings.phone, settings.email, settings.website].filter(Boolean).join('  |  ')].filter(Boolean), pageWidth / 2, 190, { align: 'center' })
  doc.addPage()
  function addPricingPage(continued: boolean) {
    if (continued) doc.addPage()
    pageHeader(doc, settings, continued ? 'Pricing Schedule — Continued' : 'Pricing Schedule')
    doc.setFillColor(BLACK)
    doc.rect(left, 48, 170, 10, 'F')
    doc.setTextColor('#ffffff')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('NO.', 23, 54)
    doc.text('DESCRIPTION', 36, 54)
    doc.text('QTY', 140, 54, { align: 'right' })
    doc.text('UNIT PRICE / RATE', 163, 54, { align: 'right' })
    doc.text('TOTAL', 187, 54, { align: 'right' })
  }
  addPricingPage(false)

  let y = 58
  quote.lines.forEach((line, index) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    const description = doc.splitTextToSize([line.name, line.description].filter(Boolean).join(' - '), 95) as string[]
    const chunks: string[][] = []
    for (let offset = 0; offset < description.length; offset += 10) {
      chunks.push(description.slice(offset, offset + 10))
    }
    for (const [chunkIndex, chunk] of chunks.entries()) {
      const height = Math.max(10, chunk.length * 4 + 4)
      if (y + height > 238) {
        addPricingPage(true)
        y = 58
      }
      if (index % 2 === 0) {
        doc.setFillColor(248, 248, 248)
        doc.rect(left, y, 170, height, 'F')
      }
      doc.setTextColor(BLACK)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.text(chunkIndex === 0 ? String(index + 1).padStart(2, '0') : '', 23, y + 6)
      doc.text(chunk, 36, y + 5, { maxWidth: 96 })
      if (chunkIndex === 0) {
        if (line.unit !== 'hour') doc.text(String(line.quantity), 140, y + 6, { align: 'right' })
        doc.text(money(line.unitPriceCents), 163, y + 6, { align: 'right' })
        doc.text(money(Math.round(line.quantity * line.unitPriceCents)), 187, y + 6, { align: 'right' })
      }
      y += height
    }
  })
  let summaryTop = Math.max(y + 7, 215)
  if (summaryTop > 236) {
    addPricingPage(true)
    summaryTop = 64
  }
  const totals = [
    ['Subtotal', quote.subtotalCents],
    ['Discount', -quote.discountCents],
    [`VAT (${settings.vatRate}%)`, quote.vatCents],
  ]
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  totals.forEach(([label, amount], index) => {
    const rowY = summaryTop + index * 7
    doc.setTextColor(BLACK)
    doc.text(String(label), 148, rowY)
    doc.text(money(Number(amount)), 187, rowY, { align: 'right' })
  })
  doc.setFillColor(RED)
  doc.rect(132, summaryTop + 22, 58, 11, 'F')
  doc.setTextColor('#ffffff')
  doc.setFont('helvetica', 'bold')
  doc.text('TOTAL', 137, summaryTop + 29)
  doc.text(money(quote.totalCents), 187, summaryTop + 29, { align: 'right' })
  doc.addPage()
  pageHeader(doc, settings, 'Ordering Terms & Acceptance')
  const terms = (quote.terms.length ? quote.terms : settings.defaultTerms?.length ? settings.defaultTerms : DEFAULT_ORDERING_TERMS).filter(Boolean)
  let termY = 49
  const startTermsContinuation = () => {
    doc.addPage()
    pageHeader(doc, settings, 'Ordering Terms & Acceptance — Continued')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(BLACK)
    termY = 49
  }
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(BLACK)
  let termNumber = 0
  const writeParagraph = (text: string, index: number) => {
    const [heading, ...bodyParts] = text.split(/\s(?:\||—)\s/)
    const isIntroduction = index === 0 && !bodyParts.length && heading.startsWith('The following terms apply')
    const isPrefixed = /^\d+\.\s/.test(heading)
    const isClosing = heading.startsWith('Thank you for the opportunity') || heading.startsWith('Note:')
    if (!isIntroduction && !isPrefixed && !isClosing) termNumber += 1
    const prefix = isIntroduction || isClosing ? '' : isPrefixed ? '' : `${termNumber}. `
    const paragraph = bodyParts.length ? `${heading}  ${bodyParts.join(' ')}` : heading
    const lines = doc.splitTextToSize(`${prefix}${paragraph}`, 166) as string[]
    const lineHeight = 3.8
    for (let offset = 0; offset < lines.length; offset += 30) {
      const chunk = lines.slice(offset, offset + 30)
      const height = chunk.length * lineHeight + 3
      if (termY + height > 195) startTermsContinuation()
      doc.text(chunk, left + 2, termY)
      termY += height
    }
    if (isPrefixed) termNumber = Math.max(termNumber, Number(heading.match(/^(\d+)\./)?.[1] ?? 0))
  }
  terms.forEach((term, index) => {
    writeParagraph(term, index)
  })
  if (quote.notes) {
    if (termY + 9 > 195) startTermsContinuation()
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('PROJECT NOTES', left + 2, termY + 2)
    doc.setFont('helvetica', 'normal')
    termY += 9
    doc.setFontSize(8)
    writeParagraph(quote.notes, terms.length)
  }
  if (termY > 205) startTermsContinuation()
  const authorisationY = Math.max(termY + 12, 210)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(BLACK)
  doc.setFontSize(10)
  doc.text('CLIENT AUTHORISATION', left, authorisationY + 8)
  const tableX = left + 2
  const tableY = authorisationY + 14
  const labelWidth = 44
  const valueWidth = right - tableX - labelWidth
  const rowHeight = 9.5
  const authorisationFields = [
    'Company name',
    'Authorised representative',
    'Purchase order number',
    'Signature and date',
  ]
  doc.setLineWidth(0.2)
  doc.setFontSize(8)
  authorisationFields.forEach((field, index) => {
    const rowY = tableY + index * rowHeight
    doc.setFillColor('#f1f2f4')
    doc.rect(tableX, rowY, labelWidth, rowHeight, 'F')
    doc.setDrawColor(205, 208, 212)
    doc.rect(tableX, rowY, labelWidth, rowHeight)
    doc.rect(tableX + labelWidth, rowY, valueWidth, rowHeight)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(BLACK)
    doc.text(field, tableX + 2, rowY + 5.9)
  })
  const totalPages = doc.getNumberOfPages()
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page)
    pageFooter(doc, settings, page, totalPages)
  }

  return doc
}

export function quotationFilename(quote: Quote) {
  const client = quote.clientSnapshot.name
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
  return `Techspire_${quote.number}_${client}.pdf`
}
